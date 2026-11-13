//! tImago — Broadcast Overlay Controller for OBS Studio (edição Rust).
//!
//! Um único executável nativo:
//! - `tImago.exe`             → aplicativo desktop (janela WebView2 + bandeja do sistema)
//! - `tImago.exe --headless`  → somente o servidor (equivalente ao antigo `npm start`)
//! - `tImago.exe --autostart` → usado pelo "Iniciar com o Windows" (abre oculto na bandeja)

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod desktop;
mod engine;
mod js;
mod net;
mod server;
mod state;
mod updater;

use std::path::PathBuf;
use std::sync::Arc;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const DEFAULT_PORT: u16 = 3000;

/// Pasta de persistência: `TIMAGO_DATA_DIR` ou `%APPDATA%\tImago\data`
/// (a mesma usada pela versão Electron, preservando playlists e configurações).
pub fn data_dir() -> PathBuf {
    if let Some(dir) = std::env::var_os("TIMAGO_DATA_DIR").filter(|d| !d.is_empty()) {
        return PathBuf::from(dir);
    }
    match std::env::var_os("APPDATA") {
        Some(appdata) => PathBuf::from(appdata).join("tImago").join("data"),
        None => PathBuf::from("data"),
    }
}

pub fn preferred_port() -> u16 {
    std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(DEFAULT_PORT)
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let has = |flag: &str| args.iter().any(|a| a == flag);

    if has("--version") {
        println!("tImago {VERSION}");
        return;
    }

    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .expect("runtime tokio");

    if has("--headless") {
        runtime.block_on(run_headless());
    } else {
        desktop::run(runtime, has("--autostart"));
    }
}

async fn run_headless() {
    let quit = Arc::new(tokio::sync::Notify::new());
    let on_quit: server::QuitHook = {
        let quit = quit.clone();
        Arc::new(move || quit.notify_one())
    };

    let hooks = server::Hooks { on_settings: None, on_quit, on_show: None };
    let server = match server::Server::start(data_dir(), preferred_port(), VERSION.into(), hooks).await {
        Ok(server) => server,
        Err(e) => {
            eprintln!("Não foi possível iniciar o servidor local do tImago: {e}");
            std::process::exit(1);
        }
    };

    tokio::select! {
        _ = tokio::signal::ctrl_c() => {}
        _ = quit.notified() => {}
    }
    server.stop().await;
}
