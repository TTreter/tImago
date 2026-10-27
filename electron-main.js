/**
 * ============================================================================
 * tImago — Broadcast Overlay Controller for OBS Studio
 * Arquivo: electron-main.js (Processo Principal do Aplicativo Desktop Windows)
 * ============================================================================
 * Responsabilidades:
 * 1. Definir o diretório seguro de dados do usuário (%APPDATA%/tImago) antes de iniciar o servidor.
 * 2. Iniciar o servidor Express + Socket.IO em segundo plano sem abrir terminal.
 * 3. Criar a janela nativa do Painel de Controle do tImago.
 * 4. Integrar com a Bandeja do Sistema (System Tray) e Iniciar com o Windows.
 * 5. Gerenciar o comportamento configurável ao fechar a janela no botão X.
 * ============================================================================
 */

const { app, BrowserWindow, shell, dialog, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

// Garante que apenas uma instância do aplicativo tImago rode por vez
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Configura a pasta de persistência em AppData/Roaming/tImago antes de importar o server.js
process.env.TIMAGO_DATA_DIR = path.join(app.getPath('userData'), 'data');

const {
  startServer,
  stopServer,
  isOverlayVisible,
  getSettings,
  onSettingsChange,
  toggleOverlayVisibility
} = require('./server');

let mainWindow = null;
let tray = null;
let isQuitting = false;
const PORT = process.env.PORT || 3000;

function applyWindowsLoginItem(startWithWindows) {
  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(startWithWindows),
      openAsHidden: true,
      path: process.execPath,
      args: ['--autostart']
    });
  } catch (err) {
    console.warn('Erro ao configurar loginItemSettings:', err.message);
  }
}

function updateTrayMenu() {
  if (!tray) return;

  const visible = isOverlayVisible();
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir Painel de Controle',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: `Transmissão: ${visible ? 'NO AR (Visível)' : 'OCULTO'}`,
      enabled: false
    },
    {
      label: visible ? 'Ocultar Overlay no OBS' : 'Colocar Overlay NO AR',
      click: () => {
        toggleOverlayVisibility();
        updateTrayMenu();
      }
    },
    {
      label: 'Abrir Overlay no Navegador',
      click: () => {
        shell.openExternal(`http://localhost:${PORT}/overlay`);
      }
    },
    { type: 'separator' },
    {
      label: 'Encerrar tImago',
      click: () => {
        isQuitting = true;
        stopServer();
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip(`tImago — ${visible ? 'NO AR' : 'Oculto'}`);
}

function createTray() {
  if (tray) return;

  try {
    const iconPath = path.join(__dirname, 'public', 'img', 'icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.resize({ width: 16, height: 16 }));

    updateTrayMenu();

    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.focus();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.warn('Erro ao inicializar Tray:', err.message);
  }
}

async function createMainWindow() {
  await startServer(PORT);

  const initialSettings = getSettings();
  applyWindowsLoginItem(initialSettings.startWithWindows);

  createTray();

  const isAutostart = process.argv.includes('--autostart');
  const shouldStartHidden = Boolean(initialSettings.startMinimized) || isAutostart;

  mainWindow = new BrowserWindow({
    width: 1460,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    show: !shouldStartHidden,
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

  // Abre links externos no navegador padrão do sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Reage a alterações de configurações salvas pelo painel
  onSettingsChange((newSettings) => {
    applyWindowsLoginItem(newSettings.startWithWindows);
    updateTrayMenu();
  });

  // Gerenciamento de Fechamento da Janela (Botão X)
  mainWindow.on('close', (e) => {
    if (isQuitting) return;

    const currentSettings = getSettings();
    const behavior = currentSettings.closeBehavior || 'tray';

    if (behavior === 'tray') {
      e.preventDefault();
      mainWindow.hide();
      return;
    }

    if (behavior === 'ask' && isOverlayVisible()) {
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
        return;
      }
    }

    isQuitting = true;
    stopServer();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (!mainWindow.isVisible()) mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (isQuitting) {
    stopServer();
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopServer();
});
