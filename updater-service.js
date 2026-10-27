/**
 * ============================================================================
 * tImago — Broadcast Overlay Controller for OBS Studio
 * Arquivo: updater-service.js (Motor de Checagem, Download e Atualização)
 * ============================================================================
 * Responsabilidades:
 * 1. Consultar a API pública de Releases do GitHub (api.github.com).
 * 2. Comparar versões semânticas (SemVer) e identificar novos lançamentos.
 * 3. Baixar em streaming o instalador (.exe) no diretório temporário (%TEMP%).
 * 4. Acompanhar redirects HTTP 302 da CDN do GitHub e emitir progresso em tempo real.
 * 5. Disparar o instalador de forma desacoplada e encerrar o tImago com segurança.
 * ============================================================================
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const REPO_OWNER = 'TTreter';
const REPO_NAME = 'tImago';
const RELEASES_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

let cachedUpdateInfo = null;
let lastCheckTimestamp = 0;
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutos de cache para evitar rate-limit

let activeDownloadRequest = null;
let activeDownloadWriteStream = null;
let isDownloading = false;

/**
 * Converte string de versão ("v1.3.0", "1.4.2") em array numérico [major, minor, patch]
 */
function parseSemver(verStr) {
  if (!verStr || typeof verStr !== 'string') return [0, 0, 0];
  const clean = verStr.replace(/^v/i, '').trim();
  const parts = clean.split('.').map((p) => {
    const num = parseInt(p, 10);
    return isNaN(num) ? 0 : num;
  });
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
}

/**
 * Retorna true se remoteVer for estritamente mais recente que localVer
 */
function isNewerVersion(remoteVer, localVer) {
  const [rMaj, rMin, rPat] = parseSemver(remoteVer);
  const [lMaj, lMin, lPat] = parseSemver(localVer);

  if (rMaj > lMaj) return true;
  if (rMaj < lMaj) return false;
  if (rMin > lMin) return true;
  if (rMin < lMin) return false;
  return rPat > lPat;
}

/**
 * Consulta a API do GitHub Releases para buscar informações da versão mais recente
 */
function checkForUpdates(currentVersion, force = false) {
  return new Promise((resolve) => {
    const now = Date.now();
    if (!force && cachedUpdateInfo && now - lastCheckTimestamp < CACHE_TTL_MS) {
      return resolve(cachedUpdateInfo);
    }

    const options = {
      headers: {
        'User-Agent': 'tImago-Broadcast-App',
        Accept: 'application/vnd.github.v3+json'
      },
      timeout: 10000
    };

    const req = https.get(RELEASES_API_URL, options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.warn(`[Updater] GitHub API retornou status ${res.statusCode}`);
            return resolve({
              available: false,
              updateAvailable: false,
              currentVersion,
              error: `Status HTTP ${res.statusCode}`,
              lastCheckedAt: new Date().toISOString()
            });
          }

          const data = JSON.parse(body);
          const remoteTag = data.tag_name || '';
          const hasUpdate = isNewerVersion(remoteTag, currentVersion);

          let setupAsset = null;
          let portableAsset = null;

          if (Array.isArray(data.assets)) {
            data.assets.forEach((asset) => {
              const nameLower = (asset.name || '').toLowerCase();
              if (nameLower.endsWith('.exe')) {
                if (nameLower.includes('setup') || nameLower.includes('installer')) {
                  setupAsset = {
                    name: asset.name,
                    size: asset.size,
                    downloadUrl: asset.browser_download_url
                  };
                } else if (nameLower.includes('portable')) {
                  portableAsset = {
                    name: asset.name,
                    size: asset.size,
                    downloadUrl: asset.browser_download_url
                  };
                }
              }
            });
          }

          const result = {
            available: hasUpdate,
            updateAvailable: hasUpdate,
            currentVersion,
            latestVersion: remoteTag.replace(/^v/i, ''),
            rawTag: remoteTag,
            releaseName: data.name || remoteTag,
            releaseNotes: data.body || 'Nenhuma nota de versão fornecida.',
            publishedAt: data.published_at || '',
            releaseUrl: data.html_url || `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`,
            setupAsset,
            portableAsset,
            lastCheckedAt: new Date().toISOString()
          };

          cachedUpdateInfo = result;
          lastCheckTimestamp = now;
          resolve(result);
        } catch (err) {
          console.warn('[Updater] Erro ao processar resposta do GitHub:', err.message);
          resolve({
            available: false,
            updateAvailable: false,
            currentVersion,
            error: err.message,
            lastCheckedAt: new Date().toISOString()
          });
        }
      });
    });

    req.on('error', (err) => {
      console.warn('[Updater] Falha na requisição HTTPS ao GitHub:', err.message);
      resolve({
        available: false,
        updateAvailable: false,
        currentVersion,
        error: err.message,
        lastCheckedAt: new Date().toISOString()
      });
    });

    req.on('timeout', () => {
      req.destroy();
      console.warn('[Updater] Timeout ao consultar GitHub Releases');
      resolve({
        available: false,
        currentVersion,
        error: 'Timeout na conexão',
        lastCheckedAt: new Date().toISOString()
      });
    });
  });
}

