//! Casca desktop nativa do Windows: janela WebView2 (tao + wry), SplashScreen,
//! bandeja do sistema, "Iniciar com o Windows", instância única e o
//! comportamento configurável do botão X.

use crate::server::{Hooks, Server};
use crate::{data_dir, preferred_port, VERSION};
use serde_json::Value;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tao::dpi::{LogicalSize, PhysicalPosition};
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoop, EventLoopBuilder, EventLoopProxy};
use tao::platform::windows::WindowBuilderExtWindows;
use tao::window::{Window, WindowBuilder};
use tray_icon::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tray_icon::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use wry::{NewWindowResponse, PageLoadEvent, WebContext, WebView, WebViewBuilder};

const ICON_PNG: &[u8] = include_bytes!("../../public/img/icon.png");
const APP_ID: &str = "com.ttreter.timago";
const WINDOW_BG: (u8, u8, u8, u8) = (9, 13, 22, 255);
/// Tempo mínimo de exibição da splash para a barra progredir de forma visível.
const MIN_SPLASH: Duration = Duration::from_millis(1800);

enum UserEvent {
    SplashLoaded,
    MainLoaded,
    Reveal,
    CloseSplash,
    ShowMain,
    Menu(String),
    Settings { visible: bool, start_with_windows: bool },
    UpdateFound(Value),
    OpenUpdateModal,
    Quit,
}

type Proxy = EventLoopProxy<UserEvent>;

