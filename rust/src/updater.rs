//! Motor de checagem, download e instalação de atualizações via GitHub Releases.

use crate::js::iso_now;
use futures_util::StreamExt;
use parking_lot::Mutex;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use tokio::io::AsyncWriteExt;
use tokio::sync::Notify;

const REPO_OWNER: &str = "TTreter";
const REPO_NAME: &str = "tImago";
/// 20 minutos de cache para evitar rate-limit da API do GitHub.
const CACHE_TTL: Duration = Duration::from_secs(20 * 60);

pub struct Updater {
    client: reqwest::Client,
    cache: Mutex<Option<(Instant, Value)>>,
    downloading: AtomicBool,
    cancel_flag: AtomicBool,
    cancel_signal: Notify,
    /// Instalador baixado por este processo — o único caminho que aceitamos executar.
    downloaded: Mutex<Option<PathBuf>>,
}

/// Converte "v1.3.0" / "1.4.2" em [major, minor, patch].
fn parse_semver(version: &str) -> [u64; 3] {
    let clean = version.trim().trim_start_matches(['v', 'V']);
    let mut parts = [0u64; 3];
    for (slot, piece) in parts.iter_mut().zip(clean.split('.')) {
        let digits: String = piece.chars().take_while(char::is_ascii_digit).collect();
        *slot = digits.parse().unwrap_or(0);
    }
    parts
}

/// `true` se `remote` for estritamente mais recente que `local`.
pub fn is_newer_version(remote: &str, local: &str) -> bool {
    parse_semver(remote) > parse_semver(local)
}

fn failure(current: &str, error: impl ToString) -> Value {
    json!({
        "available": false,
        "updateAvailable": false,
        "currentVersion": current,
        "error": error.to_string(),
        "lastCheckedAt": iso_now(),
    })
}

impl Updater {
    pub fn new() -> Updater {
        let client = reqwest::Client::builder()
            .user_agent("tImago-Broadcast-App")
            .connect_timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_default();
        Updater {
            client,
            cache: Mutex::new(None),
            downloading: AtomicBool::new(false),
            cancel_flag: AtomicBool::new(false),
            cancel_signal: Notify::new(),
            downloaded: Mutex::new(None),
        }
    }

    pub fn is_downloading(&self) -> bool {
        self.downloading.load(Ordering::SeqCst)
    }

    /// Consulta a release mais recente no GitHub.
    pub async fn check(&self, current: &str, force: bool) -> Value {
        if !force {
            if let Some((at, info)) = self.cache.lock().as_ref() {
                if at.elapsed() < CACHE_TTL {
                    return info.clone();
                }
            }
        }

        let url = format!("https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/releases/latest");
        let response = self
            .client
            .get(url)
            .header("Accept", "application/vnd.github.v3+json")
            .timeout(Duration::from_secs(10))
            .send()
            .await;
        let response = match response {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[Updater] Falha na requisição HTTPS ao GitHub: {e}");
                return failure(current, e);
            }
        };
        if !response.status().is_success() {
            let status = response.status().as_u16();
            eprintln!("[Updater] GitHub API retornou status {status}");
            return failure(current, format!("Status HTTP {status}"));
        }
        let data: Value = match response.json().await {
            Ok(d) => d,
            Err(e) => {
                eprintln!("[Updater] Erro ao processar resposta do GitHub: {e}");
                return failure(current, e);
            }
        };

        let tag = data["tag_name"].as_str().unwrap_or("");
        let has_update = is_newer_version(tag, current);

        let mut setup_asset = Value::Null;
        let mut portable_asset = Value::Null;
        for asset in data["assets"].as_array().into_iter().flatten() {
            let name = asset["name"].as_str().unwrap_or("");
            let lower = name.to_lowercase();
            if !lower.ends_with(".exe") {
                continue;
            }
            let entry = json!({
                "name": name,
                "size": asset["size"],
                "downloadUrl": asset["browser_download_url"],
            });
            if lower.contains("setup") || lower.contains("installer") {
                setup_asset = entry;
            } else if lower.contains("portable") {
                portable_asset = entry;
            }
        }

        let or = |v: &Value, fallback: String| v.as_str().filter(|s| !s.is_empty()).map_or(fallback, str::to_string);
        let info = json!({
            "available": has_update,
            "updateAvailable": has_update,
            "currentVersion": current,
            "latestVersion": tag.trim_start_matches(['v', 'V']),
            "rawTag": tag,
            "releaseName": or(&data["name"], tag.to_string()),
            "releaseNotes": or(&data["body"], "Nenhuma nota de versão fornecida.".into()),
            "publishedAt": data["published_at"].as_str().unwrap_or(""),
            "releaseUrl": or(&data["html_url"], format!("https://github.com/{REPO_OWNER}/{REPO_NAME}/releases")),
            "setupAsset": setup_asset,
            "portableAsset": portable_asset,
            "lastCheckedAt": iso_now(),
        });