/**
 * Realiza o download de arquivo com suporte nativo a redirecionamentos HTTP 301/302/307/308
 */
function downloadFileWithRedirects(targetUrl, destFilePath, onProgress) {
  return new Promise((resolve, reject) => {
    isDownloading = true;

    function executeGet(currentUrl, redirectCount = 0) {
      if (redirectCount > 8) {
        isDownloading = false;
        return reject(new Error('Muitos redirecionamentos ao baixar o instalador.'));
      }

      const client = currentUrl.startsWith('https:') ? https : http;
      const parsedUrl = new URL(currentUrl);

      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
          'User-Agent': 'tImago-Broadcast-App-Downloader',
          Accept: '*/*'
        }
      };

      const req = client.get(reqOptions, (res) => {
        // Trata códigos de redirecionamento HTTP
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, currentUrl).href;
          return executeGet(nextUrl, redirectCount + 1);
        }

        if (res.statusCode !== 200) {
          isDownloading = false;
          return reject(new Error(`Servidor de download retornou código HTTP ${res.statusCode}`));
        }

        const totalBytes = parseInt(res.headers['content-length'], 10) || 0;
        let transferredBytes = 0;
        let lastReportTime = Date.now();
        let lastTransferredSample = 0;
        let speedBytesPerSec = 0;

        activeDownloadWriteStream = fs.createWriteStream(destFilePath);

        res.on('data', (chunk) => {
          transferredBytes += chunk.length;
          activeDownloadWriteStream.write(chunk);

          const now = Date.now();
          const elapsed = now - lastReportTime;
          if (elapsed >= 300) {
            const bytesSinceLast = transferredBytes - lastTransferredSample;
            speedBytesPerSec = Math.round((bytesSinceLast / elapsed) * 1000);
            lastReportTime = now;
            lastTransferredSample = transferredBytes;

            const percent = totalBytes > 0 ? Math.min(100, Math.round((transferredBytes / totalBytes) * 100)) : 0;
            if (onProgress) {
              onProgress({
                percent,
                transferredBytes,
                totalBytes,
                speedBytesPerSec
              });
            }
          }
        });

        res.on('end', () => {
          if (activeDownloadWriteStream) {
            activeDownloadWriteStream.end(() => {
              isDownloading = false;
              activeDownloadRequest = null;
              activeDownloadWriteStream = null;

              if (onProgress) {
                onProgress({
                  percent: 100,
                  transferredBytes: totalBytes || transferredBytes,
                  totalBytes: totalBytes || transferredBytes,
                  speedBytesPerSec: 0
                });
              }

              resolve(destFilePath);
            });
          } else {
            isDownloading = false;
            activeDownloadRequest = null;
            resolve(destFilePath);
          }
        });

        res.on('error', (err) => {
          isDownloading = false;
          activeDownloadRequest = null;
          if (activeDownloadWriteStream) {
            activeDownloadWriteStream.close();
            activeDownloadWriteStream = null;
          }
          fs.unlink(destFilePath, () => {});
          reject(err);
        });
      });

      activeDownloadRequest = req;

      req.on('error', (err) => {
        isDownloading = false;
        activeDownloadRequest = null;
        if (activeDownloadWriteStream) {
          activeDownloadWriteStream.close();
          activeDownloadWriteStream = null;
        }
        fs.unlink(destFilePath, () => {});
        reject(err);
      });
    }

    executeGet(targetUrl);
  });
}