pub fn run(runtime: tokio::runtime::Runtime, autostart: bool) {
    let data_dir = data_dir();
    let _ = std::fs::create_dir_all(&data_dir);

    // Garante que apenas uma instância do tImago rode por vez
    let lock = std::fs::File::options()
        .create(true)
        .write(true)
        .truncate(false)
        .open(data_dir.join(".lock"))
        .ok();
    if lock.as_ref().is_some_and(|file| file.try_lock().is_err()) {
        focus_running_instance(&data_dir);
        return;
    }

    let event_loop: EventLoop<UserEvent> = EventLoopBuilder::with_user_event().build();
    let proxy = event_loop.create_proxy();

    // 1. Servidor HTTP + Socket.IO
    let hooks = Hooks {
        on_settings: Some(Box::new({
            let proxy = proxy.clone();
            move |settings: &Value| {
                let _ = proxy.send_event(UserEvent::Settings {
                    visible: crate::js::truthy(&settings["visible"]),
                    start_with_windows: crate::js::truthy(&settings["startWithWindows"]),
                });
            }
        })),
        on_quit: Arc::new({
            let proxy = proxy.clone();
            move || drop(proxy.send_event(UserEvent::Quit))
        }),
        on_show: Some(Arc::new({
            let proxy = proxy.clone();
            move || drop(proxy.send_event(UserEvent::ShowMain))
        })),
    };
    let server = match runtime.block_on(Server::start(data_dir.clone(), preferred_port(), VERSION.into(), hooks)) {
        Ok(server) => server,
        Err(e) => {
            rfd::MessageDialog::new()
                .set_level(rfd::MessageLevel::Error)
                .set_title("Falha de Inicialização — tImago")
                .set_description(format!(
                    "Não foi possível iniciar o servidor local do tImago.\n\nDetalhes:\n{e}"
                ))
                .show();
            return;
        }
    };
    let port = server.port;
    let _ = std::fs::write(data_dir.join(".port"), port.to_string());

    // 2. Preferências do usuário
    let (mut overlay_visible, mut start_with_windows, start_minimized) = {
        let core = server.core.lock();
        let s = core.settings();
        (
            core.is_overlay_visible(),
            crate::js::truthy(&s["startWithWindows"]),
            crate::js::truthy(&s["startMinimized"]),
        )
    };
    apply_login_item(start_with_windows);
    register_toast_app_id();
    let start_hidden = start_minimized || autostart;

    // 3. Janelas
    let (icon_rgba, icon_w, icon_h) = decode_icon();
    let window_icon = tao::window::Icon::from_rgba(icon_rgba.clone(), icon_w, icon_h).ok();
    let mut web_context = WebContext::new(Some(webview_data_dir()));

    let mut splash = (!autostart)
        .then(|| create_splash(&event_loop, &mut web_context, port, &proxy, window_icon.clone()))
        .flatten();
    let splash_started = Instant::now();

    let main_window = WindowBuilder::new()
        .with_title("tImago — Controle de Overlay OBS")
        .with_inner_size(LogicalSize::new(1460.0, 920.0))
        .with_min_inner_size(LogicalSize::new(1024.0, 700.0))
        .with_visible(false) // Inicialmente oculta até que o conteúdo esteja renderizado
        .with_background_color(WINDOW_BG)
        .with_window_icon(window_icon)
        .build(&event_loop)
        .expect("janela principal");

    let main_webview = WebViewBuilder::new_with_web_context(&mut web_context)
        .with_url(format!("http://localhost:{port}"))
        .with_background_color(WINDOW_BG)
        .with_devtools(cfg!(debug_assertions))
        .with_on_page_load_handler({
            let proxy = proxy.clone();
            move |event, _url| {
                if matches!(event, PageLoadEvent::Finished) {
                    let _ = proxy.send_event(UserEvent::MainLoaded);
                }
            }
        })
        // Abre links externos (target=_blank / window.open) no navegador padrão do sistema
        .with_new_window_req_handler(|url, _features| {
            if url.starts_with("http://") || url.starts_with("https://") {
                let _ = open::that(url);
            }
            NewWindowResponse::Deny
        })
        .build(&main_window);
    let main_webview = match main_webview {
        Ok(webview) => webview,
        Err(e) => {
            rfd::MessageDialog::new()
                .set_level(rfd::MessageLevel::Error)
                .set_title("WebView2 não encontrado — tImago")
                .set_description(format!(
                    "Não foi possível abrir a janela do painel porque o Microsoft Edge WebView2 Runtime \
                     não está disponível neste computador.\n\nInstale-o em \
                     https://go.microsoft.com/fwlink/p/?LinkId=2124703 e abra o tImago novamente.\n\nDetalhes: {e}"
                ))
                .show();
            runtime.block_on(server.stop());
            return;
        }
    };

    // 4. Bandeja do sistema
    let item_status = MenuItem::with_id("status", status_label(overlay_visible), false, None);
    let item_toggle = MenuItem::with_id("toggle", toggle_label(overlay_visible), true, None);
    let mut tray = build_tray(&proxy, &item_status, &item_toggle, tray_image(&icon_rgba, icon_w, icon_h), overlay_visible);

    // Fallback de segurança para exibir a janela caso o carregamento demore mais de 6s
    send_later(&runtime, &proxy, Duration::from_secs(6), UserEvent::MainLoaded);

    // Checagem silenciosa de novas versões no GitHub (8s após a inicialização)
    let server = Arc::new(server);
    runtime.spawn({
        let server = server.clone();
        let proxy = proxy.clone();
        async move {
            tokio::time::sleep(Duration::from_secs(8)).await;
            let info = server.check_for_updates(false).await;
            if crate::js::truthy(&info["available"]) {
                let _ = proxy.send_event(UserEvent::UpdateFound(info));
            }
        }
    });

    let mut reveal_scheduled = false;
    let _lock = lock; // mantém o arquivo travado enquanto o processo viver

    event_loop.run(move |event, _target, control_flow| {
        *control_flow = ControlFlow::Wait;

        let show_main = || {
            main_window.set_visible(true);
            main_window.set_minimized(false);
            main_window.set_focus();
        };
        let quit = |tray: &mut Option<TrayIcon>| -> ! {
            runtime.block_on(server.stop());
            tray.take(); // remove o ícone da bandeja antes de sair
            let _ = std::fs::remove_file(data_dir.join(".port"));
            std::process::exit(0);
        };

        match event {
            Event::UserEvent(event) => match event {
                UserEvent::SplashLoaded => {
                    eval_splash(&splash, 85, "Preparando painel e overlays...");
                }
                UserEvent::MainLoaded => {
                    if !reveal_scheduled {
                        reveal_scheduled = true;
                        // Transição suave da SplashScreen para a Janela Principal
                        let delay = if splash.is_some() {
                            eval_splash(&splash, 100, "Pronto! Abrindo Painel...");
                            MIN_SPLASH
                                .saturating_sub(splash_started.elapsed())
                                .max(Duration::from_millis(300))
                        } else {
                            Duration::ZERO
                        };
                        send_later(&runtime, &proxy, delay, UserEvent::Reveal);
                    }
                }
                UserEvent::Reveal => {
                    if let Some((_, webview)) = &splash {
                        let _ = webview.evaluate_script("if (window.fadeOutSplash) window.fadeOutSplash();");
                        send_later(&runtime, &proxy, Duration::from_millis(320), UserEvent::CloseSplash);
                    }
                    if !start_hidden {
                        show_main();
                    }
                }
                UserEvent::CloseSplash => splash = None,
                UserEvent::ShowMain => show_main(),
                UserEvent::Menu(id) => match id.as_str() {
                    "open" => show_main(),
                    "toggle" => {
                        // O hook de settings devolve o novo estado e atualiza a bandeja
                        server.core.lock().toggle_overlay_visibility();
                    }
                    "browser" => {
                        let _ = open::that(format!("http://localhost:{port}/overlay"));
                    }
                    "quit" => quit(&mut tray),
                    _ => {}
                },
                UserEvent::Settings { visible, start_with_windows: wants_login_item } => {
                    if wants_login_item != start_with_windows {
                        start_with_windows = wants_login_item;
                        apply_login_item(start_with_windows);
                    }
                    if visible != overlay_visible {
                        overlay_visible = visible;
                        item_status.set_text(status_label(visible));
                        item_toggle.set_text(toggle_label(visible));
                        if let Some(tray) = &tray {
                            let _ = tray.set_tooltip(Some(tooltip(visible)));
                        }
                    }
                }
                UserEvent::UpdateFound(info) => {
                    let _ = main_webview.evaluate_script(&format!(
                        "if (window.tImagoOnUpdateFound) window.tImagoOnUpdateFound({info});"
                    ));
                    notify_update(&proxy, info["latestVersion"].as_str().unwrap_or(""));
                }
                UserEvent::OpenUpdateModal => {
                    show_main();
                    let _ = main_webview
                        .evaluate_script("if (window.tImagoOpenUpdateModal) window.tImagoOpenUpdateModal();");
                }
                UserEvent::Quit => quit(&mut tray),
            },

            // Gerenciamento de Fechamento da Janela (Botão X)
            Event::WindowEvent { window_id, event: WindowEvent::CloseRequested, .. }
                if window_id == main_window.id() =>
            {
                let behavior = server.core.lock().settings()["closeBehavior"]
                    .as_str()
                    .filter(|b| !b.is_empty())
                    .unwrap_or("tray")
                    .to_string();

                if behavior == "tray" {
                    main_window.set_visible(false);
                    return;
                }
                if behavior == "ask" && server.core.lock().is_overlay_visible() {
                    let answer = rfd::MessageDialog::new()
                        .set_level(rfd::MessageLevel::Warning)
                        .set_title("Transmissão NO AR — tImago")
                        .set_description(
                            "O Overlay está marcado como NO AR (Visível).\n\n\
                             Deseja realmente fechar o tImago e encerrar o overlay no OBS Studio agora?",
                        )
                        .set_buttons(rfd::MessageButtons::YesNo)
                        .set_parent(&main_window)
                        .show();
                    if answer != rfd::MessageDialogResult::Yes {
                        return;
                    }
                }
                quit(&mut tray);
            }
            _ => {}
        }
    });
}

