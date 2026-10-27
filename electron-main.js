/**
 * ============================================================================
 * tImago — Broadcast Overlay Controller for OBS Studio
 * Arquivo: electron-main.js (Processo Principal do Aplicativo Desktop Windows)
 * ============================================================================
 * Responsabilidades:
 * 1. Definir o diretório seguro de dados do usuário (%APPDATA%/tImago) antes de iniciar o servidor.
 * 2. Iniciar o servidor Express + Socket.IO em segundo plano sem abrir terminal.
 * 3. Criar a janela nativa do Painel de Controle do tImago.
 * 4. Ao fechar a janela principal (clicar no X), encerrar imediatamente o servidor
 *    e ocultar qualquer card que esteja visível no OBS Studio.
 * ============================================================================
 */

const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');

// Garante que apenas uma instância do aplicativo tImago rode por vez
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Configura a pasta de persistência em AppData/Roaming/tImago antes de importar o server.js
process.env.TIMAGO_DATA_DIR = path.join(app.getPath('userData'), 'data');

const { startServer, stopServer, isOverlayVisible } = require('./server');

let mainWindow = null;
const PORT = process.env.PORT || 3000;

async function createMainWindow() {
  await startServer(PORT);

  mainWindow = new BrowserWindow({
    width: 1460,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: 'tImago — Controle de Overlay OBS',
    backgroundColor: '#090d16',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'public', 'img', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Remove a barra de menu superior padrão (File, Edit, View...)
  mainWindow.setMenuBarVisibility(false);

  // Carrega o Painel de Controle local
  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Abre links externos (ex: botão "Abrir" /overlay em nova aba) no navegador padrão do sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Trava de Segurança ao Vivo (Fase 6): pergunta antes de fechar se o Overlay estiver NO AR
  mainWindow.on('close', (e) => {
    if (isOverlayVisible()) {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        buttons: ['Cancelar (Manter Aberto)', 'Sim, Encerrar Transmissão e Fechar'],
        defaultId: 0,
        cancelId: 0,
        title: 'Transmissão NO AR — tImago',
        message: 'O Overlay está marcado como NO AR (Visível).',
        detail: 'Deseja realmente fechar o tImago e encerrar o overlay no OBS Studio agora?'
      });
      if (choice === 0) {
        e.preventDefault();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(createMainWindow);

// Quando o usuário fecha a janela do tImago, encerra o servidor (desligando o overlay no OBS) e fecha o app
app.on('window-all-closed', () => {
  stopServer();
  app.quit();
});

app.on('before-quit', () => {
  stopServer();
});
