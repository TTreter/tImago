//! Servidor HTTP + Socket.IO: serve o Painel (`/`, `/admin`), o Overlay do OBS
//! (`/overlay`) e a página pública (`/participar`), e sincroniza todos os
//! clientes em tempo real.

use crate::engine::{Client, Core, Outbox, SettingsHook, Shared};
use crate::net::{self, Mdns};
use crate::updater::Updater;
use axum::extract::{ConnectInfo, State};
use axum::http::{header, HeaderMap, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use rust_embed::RustEmbed;
use serde_json::{json, Value};
use socketioxide::extract::{Event, SocketRef, TryData};
use socketioxide::SocketIo;
use std::net::{Ipv4Addr, Ipv6Addr, SocketAddr};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, Notify};

/// Interfaces web embutidas no executável (em debug são lidas direto do disco).
#[derive(RustEmbed)]
#[folder = "../public/"]
struct Public;

/// Cliente oficial do Socket.IO, servido em `/socket.io/socket.io.js`.
const SOCKET_IO_CLIENT: &str = include_str!("../assets/socket.io.min.js");

pub type QuitHook = Arc<dyn Fn() + Send + Sync>;

/// Ganchos que ligam o servidor à casca que o hospeda (desktop ou headless).
pub struct Hooks {
    /// Chamado sempre que as configurações mudam (bandeja, iniciar com o Windows).
    pub on_settings: Option<SettingsHook>,
    /// Encerra o aplicativo (após disparar o instalador de uma atualização).
    pub on_quit: QuitHook,
    /// Traz a janela principal para frente (segunda instância aberta).
    pub on_show: Option<QuitHook>,
}

struct App {
    core: Shared,
    out: Outbox,
    updater: Updater,
    version: String,
    on_quit: QuitHook,
    on_show: Option<QuitHook>,
}

pub struct Server {
    pub core: Shared,
    pub port: u16,
    app: Arc<App>,
    io: SocketIo,
    shutdown: Arc<Notify>,
    _mdns: Option<Mdns>,
}