fn send_later(runtime: &tokio::runtime::Runtime, proxy: &Proxy, delay: Duration, event: UserEvent) {
    let proxy = proxy.clone();
    runtime.spawn(async move {
        tokio::time::sleep(delay).await;
        let _ = proxy.send_event(event);
    });
}

// ----------------------------------------------------------------------------
// SplashScreen
// ----------------------------------------------------------------------------

fn create_splash(
    event_loop: &EventLoop<UserEvent>,
    web_context: &mut WebContext,
    port: u16,
    proxy: &Proxy,
    icon: Option<tao::window::Icon>,
) -> Option<(Window, WebView)> {
    let size = LogicalSize::new(480.0, 290.0);
    let window = WindowBuilder::new()
        .with_title("tImago")
        .with_inner_size(size)
        .with_decorations(false)
        .with_transparent(true)
        .with_always_on_top(true)
        .with_resizable(false)
        .with_skip_taskbar(true)
        .with_undecorated_shadow(false)
        .with_visible(false)
        .with_window_icon(icon)
        .build(event_loop)
        .ok()?;

    // Centraliza no monitor principal
    if let Some(monitor) = window.primary_monitor() {
        let screen = monitor.size();
        let origin = monitor.position();
        let outer = window.outer_size();
        window.set_outer_position(PhysicalPosition::new(
            origin.x + (screen.width as i32 - outer.width as i32) / 2,
            origin.y + (screen.height as i32 - outer.height as i32) / 2,
        ));
    }
    window.set_visible(true);

    let webview = WebViewBuilder::new_with_web_context(web_context)
        .with_url(format!("http://localhost:{port}/splash.html?v={VERSION}"))
        .with_transparent(true)
        .with_on_page_load_handler({
            let proxy = proxy.clone();
            move |event, _url| {
                if matches!(event, PageLoadEvent::Finished) {
                    let _ = proxy.send_event(UserEvent::SplashLoaded);
                }
            }
        })
        .build(&window)
        .map_err(|e| eprintln!("Erro ao inicializar a splash: {e}"))
        .ok()?;
    Some((window, webview))
}