/**
 * Cancela o download ativo em andamento
 */
function cancelDownload() {
  if (activeDownloadRequest) {
    try {
      activeDownloadRequest.destroy();
    } catch (e) {}
    activeDownloadRequest = null;
  }
  if (activeDownloadWriteStream) {
    try {
      activeDownloadWriteStream.close();
    } catch (e) {}
    activeDownloadWriteStream = null;
  }
  isDownloading = false;
}

/**
 * Dispara o instalador de forma totalmente desacoplada e invoca callback para encerrar o app
 */
function launchInstallerAndQuit(installerPath, quitCallback) {
  if (!fs.existsSync(installerPath)) {
    throw new Error(`Arquivo instalador não encontrado em: ${installerPath}`);
  }

  // Executa o setup.exe como processo independente desacoplado
  const child = spawn(installerPath, [], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  // Executa o fechamento do servidor e do Electron
  if (typeof quitCallback === 'function') {
    setTimeout(() => {
      quitCallback();
    }, 400);
  }
}

/**
 * Registra os eventos de WebSocket do Atualizador
 */
function registerUpdaterSocketEvents(io, socket, getAppVersion, onQuitApp) {
  socket.on('updater:check', async (payload) => {
    const force = Boolean(payload?.force);
    const ver = getAppVersion();
    const info = await checkForUpdates(ver, force);
    socket.emit('updater:status', info);
  });

  socket.on('updater:startDownload', async (payload) => {
    if (isDownloading) {
      socket.emit('updater:error', { message: 'Já existe um download em andamento.' });
      return;
    }

    const currentVer = getAppVersion();
    const info = await checkForUpdates(currentVer, false);
    const setupAsset = info?.setupAsset;

    if (!setupAsset || !setupAsset.downloadUrl) {
      socket.emit('updater:error', { message: 'Executável do instalador não encontrado na release mais recente.' });
      return;
    }

    const tempDir = path.join(os.tmpdir(), 'tImago-update');
    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
    } catch (e) {}

    const destFile = path.join(tempDir, setupAsset.name || `tImago-Setup-${info.latestVersion}.exe`);

    try {
      await downloadFileWithRedirects(setupAsset.downloadUrl, destFile, (progress) => {
        io.emit('updater:progress', progress);
      });

      io.emit('updater:downloadComplete', {
        installerPath: destFile,
        version: info.latestVersion,
        fileName: setupAsset.name
      });
    } catch (err) {
      io.emit('updater:error', { message: `Erro ao baixar atualização: ${err.message}` });
    }
  });

  socket.on('updater:cancelDownload', () => {
    cancelDownload();
    io.emit('updater:cancelled');
  });

  const handleInstall = (payload) => {
    const installerPath = payload?.installerPath;
    if (!installerPath) return;

    try {
      launchInstallerAndQuit(installerPath, onQuitApp);
    } catch (err) {
      socket.emit('updater:error', { message: err.message });
    }
  };

  socket.on('updater:installNow', handleInstall);
  socket.on('updater:launchInstaller', handleInstall);
}

module.exports = {
  checkForUpdates,
  downloadFileWithRedirects,
  cancelDownload,
  launchInstallerAndQuit,
  registerUpdaterSocketEvents
};