        *self.cache.lock() = Some((Instant::now(), info.clone()));
        info
    }

    /// Baixa o instalador da release em streaming para `%TEMP%\tImago-update`.
    /// `on_progress` recebe `{ percent, transferredBytes, totalBytes, speedBytesPerSec }`.
    pub async fn download(
        &self,
        url: &str,
        file_name: &str,
        on_progress: impl Fn(Value),
    ) -> Result<PathBuf, String> {
        if self.downloading.swap(true, Ordering::SeqCst) {
            return Err("Já existe um download em andamento.".into());
        }
        self.cancel_flag.store(false, Ordering::SeqCst);
        *self.downloaded.lock() = None;

        // Usa apenas o nome-base do asset: nada de separadores de caminho vindos da rede
        let safe_name: String = file_name
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
            .collect();
        let dir = std::env::temp_dir().join("tImago-update");
        let dest = dir.join(if safe_name.is_empty() { "tImago-Setup.exe".into() } else { safe_name });

        let result = self.download_to(url, &dir, &dest, on_progress).await;
        self.downloading.store(false, Ordering::SeqCst);
        match result {
            Ok(()) => {
                *self.downloaded.lock() = Some(dest.clone());
                Ok(dest)
            }
            Err(e) => {
                let _ = tokio::fs::remove_file(&dest).await;
                Err(e)
            }
        }
    }

    async fn download_to(
        &self,
        url: &str,
        dir: &PathBuf,
        dest: &PathBuf,
        on_progress: impl Fn(Value),
    ) -> Result<(), String> {
        tokio::fs::create_dir_all(dir).await.map_err(|e| e.to_string())?;

        let response = self
            .client
            .get(url)
            .header("User-Agent", "tImago-Broadcast-App-Downloader")
            .header("Accept", "*/*")
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !response.status().is_success() {
            return Err(format!(
                "Servidor de download retornou código HTTP {}",
                response.status().as_u16()
            ));
        }

        let total = response.content_length().unwrap_or(0);
        let mut file = tokio::fs::File::create(dest).await.map_err(|e| e.to_string())?;
        let mut stream = response.bytes_stream();

        let mut transferred: u64 = 0;
        let mut last_report = Instant::now();
        let mut last_sample: u64 = 0;

        loop {
            if self.cancel_flag.load(Ordering::SeqCst) {
                return Err("Download cancelado.".into());
            }
            let chunk = tokio::select! {
                chunk = stream.next() => chunk,
                _ = self.cancel_signal.notified() => return Err("Download cancelado.".into()),
            };
            let Some(chunk) = chunk else { break };
            let chunk = chunk.map_err(|e| e.to_string())?;
            file.write_all(&chunk).await.map_err(|e| e.to_string())?;
            transferred += chunk.len() as u64;

            let elapsed = last_report.elapsed();
            if elapsed >= Duration::from_millis(300) {
                let speed = ((transferred - last_sample) as f64 / elapsed.as_secs_f64()).round() as u64;
                last_report = Instant::now();
                last_sample = transferred;
                let percent = if total > 0 {
                    ((transferred as f64 / total as f64) * 100.0).round().min(100.0) as u64
                } else {
                    0
                };
                on_progress(json!({
                    "percent": percent,
                    "transferredBytes": transferred,
                    "totalBytes": total,
                    "speedBytesPerSec": speed,
                }));
            }
        }

        file.flush().await.map_err(|e| e.to_string())?;
        drop(file);

        let final_total = if total > 0 { total } else { transferred };
        on_progress(json!({
            "percent": 100,
            "transferredBytes": final_total,
            "totalBytes": final_total,
            "speedBytesPerSec": 0,
        }));
        Ok(())
    }

    /// Cancela o download ativo em andamento.
    pub fn cancel(&self) {
        if self.is_downloading() {
            self.cancel_flag.store(true, Ordering::SeqCst);
            self.cancel_signal.notify_waiters();
        }
    }

    /// Dispara o instalador baixado como processo independente.
    ///
    /// Diferente da versão Node, o caminho informado pelo cliente só é aceito se
    /// for exatamente o arquivo que este processo acabou de baixar — assim nenhum
    /// dispositivo da rede consegue mandar o host executar um arquivo arbitrário.
    pub fn launch_installer(&self, requested: &str) -> Result<(), String> {
        let downloaded = self.downloaded.lock().clone();
        let Some(path) = downloaded.filter(|p| p.as_os_str() == requested) else {
            return Err("Instalador não reconhecido. Baixe a atualização novamente.".into());
        };
        if !path.exists() {
            return Err(format!("Arquivo instalador não encontrado em: {}", path.display()));
        }

        let mut command = std::process::Command::new(&path);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const DETACHED_PROCESS: u32 = 0x0000_0008;
            const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
            command.creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);
        }
        command.spawn().map(drop).map_err(|e| e.to_string())
    }
}