fn eval_splash(splash: &Option<(Window, WebView)>, percent: u8, message: &str) {
    if let Some((_, webview)) = splash {
        let message = Value::from(message);
        let _ = webview.evaluate_script(&format!(
            "if (window.setSplashProgress) window.setSplashProgress({percent}, {message});"
        ));
    }
}

// ----------------------------------------------------------------------------
// Bandeja do sistema
// ----------------------------------------------------------------------------

fn status_label(visible: bool) -> String {
    format!("Transmissão: {}", if visible { "NO AR (Visível)" } else { "OCULTO" })
}

fn toggle_label(visible: bool) -> &'static str {
    if visible {
        "Ocultar Overlay no OBS"
    } else {
        "Colocar Overlay NO AR"
    }
}

fn tooltip(visible: bool) -> String {
    format!("tImago — {}", if visible { "NO AR" } else { "Oculto" })
}

fn build_tray(
    proxy: &Proxy,
    item_status: &MenuItem,
    item_toggle: &MenuItem,
    icon: Option<tray_icon::Icon>,
    visible: bool,
) -> Option<TrayIcon> {
    let menu = Menu::new();
    let _ = menu.append_items(&[
        &MenuItem::with_id("open", "Abrir Painel de Controle", true, None),
        &PredefinedMenuItem::separator(),
        item_status,
        item_toggle,
        &MenuItem::with_id("browser", "Abrir Overlay no Navegador", true, None),
        &PredefinedMenuItem::separator(),
        &MenuItem::with_id("quit", "Encerrar tImago", true, None),
    ]);

    let mut builder = TrayIconBuilder::new()
        .with_menu(Box::new(menu))
        .with_menu_on_left_click(false)
        .with_tooltip(tooltip(visible));
    if let Some(icon) = icon {
        builder = builder.with_icon(icon);
    }
    let tray = builder
        .build()
        .map_err(|e| eprintln!("Erro ao inicializar a bandeja: {e}"))
        .ok()?;

    MenuEvent::set_event_handler(Some({
        let proxy = proxy.clone();
        move |event: MenuEvent| drop(proxy.send_event(UserEvent::Menu(event.id.0)))
    }));
    TrayIconEvent::set_event_handler(Some({
        let proxy = proxy.clone();
        move |event: TrayIconEvent| {
            let left_click = matches!(
                event,
                TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. }
                    | TrayIconEvent::DoubleClick { button: MouseButton::Left, .. }
            );
            if left_click {
                let _ = proxy.send_event(UserEvent::ShowMain);
            }
        }
    }));
    Some(tray)
}

// ----------------------------------------------------------------------------
// Ícones
// ----------------------------------------------------------------------------

/// Decodifica o PNG do aplicativo em RGBA 8-bit.
fn decode_icon() -> (Vec<u8>, u32, u32) {
    let decode = || -> Option<(Vec<u8>, u32, u32)> {
        let mut decoder = png::Decoder::new(std::io::Cursor::new(ICON_PNG));
        decoder.set_transformations(png::Transformations::normalize_to_color8());
        let mut reader = decoder.read_info().ok()?;
        let mut buf = vec![0; reader.output_buffer_size()?];
        let info = reader.next_frame(&mut buf).ok()?;
        buf.truncate(info.buffer_size());
        let rgba = match info.color_type {
            png::ColorType::Rgba => buf,
            png::ColorType::Rgb => buf.chunks_exact(3).flat_map(|p| [p[0], p[1], p[2], 255]).collect(),
            png::ColorType::GrayscaleAlpha => buf.chunks_exact(2).flat_map(|p| [p[0], p[0], p[0], p[1]]).collect(),
            png::ColorType::Grayscale => buf.iter().flat_map(|&g| [g, g, g, 255]).collect(),
            png::ColorType::Indexed => return None,
        };
        Some((rgba, info.width, info.height))
    };
    decode().unwrap_or_else(|| (vec![0; 4], 1, 1))
}