impl Server {
    /// Sobe o servidor na porta preferida (ou na próxima livre, até +20).
    pub async fn start(
        data_dir: PathBuf,
        preferred_port: u16,
        version: String,
        hooks: Hooks,
    ) -> Result<Server, String> {
        let (listener, port) = bind(preferred_port)?;

        let (out, mut outbox) = mpsc::unbounded_channel::<(&'static str, Value)>();
        let core = Core::new_shared(data_dir, version.clone(), out.clone(), hooks.on_settings);
        core.lock().port = port;

        let app = Arc::new(App {
            core: core.clone(),
            out,
            updater: Updater::new(),
            version,
            on_quit: hooks.on_quit,
            on_show: hooks.on_show,
        });

        let (layer, io) = SocketIo::builder().max_payload(5_000_000).build_layer();
        io.ns("/", {
            let app = app.clone();
            move |socket: SocketRef, TryData::<Value>(auth)| {
                let app = app.clone();
                async move { on_connect(app, socket, auth.ok()) }
            }
        });

        let router = Router::new()
            .route("/api/auth/status", get(auth_status))
            .route("/api/app/show", post(app_show))
            .fallback(static_files)
            .layer(layer)
            // Fora da camada Socket.IO, que intercepta todo o prefixo /socket.io/
            .route("/socket.io/socket.io.js", get(socket_io_client))
            .with_state(app.clone());

        // Difusão: drena as mensagens geradas pelo motor para todos os clientes
        tokio::spawn({
            let io = io.clone();
            async move {
                while let Some((event, data)) = outbox.recv().await {
                    let _ = io.emit(event, &data).await;
                }
            }
        });

        // Persistência: debounce de 150ms + escrita atômica
        tokio::spawn({
            let core = core.clone();
            let signal = core.lock().save_signal.clone();
            async move {
                loop {
                    signal.notified().await;
                    loop {
                        tokio::select! {
                            _ = tokio::time::sleep(Duration::from_millis(150)) => break,
                            _ = signal.notified() => {}
                        }
                    }
                    let (json, dir) = {
                        let core = core.lock();
                        (core.snapshot_json(), core.data_dir.clone())
                    };
                    let written = tokio::task::spawn_blocking(move || crate::state::write_atomic(&dir, &json)).await;
                    if let Ok(Err(e)) = written {
                        eprintln!("Erro ao salvar state.json de forma atômica: {e}");
                    }
                }
            }
        });

        // Cronômetro do placar
        tokio::spawn({
            let core = core.clone();
            async move {
                let mut interval = tokio::time::interval(Duration::from_secs(1));
                loop {
                    interval.tick().await;
                    core.lock().tick_scoreboard();
                }
            }
        });

        let shutdown = Arc::new(Notify::new());
        tokio::spawn({
            let shutdown = shutdown.clone();
            async move {
                let service = router.into_make_service_with_connect_info::<SocketAddr>();
                let served = axum::serve(listener, service)
                    .with_graceful_shutdown(async move { shutdown.notified().await })
                    .await;
                if let Err(e) = served {
                    eprintln!("[tImago] Servidor HTTP encerrado com erro: {e}");
                }
            }
        });

        let local_ip = net::local_ip();
        println!("====================================================");
        println!("[tImago] SISTEMA DE OVERLAY OBS INICIADO");
        println!("[PC]       Painel de Controle:   http://localhost:{port}");
        println!("[mDNS]     Domínio Amigável:     http://timago.local:{port}");
        println!("[PÚBLICO]  Envio Audiência:      http://timago.local:{port}/participar");
        println!("[REDE]     Painel no Celular:    http://{local_ip}:{port}");
        println!("[OBS]      Browser Source:       http://localhost:{port}/overlay");
        println!("====================================================");

        let mdns = Mdns::start(port);
        core.lock().sync_engine_with_settings(true);

        Ok(Server { core, port, app, io, shutdown, _mdns: mdns })
    }

    /// Checagem de atualização usada pela casca desktop.
    pub async fn check_for_updates(&self, force: bool) -> Value {
        self.app.updater.check(&self.app.version, force).await
    }

    /// Grava o estado, avisa os clientes (inclusive o Overlay no OBS) e encerra o servidor.
    pub async fn stop(&self) {
        self.core.lock().save_now();
        let _ = self.io.emit("app:shutdown", &Value::Null).await;
        tokio::time::sleep(Duration::from_millis(150)).await;
        self.shutdown.notify_waiters();
    }
}

/// Tenta escutar em `[::]:porta` (dual-stack, como o Node) e cai para IPv4 se preciso.
fn bind(preferred: u16) -> Result<(tokio::net::TcpListener, u16), String> {
    use socket2::{Domain, Socket, Type};

    let try_bind = |port: u16| -> std::io::Result<std::net::TcpListener> {
        let dual = Socket::new(Domain::IPV6, Type::STREAM, None).and_then(|socket| {
            socket.set_only_v6(false)?;
            socket.bind(&SocketAddr::from((Ipv6Addr::UNSPECIFIED, port)).into())?;
            Ok(socket)
        });
        let socket = match dual {
            Ok(socket) => socket,
            Err(e) if e.kind() == std::io::ErrorKind::AddrInUse => return Err(e),
            Err(_) => {
                let socket = Socket::new(Domain::IPV4, Type::STREAM, None)?;
                socket.bind(&SocketAddr::from((Ipv4Addr::UNSPECIFIED, port)).into())?;
                socket
            }
        };
        socket.listen(1024)?;
        socket.set_nonblocking(true)?;
        Ok(socket.into())
    };

    let last = preferred.saturating_add(20);
    for port in preferred..=last {
        match try_bind(port) {
            Ok(listener) => {
                let listener = tokio::net::TcpListener::from_std(listener).map_err(|e| e.to_string())?;
                return Ok((listener, port));
            }
            Err(e) if e.kind() == std::io::ErrorKind::AddrInUse => {
                eprintln!("[tImago] Porta {port} ocupada por outro processo. Tentando porta {}...", port + 1);
            }
            Err(e) => return Err(e.to_string()),
        }
    }
    Err(format!("Não foi possível encontrar uma porta livre entre {preferred} e {last}"))
}

// ----------------------------------------------------------------------------
// Rotas HTTP
// ----------------------------------------------------------------------------

/// Endpoint leve para verificação do status de autenticação e identificação de Host Local.
async fn auth_status(State(app): State<Arc<App>>, ConnectInfo(addr): ConnectInfo<SocketAddr>) -> Json<Value> {
    let is_local = net::is_local_host(addr.ip());
    Json(app.core.lock().auth_status(is_local))
}

/// Usado pela segunda instância do aplicativo para focar a janela da primeira.
async fn app_show(State(app): State<Arc<App>>, ConnectInfo(addr): ConnectInfo<SocketAddr>) -> StatusCode {
    if !addr.ip().to_canonical().is_loopback() {
        return StatusCode::FORBIDDEN;
    }
    match &app.on_show {
        Some(show) => {
            show();
            StatusCode::NO_CONTENT
        }
        None => StatusCode::NOT_FOUND,
    }
}

async fn socket_io_client() -> impl IntoResponse {
    (
        [
            (header::CONTENT_TYPE, "application/javascript; charset=utf-8"),
            (header::CACHE_CONTROL, "public, max-age=86400"),
        ],
        SOCKET_IO_CLIENT,
    )
}

async fn static_files(uri: Uri, headers: HeaderMap) -> Response {
    let path = match uri.path().trim_start_matches('/') {
        "" | "admin" => "index.html",
        "overlay" => "overlay.html",
        "participar" => "participar.html",
        other => other,
    };
    let Some(file) = Public::get(path) else {
        return (StatusCode::NOT_FOUND, "Not Found").into_response();
    };

    let etag = format!("\"{}\"", crate::js::hex(&file.metadata.sha256_hash()[..12]));
    if headers.get(header::IF_NONE_MATCH).and_then(|v| v.to_str().ok()) == Some(etag.as_str()) {
        return StatusCode::NOT_MODIFIED.into_response();
    }

    let mime = mime_guess::from_path(path).first_or_octet_stream();
    let content_type = if mime.type_() == "text" || mime.subtype() == "javascript" {
        format!("{mime}; charset=utf-8")
    } else {
        mime.to_string()
    };
    (
        [
            (header::CONTENT_TYPE, content_type),
            (header::ETAG, etag),
            (header::CACHE_CONTROL, "public, max-age=0".to_string()),
        ],
        file.data.into_owned(),
    )
        .into_response()
}

// ----------------------------------------------------------------------------
// Socket.IO
// ----------------------------------------------------------------------------

fn on_connect(app: Arc<App>, socket: SocketRef, auth: Option<Value>) {
    let ip = socket
        .req_parts()
        .extensions
        .get::<ConnectInfo<SocketAddr>>()
        .map(|info| info.0.ip().to_canonical());
    let client = Arc::new(Client {
        // Sem endereço conhecido tratamos como local, igual ao servidor Node
        is_local: ip.is_none_or(net::is_local_host),
        ip: ip.map(|ip| ip.to_string()).unwrap_or_default(),
        token: auth.and_then(|a| a["token"].as_str().map(str::to_string)),
    });

    {
        let core = app.core.lock();
        let _ = socket.emit("state:sync", &core.sync_payload(Some(client.is_local)));
        let _ = socket.emit("scoreboard:sync", &core.scoreboard_json());
    }

    socket.on_fallback(move |socket: SocketRef, Event(event): Event, TryData::<Value>(data)| {
        let data = data.unwrap_or(Value::Null);
        let is_updater = event.starts_with("updater:");

        // IMPORTANTE: o socketioxide chama este closure em ordem, na tarefa de
        // leitura da conexão, e só o future devolvido vai para uma tarefa nova.
        // Tratar o evento aqui (de forma síncrona) preserva a ordem de chegada,
        // como no Node — dentro do `async` dois cliques rápidos poderiam inverter.
        if !is_updater {
            let replies = app.core.lock().handle(&client, &event, &data);
            for (event, payload) in replies {
                let _ = socket.emit(event, &payload);
            }
        }

        let app = app.clone();
        async move {
            if is_updater {
                on_updater_event(app, socket, &event, &data).await;
            }
        }
    });
}

async fn on_updater_event(app: Arc<App>, socket: SocketRef, event: &str, data: &Value) {
    let error = |message: String| json!({ "message": message });
    match event {
        "updater:check" => {
            let force = crate::js::truthy(&data["force"]);
            let info = app.updater.check(&app.version, force).await;
            let _ = socket.emit("updater:status", &info);
        }
        "updater:startDownload" => {
            if app.updater.is_downloading() {
                let _ = socket.emit("updater:error", &error("Já existe um download em andamento.".into()));
                return;
            }
            let info = app.updater.check(&app.version, false).await;
            let Some(url) = info["setupAsset"]["downloadUrl"].as_str().filter(|u| !u.is_empty()) else {
                let _ = socket.emit(
                    "updater:error",
                    &error("Executável do instalador não encontrado na release mais recente.".into()),
                );
                return;
            };
            let latest = info["latestVersion"].as_str().unwrap_or("").to_string();
            let file_name = info["setupAsset"]["name"]
                .as_str()
                .filter(|n| !n.is_empty())
                .map_or_else(|| format!("tImago-Setup-{latest}.exe"), str::to_string);

            let progress_out = app.out.clone();
            let result = app
                .updater
                .download(url, &file_name, move |progress| {
                    let _ = progress_out.send(("updater:progress", progress));
                })
                .await;
            let _ = match result {
                Ok(path) => app.out.send((
                    "updater:downloadComplete",
                    json!({
                        "installerPath": path.to_string_lossy(),
                        "version": latest,
                        "fileName": file_name,
                    }),
                )),
                Err(e) if e == "Download cancelado." => Ok(()),
                Err(e) => app.out.send(("updater:error", error(format!("Erro ao baixar atualização: {e}")))),
            };
        }
        "updater:cancelDownload" => {
            app.updater.cancel();
            let _ = app.out.send(("updater:cancelled", Value::Null));
        }
        "updater:installNow" | "updater:launchInstaller" => {
            let Some(path) = data["installerPath"].as_str() else { return };
            match app.updater.launch_installer(path) {
                Ok(()) => {
                    // Dá tempo do instalador subir antes de encerrar o tImago
                    tokio::time::sleep(Duration::from_millis(400)).await;
                    (app.on_quit)();
                }
                Err(e) => {
                    let _ = socket.emit("updater:error", &error(e));
                }
            }
        }
        _ => {}
    }
}