/// Reduz o ícone (média por blocos) para um tamanho adequado à bandeja.
fn tray_image(rgba: &[u8], width: u32, height: u32) -> Option<tray_icon::Icon> {
    const TARGET: u32 = 32;
    if width < TARGET || height < TARGET || width % TARGET != 0 || height % TARGET != 0 {
        return tray_icon::Icon::from_rgba(rgba.to_vec(), width, height).ok();
    }
    let (bx, by) = (width / TARGET, height / TARGET);
    let mut out = Vec::with_capacity((TARGET * TARGET * 4) as usize);
    for y in 0..TARGET {
        for x in 0..TARGET {
            let mut sum = [0u32; 4];
            for dy in 0..by {
                for dx in 0..bx {
                    let i = (((y * by + dy) * width + x * bx + dx) * 4) as usize;
                    let alpha = u32::from(rgba[i + 3]);
                    // Média ponderada pelo alfa para não escurecer as bordas
                    sum[0] += u32::from(rgba[i]) * alpha;
                    sum[1] += u32::from(rgba[i + 1]) * alpha;
                    sum[2] += u32::from(rgba[i + 2]) * alpha;
                    sum[3] += alpha;
                }
            }
            let n = bx * by;
            let alpha = sum[3].max(1);
            out.extend([
                (sum[0] / alpha) as u8,
                (sum[1] / alpha) as u8,
                (sum[2] / alpha) as u8,
                (sum[3] / n) as u8,
            ]);
        }
    }
    tray_icon::Icon::from_rgba(out, TARGET, TARGET).ok()
}

// ----------------------------------------------------------------------------
// Integração com o Windows
// ----------------------------------------------------------------------------

/// Pasta de dados do WebView2 (cache, localStorage do painel).
fn webview_data_dir() -> PathBuf {
    std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("tImago")
        .join("WebView2")
}

/// Liga/desliga o "Iniciar com o Windows" (HKCU\...\Run), abrindo oculto na bandeja.
fn apply_login_item(enabled: bool) {
    use winreg::enums::HKEY_CURRENT_USER;
    const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    // Nomes usados pela versão Electron (setLoginItemSettings)
    const LEGACY_NAMES: [&str; 2] = ["electron.app.tImago", APP_ID];

    let result = (|| -> std::io::Result<()> {
        let (run, _) = winreg::RegKey::predef(HKEY_CURRENT_USER).create_subkey(RUN_KEY)?;
        for legacy in LEGACY_NAMES {
            let _ = run.delete_value(legacy);
        }
        if enabled {
            let exe = std::env::current_exe()?;
            run.set_value("tImago", &format!("\"{}\" --autostart", exe.display()))
        } else {
            match run.delete_value("tImago") {
                Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e),
                _ => Ok(()),
            }
        }
    })();
    if let Err(e) = result {
        eprintln!("Erro ao configurar o início com o Windows: {e}");
    }
}

/// Registra o AppUserModelID para que as notificações apareçam como "tImago".
fn register_toast_app_id() {
    use winreg::enums::HKEY_CURRENT_USER;
    let path = format!(r"Software\Classes\AppUserModelId\{APP_ID}");
    if let Ok((key, _)) = winreg::RegKey::predef(HKEY_CURRENT_USER).create_subkey(path) {
        let _ = key.set_value("DisplayName", &"tImago");
    }
}

fn notify_update(proxy: &Proxy, latest_version: &str) {
    let proxy = proxy.clone();
    let shown = tauri_winrt_notification::Toast::new(APP_ID)
        .title("tImago — Nova Atualização Disponível")
        .text1(&format!(
            "A versão v{latest_version} está pronta para download e instalação."
        ))
        .on_activated(move |_action| {
            let _ = proxy.send_event(UserEvent::OpenUpdateModal);
            Ok(())
        })
        .show();
    if let Err(e) = shown {
        eprintln!("Erro ao exibir notificação de atualização: {e}");
    }
}

/// Segunda instância: pede para a que já está rodando trazer a janela para frente.
fn focus_running_instance(data_dir: &Path) {
    let port = std::fs::read_to_string(data_dir.join(".port"))
        .ok()
        .and_then(|p| p.trim().parse::<u16>().ok())
        .unwrap_or(crate::DEFAULT_PORT);
    let Ok(mut stream) = std::net::TcpStream::connect_timeout(
        &std::net::SocketAddr::from((std::net::Ipv4Addr::LOCALHOST, port)),
        Duration::from_secs(2),
    ) else {
        return;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let _ = stream.write_all(
        b"POST /api/app/show HTTP/1.1\r\nHost: localhost\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
    );
    let _ = stream.read(&mut [0u8; 64]);
}
