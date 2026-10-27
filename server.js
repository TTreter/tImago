/**
 * ============================================================================
 * tImago — Broadcast Overlay Controller for OBS Studio
 * Arquivo: server.js (Servidor HTTP + WebSocket em Tempo Real)
 * ============================================================================
 * Responsabilidades:
 * 1. Servir as interfaces estáticas do Painel (/admin ou /) e do Overlay (/overlay).
 * 2. Gerenciar a persistência automática do estado em JSON (frases, fila do público,
 *    temas, tamanhos e resoluções), suportando tanto execução via Node quanto empacotada (.exe).
 * 3. Controlar o motor de temporização (Carrossel Contínuo + Fila Prioritária do Público).
 * 4. Sincronizar todos os clientes conectados (Painel, Preview e OBS Browser Source) via Socket.IO.
 * ============================================================================
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 5e6 });

const PORT = process.env.PORT || 3000;
let activePort = PORT;

/**
 * Define o caminho do arquivo de estado persistente (state.json).
 * Quando executado dentro do executável Electron (.exe), utiliza a variável
 * TIMAGO_DATA_DIR apontando para AppData/Roaming/tImago para permitir escrita.
 */
const DATA_DIR = process.env.TIMAGO_DATA_DIR || path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const DEFAULT_SEED_FILE = path.join(__dirname, 'data', 'state.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rotas amigáveis para o OBS Browser Source e Painel Administrativo
app.get('/overlay', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'overlay.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * Estado padrão inicial caso o arquivo JSON ainda não exista
 */
const defaultState = {
  settings: {
    visible: true,
    autoRotate: true,
    theme: 'christmas',
    position: 'bottom-left',
    intervalSeconds: 4,
    defaultDurationSeconds: 10,
    showProgress: true,
    fontSizePercent: 100,
    overlayScalePercent: 100,
    cardMaxWidthPx: 1020,
    resolutionWidth: 1920,
    resolutionHeight: 1080,
    audienceHoldMode: true,
    audienceBatchPlaying: false,
    showKicker: true,
    defaultKickerText: 'MENSAGEM DO CIDADÃO',
    animationStyle: 'slide-up',
    showLogo: false,
    logoDataUrl: '',
    logoPosition: 'left',
    logoSizePx: 56,
    customThemeColors: {
      bg1: '#1e1b4b',
      bg2: '#0f172a',
      border: '#38bdf8',
      text: '#f8fafc',
      author: '#fde047'
    },
    displayMode: 'card',
    tickerSpeedSeconds: 32,
    startWithWindows: false,
    startMinimized: false,
    closeBehavior: 'tray',
    organizationName: 'Prefeitura Municipal',
    compactLists: false
  },
  lowerThird: {
    active: false,
    badge: 'PRONUNCIAMENTO OFICIAL',
    title: '',
    subtitle: '',
    autoHideSeconds: 10
  },
  activePlaylistId: 'pl-inst',
  playlists: [
    {
      id: 'pl-inst',
      name: 'Avisos Institucionais (Prefeitura)',
      phrases: [
        {
          id: 'p-i1',
          text: 'Acompanhe as ações, editais, obras e serviços públicos no Portal Oficial da Prefeitura e em nossas redes sociais.',
          author: 'Assessoria de Comunicação (ASCOM)',
          duration: 10,
          enabled: true
        },
        {
          id: 'p-i2',
          text: 'Precisa de atendimento, protocolos ou informações? Utilize a Ouvidoria Municipal e os canais digitais de atendimento ao cidadão.',
          author: 'Atendimento ao Cidadão',
          duration: 11,
          enabled: true
        },
        {
          id: 'p-i3',
          text: 'Participe ao vivo! Envie sua pergunta, sugestão ou informe o seu bairro no chat da transmissão.',
          author: 'Participação Popular',
          duration: 10,
          enabled: true
        }
      ]
    },
    {
      id: 'pl-christmas',
      name: 'Natal da Família (Prefeitura)',
      phrases: [
        {
          id: 'p-c1',
          text: 'Sejam todos muito bem-vindos à programação especial de Natal do nosso município! Uma noite de cultura, luz e união para todas as famílias.',
          author: 'Prefeitura Municipal',
          duration: 10,
          enabled: true
        },
        {
          id: 'p-c2',
          text: 'Prestigie o comércio local e a feira de artesanato na Praça Central durante toda a programação natalina da cidade.',
          author: 'Secretaria de Cultura e Turismo',
          duration: 11,
          enabled: true
        },
        {
          id: 'p-c3',
          text: 'Deixe sua mensagem de Boas Festas no chat dizendo o seu nome e o seu bairro! Vamos exibir a participação dos moradores na tela.',
          author: 'Comunicação Municipal',
          duration: 10,
          enabled: true
        }
      ]
    },
    {
      id: 'pl-health',
      name: 'Saúde (Outubro Rosa / Novembro Azul)',
      phrases: [
        {
          id: 'p-h1',
          text: 'Cuidar da saúde é um ato de amor à vida. Procure a Unidade Básica de Saúde (UBS) mais próxima e mantenha seus exames preventivos em dia!',
          author: 'Secretaria Municipal de Saúde',
          duration: 11,
          enabled: true
        },
        {
          id: 'p-h2',
          text: 'Outubro Rosa & Novembro Azul: o diagnóstico precoce salva vidas. Informe-se sobre os mutirões de atendimento na rede municipal.',
          author: 'Prevenção & Saúde Pública',
          duration: 11,
          enabled: true
        }
      ]
    },
    {
      id: 'pl-sports',
      name: 'Passeio Ciclístico & Esportes',
      phrases: [
        {
          id: 'p-s1',
          text: 'Bem-vindos ao Passeio Ciclístico Municipal! Mantenha a hidratação, siga as orientações dos batedores e aproveite o percurso com segurança.',
          author: 'Secretaria de Esportes e Lazer',
          duration: 11,
          enabled: true
        },
        {
          id: 'p-s2',
          text: 'Esporte é saúde, inclusão e qualidade de vida em nosso município! Agradecemos a participação de todas as famílias e atletas.',
          author: 'Prefeitura Municipal',
          duration: 10,
          enabled: true
        }
      ]
    }
  ],
  phrases: [
    {
      id: 'p-i1',
      text: 'Acompanhe as ações, editais, obras e serviços públicos no Portal Oficial da Prefeitura e em nossas redes sociais.',
      author: 'Assessoria de Comunicação (ASCOM)',
      duration: 10,
      enabled: true
    },
    {
      id: 'p-i2',
      text: 'Precisa de atendimento, protocolos ou informações? Utilize a Ouvidoria Municipal e os canais digitais de atendimento ao cidadão.',
      author: 'Atendimento ao Cidadão',
      duration: 11,
      enabled: true
    },
    {
      id: 'p-i3',
      text: 'Participe ao vivo! Envie sua pergunta, sugestão ou informe o seu bairro no chat da transmissão.',
      author: 'Participação Popular',
      duration: 10,
      enabled: true
    }
  ],
  audienceQueue: [],
  scoreboard: {
    visible: false,
    sport: 'soccer', // 'soccer', 'volleyball', 'basketball', 'generic'
    position: 'top-left', // 'top-left', 'top-center', 'top-right'
    theme: 'soccer-pitch', // 'soccer-pitch', 'soccer-champion', 'clean', 'custom'
    teamA: {
      name: 'Mandante FC',
      shortName: 'MAN',
      color: '#16a34a',
      logo: '',
      score: 0,
      yellowCards: 0,
      redCards: 0,
      fouls: 0,
      setsWon: 0,
      setHistory: []
    },
    teamB: {
      name: 'Visitante EC',
      shortName: 'VIS',
      color: '#2563eb',
      logo: '',
      score: 0,
      yellowCards: 0,
      redCards: 0,
      fouls: 0,
      setsWon: 0,
      setHistory: []
    },
    timer: {
      seconds: 0,
      running: false,
      direction: 'up',
      extraMinutes: 0
    },
    period: '1T',
    periodLabel: '1º Tempo',
    currentSet: 1,
    servingTeam: 'teamA',
    celebration: null
  }
};

let state = loadState();

/**
 * Estado de execução em memória (Runtime) do motor de rotação
 */
let runtime = {
  currentPhraseId: null,
  currentPhrase: null, // { id, text, author, duration, source: 'system' | 'audience' }
  phase: 'idle', // 'showing' | 'interval' | 'idle'
  phaseStartedAt: Date.now(),
  phaseDurationMs: 0,
  queueIndex: -1
};

let rotationTimer = null;

/**
 * Remove emojis de uma string para garantir sobriedade institucional
 */
function stripEmojis(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1FA00}-\u{1FAFF}\u{FE0F}]/gu, '')
    .trim();
}

/**
 * Sanitiza valores textuais do estado removendo emojis legados
 */
function sanitizeStateStrings(st) {
  if (!st) return st;
  if (st.settings && st.settings.defaultKickerText) {
    st.settings.defaultKickerText = stripEmojis(st.settings.defaultKickerText);
  }
  if (st.lowerThird && st.lowerThird.badge) {
    st.lowerThird.badge = stripEmojis(st.lowerThird.badge);
  }
  if (Array.isArray(st.playlists)) {
    st.playlists.forEach((pl) => {
      if (pl.name) pl.name = stripEmojis(pl.name);
    });
  }
  return st;
}

/**
 * Callbacks para notificar o processo Electron ou plugins sobre mudancas de settings
 */
const settingsChangeCallbacks = [];

function onSettingsChange(cb) {
  if (typeof cb === 'function') settingsChangeCallbacks.push(cb);
}

function notifySettingsChanged(newSettings) {
  settingsChangeCallbacks.forEach((cb) => {
    try {
      cb(newSettings);
    } catch (e) {
      console.error('Erro no callback onSettingsChange:', e.message);
    }
  });
}

function getSettings() {
  return state ? state.settings : defaultState.settings;
}

function getState() {
  return state;
}

function toggleOverlayVisibility() {
  if (!state || !state.settings) return false;
  state.settings.visible = !state.settings.visible;
  saveState();
  if (!state.settings.visible) {
    markCurrentAudienceAsPlayedIfAny();
    clearRotationTimer();
    runtime.currentPhraseId = null;
    runtime.currentPhrase = null;
    runtime.phase = 'idle';
    runtime.phaseStartedAt = Date.now();
    runtime.phaseDurationMs = 0;
  } else {
    advanceNextInPriority();
  }
  broadcastState();
  notifySettingsChanged(state.settings);
  return state.settings.visible;
}

/**
 * Garante que a estrutura de playlists exista e esteja sincronizada com state.phrases
 */
function ensurePlaylistsStructure(st) {
  if (!Array.isArray(st.playlists) || st.playlists.length === 0) {
    st.playlists = JSON.parse(JSON.stringify(defaultState.playlists));
    st.activePlaylistId = 'pl-inst';
  } else {
    // Filtra silenciosamente qualquer resquício legado sem resetar as playlists do usuário
    st.playlists = st.playlists.filter((p) => p.id !== 'pl-worship');
    if (st.playlists.length === 0) {
      st.playlists = JSON.parse(JSON.stringify(defaultState.playlists));
      st.activePlaylistId = 'pl-inst';
    }
  }
  let activePl = st.playlists.find((p) => p.id === st.activePlaylistId);
  if (!activePl) {
    activePl = st.playlists[0];
    st.activePlaylistId = activePl.id;
  }
  st.phrases = Array.isArray(activePl.phrases) ? activePl.phrases : [];
  return st;
}

/**
 * Carrega o estado persistido no disco (ou copia o seed inicial na primeira execução)
 */
function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE) && fs.existsSync(DEFAULT_SEED_FILE)) {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.copyFileSync(DEFAULT_SEED_FILE, STATE_FILE);
    }

    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const loaded = {
        settings: { ...defaultState.settings, ...(parsed.settings || {}) },
        lowerThird: { ...defaultState.lowerThird, ...(parsed.lowerThird || {}), active: false },
        activePlaylistId: parsed.activePlaylistId || 'pl-inst',
        playlists: Array.isArray(parsed.playlists) ? parsed.playlists : [],
        phrases: Array.isArray(parsed.phrases) ? parsed.phrases : defaultState.phrases,
        audienceQueue: Array.isArray(parsed.audienceQueue) ? parsed.audienceQueue : [],
        scoreboard: {
          ...defaultState.scoreboard,
          ...(parsed.scoreboard || {}),
          teamA: { ...defaultState.scoreboard.teamA, ...(parsed.scoreboard?.teamA || {}) },
          teamB: { ...defaultState.scoreboard.teamB, ...(parsed.scoreboard?.teamB || {}) },
          timer: { ...defaultState.scoreboard.timer, ...(parsed.scoreboard?.timer || {}), running: false },
          celebration: null
        }
      };
      return ensurePlaylistsStructure(sanitizeStateStrings(loaded));
    }
  } catch (err) {
    console.error('Erro ao carregar state.json:', err.message);
  }
  return ensurePlaylistsStructure(sanitizeStateStrings(JSON.parse(JSON.stringify(defaultState))));
}

let saveStateDebounceTimer = null;
let isSavingState = false;
let hasPendingSaveState = false;

async function executeSaveState() {
  if (isSavingState) {
    hasPendingSaveState = true;
    return;
  }
  isSavingState = true;
  hasPendingSaveState = false;
  try {
    if (Array.isArray(state.playlists)) {
      const activePl = state.playlists.find((p) => p.id === state.activePlaylistId);
      if (activePl) {
        activePl.phrases = state.phrases;
      }
    }
    if (!fs.existsSync(DATA_DIR)) {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
    }
    const tempFile = STATE_FILE + '.tmp';
    const jsonStr = JSON.stringify(state, null, 2);
    await fs.promises.writeFile(tempFile, jsonStr, 'utf-8');
    await fs.promises.rename(tempFile, STATE_FILE);
  } catch (err) {
    console.error('Erro ao salvar state.json de forma atômica:', err.message);
  } finally {
    isSavingState = false;
    if (hasPendingSaveState) {
      executeSaveState();
    }
  }
}

/**
 * Salva o estado atual em disco com debounce de 150ms e escrita atômica segura.
 * Passar immediate=true força gravação síncrona imediata (ex: no encerramento da aplicação).
 */
function saveState(immediate = false) {
  if (saveStateDebounceTimer) {
    clearTimeout(saveStateDebounceTimer);
    saveStateDebounceTimer = null;
  }

  if (immediate) {
    try {
      if (Array.isArray(state.playlists)) {
        const activePl = state.playlists.find((p) => p.id === state.activePlaylistId);
        if (activePl) {
          activePl.phrases = state.phrases;
        }
      }
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) {
      console.error('Erro ao salvar state síncrono:', e.message);
    }
    return;
  }

  saveStateDebounceTimer = setTimeout(executeSaveState, 150);
}

/**
 * Retorna apenas as frases fixas do sistema que estão ativas no carrossel
 */
function getEnabledSystemPhrases() {
  return state.phrases.filter((p) => p.enabled);
}

/**
 * Retorna os recados do público que ainda aguardam exibição (status === 'pending')
 */
function getPendingAudiencePhrases() {
  return state.audienceQueue.filter((item) => item.status === 'pending');
}

/**
 * Verifica se a fila do público está autorizada a interromper o carrossel:
 * - Se audienceHoldMode === false: dispara automaticamente assim que há itens pendentes.
 * - Se audienceHoldMode === true: aguarda o operador clicar em "Iniciar Exibição da Fila".
 */
function isAudienceAllowedToPlay() {
  const pendingCount = getPendingAudiencePhrases().length;
  if (pendingCount === 0) return false;
  if (!state.settings.audienceHoldMode) return true;
  return Boolean(state.settings.audienceBatchPlaying);
}

function clearRotationTimer() {
  if (rotationTimer) {
    clearTimeout(rotationTimer);
    rotationTimer = null;
  }
}

/**
 * Emite o estado sincronizado para todos os clientes WebSocket conectados
 */
function broadcastState() {
  io.emit('state:sync', {
    state,
    runtime: {
      ...runtime,
      serverNow: Date.now(),
      pendingAudienceCount: getPendingAudiencePhrases().length,
      localIp: getLocalIpAddress(),
      port: activePort
    }
  });
}

/**
 * Exibe imediatamente uma frase específica no overlay e agenda seu término
 */
function showPhraseNow(phrase, source = 'system', updateCarouselIndex = false) {
  clearRotationTimer();

  if (!phrase) {
    runtime.currentPhraseId = null;
    runtime.currentPhrase = null;
    runtime.phase = 'idle';
    runtime.phaseStartedAt = Date.now();
    runtime.phaseDurationMs = 0;
    broadcastState();
    return;
  }

  if (source === 'system' && updateCarouselIndex) {
    const enabled = getEnabledSystemPhrases();
    const idx = enabled.findIndex((p) => p.id === phrase.id);
    if (idx !== -1) {
      runtime.queueIndex = idx;
    }
  }

  if (source === 'audience') {
    const audItem = state.audienceQueue.find((a) => a.id === phrase.id);
    if (audItem) {
      audItem.status = 'showing';
      saveState();
    }
  }

  const durationSec = Math.max(2, Number(phrase.duration) || state.settings.defaultDurationSeconds || 10);
  const durationMs = durationSec * 1000;

  runtime.currentPhraseId = phrase.id;
  runtime.currentPhrase = {
    ...phrase,
    source
  };
  runtime.phase = 'showing';
  runtime.phaseStartedAt = Date.now();
  runtime.phaseDurationMs = durationMs;

  broadcastState();

  rotationTimer = setTimeout(() => {
    onPhraseShowComplete();
  }, durationMs);
}

/**
 * Marca o recado atual do público como 'played' (já exibido) para nunca repetir sozinho
 */
function markCurrentAudienceAsPlayedIfAny() {
  if (runtime.currentPhrase && runtime.currentPhrase.source === 'audience') {
    const audItem = state.audienceQueue.find((a) => a.id === runtime.currentPhrase.id);
    if (audItem && audItem.status === 'showing') {
      audItem.status = 'played';
      audItem.playedAt = new Date().toISOString();
      if (getPendingAudiencePhrases().length === 0 && state.settings.audienceHoldMode) {
        state.settings.audienceBatchPlaying = false;
      }
      saveState();
    }
  }
}

/**
 * Callback disparado quando o tempo de tela da frase atual chega ao fim
 */
function onPhraseShowComplete() {
  clearRotationTimer();
  markCurrentAudienceAsPlayedIfAny();

  if (!state.settings.visible) {
    runtime.currentPhraseId = null;
    runtime.currentPhrase = null;
    runtime.phase = 'idle';
    runtime.phaseStartedAt = Date.now();
    runtime.phaseDurationMs = 0;
    broadcastState();
    return;
  }

  const hasPlayableAudience = isAudienceAllowedToPlay();

  if (!hasPlayableAudience && !state.settings.autoRotate) {
    runtime.currentPhraseId = null;
    runtime.currentPhrase = null;
    runtime.phase = 'idle';
    runtime.phaseStartedAt = Date.now();
    runtime.phaseDurationMs = 0;
    broadcastState();
    return;
  }

  const intervalSec = Math.max(0, Number(state.settings.intervalSeconds) ?? 4);
  const intervalMs = intervalSec * 1000;

  if (intervalMs > 0) {
    runtime.currentPhraseId = null;
    runtime.currentPhrase = null;
    runtime.phase = 'interval';
    runtime.phaseStartedAt = Date.now();
    runtime.phaseDurationMs = intervalMs;
    broadcastState();

    rotationTimer = setTimeout(() => {
      advanceNextInPriority();
    }, intervalMs);
  } else {
    advanceNextInPriority();
  }
}

/**
 * Seleciona a próxima frase seguindo a regra de prioridade:
 * 1º Fila do Público (se liberada) -> 2º Carrossel do Sistema
 */
function advanceNextInPriority() {
  clearRotationTimer();

  if (!state.settings.visible) {
    runtime.currentPhraseId = null;
    runtime.currentPhrase = null;
    runtime.phase = 'idle';
    runtime.phaseStartedAt = Date.now();
    runtime.phaseDurationMs = 0;
    broadcastState();
    return;
  }

  if (isAudienceAllowedToPlay()) {
    const pendingAudience = getPendingAudiencePhrases();
    if (pendingAudience.length > 0) {
      const nextAudience = pendingAudience[0];
      showPhraseNow(nextAudience, 'audience', false);
      return;
    }
  }

  if (getPendingAudiencePhrases().length === 0 && state.settings.audienceBatchPlaying) {
    state.settings.audienceBatchPlaying = false;
    saveState();
  }

  if (!state.settings.autoRotate) {
    runtime.currentPhraseId = null;
    runtime.currentPhrase = null;
    runtime.phase = 'idle';
    runtime.phaseStartedAt = Date.now();
    runtime.phaseDurationMs = 0;
    broadcastState();
    return;
  }

  const enabledSystem = getEnabledSystemPhrases();
  if (enabledSystem.length === 0) {
    runtime.currentPhraseId = null;
    runtime.currentPhrase = null;
    runtime.phase = 'idle';
    runtime.phaseStartedAt = Date.now();
    runtime.phaseDurationMs = 0;
    broadcastState();
    return;
  }

  runtime.queueIndex = (runtime.queueIndex + 1) % enabledSystem.length;
  const nextSystemPhrase = enabledSystem[runtime.queueIndex];
  showPhraseNow(nextSystemPhrase, 'system', false);
}

/**
 * Interrompe/pausa o carrossel do sistema quando a fila do público é liberada
 */
function interruptCarouselForAudienceIfNeeded() {
  if (!state.settings.visible) {
    broadcastState();
    return;
  }

  if (!isAudienceAllowedToPlay()) {
    broadcastState();
    return;
  }

  const isCurrentlyShowingAudience =
    runtime.phase === 'showing' && runtime.currentPhrase?.source === 'audience';

  if (isCurrentlyShowingAudience) {
    broadcastState();
    return;
  }

  if (runtime.phase === 'showing' && runtime.currentPhrase?.source === 'system') {
    runtime.queueIndex = Math.max(-1, runtime.queueIndex - 1);
  }
  advanceNextInPriority();
}

function syncEngineWithSettings(forceRestart = false) {
  state.audienceQueue.forEach((item) => {
    if (item.status === 'showing') item.status = 'pending';
  });

  if (!state.settings.visible) {
    clearRotationTimer();
    runtime.currentPhraseId = null;
    runtime.currentPhrase = null;
    runtime.phase = 'idle';
    runtime.phaseStartedAt = Date.now();
    runtime.phaseDurationMs = 0;
    broadcastState();
    return;
  }

  if (forceRestart || runtime.phase === 'idle') {
    advanceNextInPriority();
  } else {
    broadcastState();
  }
}

// ============================================================================
// EVENTOS WEBSOCKET (SOCKET.IO)
// ============================================================================
io.on('connection', (socket) => {
  socket.emit('state:sync', {
    state,
    runtime: {
      ...runtime,
      serverNow: Date.now(),
      pendingAudienceCount: getPendingAudiencePhrases().length,
      localIp: getLocalIpAddress(),
      port: activePort
    }
  });

  // Envia estado inicial do placar esportivo
  socket.emit('scoreboard:sync', state.scoreboard);

  socket.on('settings:update', (partialSettings) => {
    const prevVisible = state.settings.visible;
    const prevAutoRotate = state.settings.autoRotate;

    state.settings = {
      ...state.settings,
      ...partialSettings
    };
    saveState();
    notifySettingsChanged(state.settings);

    if (!state.settings.visible) {
      markCurrentAudienceAsPlayedIfAny();
      clearRotationTimer();
      runtime.currentPhraseId = null;
      runtime.currentPhrase = null;
      runtime.phase = 'idle';
      runtime.phaseStartedAt = Date.now();
      runtime.phaseDurationMs = 0;
      broadcastState();
    } else if (!prevVisible && state.settings.visible) {
      advanceNextInPriority();
    } else if (!prevAutoRotate && state.settings.autoRotate && runtime.phase === 'idle') {
      advanceNextInPriority();
    } else {
      broadcastState();
    }
  });

  // --- Eventos da Fila do Público / Ouvintes ---
  socket.on('audience:add', (payload) => {
    const text = String(payload?.text || '').trim().slice(0, 350);
    if (!text) return;

    const author = String(payload?.author || '').trim().slice(0, 60);
    const kicker = payload?.kicker !== undefined ? String(payload.kicker).trim().slice(0, 40) : '';
    const duration = Math.max(2, Number(payload?.duration) || state.settings.defaultDurationSeconds || 10);
    const showImmediately = Boolean(payload?.showImmediately);

    const newAudienceItem = {
      id: 'aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      text,
      author,
      kicker,
      duration,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    state.audienceQueue.push(newAudienceItem);
    saveState();

    if (showImmediately) {
      markCurrentAudienceAsPlayedIfAny();
      state.settings.visible = true;
      saveState();
      showPhraseNow(newAudienceItem, 'audience', false);
    } else {
      interruptCarouselForAudienceIfNeeded();
    }
  });

  socket.on('audience:update', (payload) => {
    const idx = state.audienceQueue.findIndex((a) => a.id === payload?.id);
    if (idx === -1) return;

    const current = state.audienceQueue[idx];
    const updated = {
      ...current,
      text: payload.text !== undefined ? String(payload.text).trim().slice(0, 350) : current.text,
      author: payload.author !== undefined ? String(payload.author).trim().slice(0, 60) : current.author,
      kicker: payload.kicker !== undefined ? String(payload.kicker).trim().slice(0, 40) : (current.kicker || ''),
      duration: payload.duration !== undefined ? Math.max(2, Number(payload.duration) || 10) : current.duration
    };

    state.audienceQueue[idx] = updated;
    saveState();

    if (runtime.currentPhraseId === updated.id) {
      runtime.currentPhrase = { ...updated, source: 'audience' };
    }
    broadcastState();
  });

  socket.on('audience:move', ({ id, direction }) => {
    const idx = state.audienceQueue.findIndex((a) => a.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= state.audienceQueue.length) return;

    const temp = state.audienceQueue[idx];
    state.audienceQueue[idx] = state.audienceQueue[targetIdx];
    state.audienceQueue[targetIdx] = temp;
    saveState();
    broadcastState();
  });

  socket.on('audience:trigger', (id) => {
    const item = state.audienceQueue.find((a) => a.id === id);
    if (!item) return;

    markCurrentAudienceAsPlayedIfAny();
    item.status = 'showing';
    if (!state.settings.visible) {
      state.settings.visible = true;
    }
    saveState();
    showPhraseNow(item, 'audience', false);
  });

  socket.on('audience:requeue', (id) => {
    const item = state.audienceQueue.find((a) => a.id === id);
    if (!item) return;
    item.status = 'pending';
    saveState();
    interruptCarouselForAudienceIfNeeded();
  });

  socket.on('audience:delete', (id) => {
    const wasShowing = runtime.currentPhraseId === id;
    state.audienceQueue = state.audienceQueue.filter((a) => a.id !== id);
    saveState();

    if (wasShowing) {
      onPhraseShowComplete();
    } else {
      broadcastState();
    }
  });

  socket.on('audience:clearPlayed', () => {
    state.audienceQueue = state.audienceQueue.filter((a) => a.status !== 'played');
    saveState();
    broadcastState();
  });

  socket.on('audience:startBatch', () => {
    if (getPendingAudiencePhrases().length === 0) return;
    state.settings.audienceBatchPlaying = true;
    if (!state.settings.visible) {
      state.settings.visible = true;
    }
    saveState();
    interruptCarouselForAudienceIfNeeded();
  });

  socket.on('audience:pauseBatch', () => {
    state.settings.audienceBatchPlaying = false;
    saveState();

    if (runtime.phase === 'showing' && runtime.currentPhrase?.source === 'audience') {
      const audItem = state.audienceQueue.find((a) => a.id === runtime.currentPhrase.id);
      if (audItem && audItem.status === 'showing') {
        audItem.status = 'pending';
        saveState();
      }
      advanceNextInPriority();
    } else {
      broadcastState();
    }
  });

  // --- Eventos do Carrossel do Sistema ---
  socket.on('phrase:add', (payload) => {
    const text = String(payload?.text || '').trim().slice(0, 350);
    if (!text) return;

    const author = String(payload?.author || '').trim().slice(0, 60);
    const kicker = payload?.kicker !== undefined ? String(payload.kicker).trim().slice(0, 40) : '';
    const duration = Math.max(2, Number(payload?.duration) || state.settings.defaultDurationSeconds || 10);
    const showImmediately = Boolean(payload?.showImmediately);

    const newPhrase = {
      id: 'p-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      text,
      author,
      kicker,
      duration,
      enabled: payload?.enabled !== undefined ? Boolean(payload.enabled) : true
    };

    state.phrases.push(newPhrase);
    saveState();

    if (showImmediately) {
      markCurrentAudienceAsPlayedIfAny();
      state.settings.visible = true;
      saveState();
      showPhraseNow(newPhrase, 'system', true);
    } else {
      if (state.settings.visible && state.settings.autoRotate && runtime.phase === 'idle') {
        advanceNextInPriority();
      } else {
        broadcastState();
      }
    }
  });

  socket.on('phrase:update', (payload) => {
    const idx = state.phrases.findIndex((p) => p.id === payload?.id);
    if (idx === -1) return;

    const current = state.phrases[idx];
    const updated = {
      ...current,
      text: payload.text !== undefined ? String(payload.text).trim().slice(0, 350) : current.text,
      author: payload.author !== undefined ? String(payload.author).trim().slice(0, 60) : current.author,
      kicker: payload.kicker !== undefined ? String(payload.kicker).trim().slice(0, 40) : (current.kicker || ''),
      duration: payload.duration !== undefined ? Math.max(2, Number(payload.duration) || 10) : current.duration,
      enabled: payload.enabled !== undefined ? Boolean(payload.enabled) : current.enabled
    };

    state.phrases[idx] = updated;
    saveState();

    if (runtime.currentPhraseId === updated.id) {
      if (!updated.enabled && state.settings.autoRotate) {
        onPhraseShowComplete();
        return;
      }
      runtime.currentPhrase = { ...updated, source: 'system' };
    }

    if (state.settings.visible && state.settings.autoRotate && runtime.phase === 'idle' && getEnabledSystemPhrases().length > 0) {
      advanceNextInPriority();
    } else {
      broadcastState();
    }
  });

  socket.on('phrase:bulkToggle', ({ enabled }) => {
    const targetState = Boolean(enabled);
    state.phrases = state.phrases.map((p) => ({ ...p, enabled: targetState }));
    saveState();

    if (!targetState && runtime.phase === 'showing' && runtime.currentPhrase?.source === 'system' && state.settings.autoRotate) {
      onPhraseShowComplete();
      return;
    }

    if (targetState && state.settings.visible && state.settings.autoRotate && runtime.phase === 'idle') {
      advanceNextInPriority();
    } else {
      broadcastState();
    }
  });

  socket.on('phrase:delete', (id) => {
    const wasShowing = runtime.currentPhraseId === id;
    state.phrases = state.phrases.filter((p) => p.id !== id);
    saveState();

    if (wasShowing) {
      onPhraseShowComplete();
    } else {
      broadcastState();
    }
  });

  socket.on('phrase:trigger', (id) => {
    const phrase = state.phrases.find((p) => p.id === id);
    if (!phrase) return;

    markCurrentAudienceAsPlayedIfAny();
    if (!state.settings.visible) {
      state.settings.visible = true;
      saveState();
    }
    showPhraseNow(phrase, 'system', true);
  });

  socket.on('rotation:next', () => {
    markCurrentAudienceAsPlayedIfAny();
    if (!state.settings.visible) {
      state.settings.visible = true;
      saveState();
    }
    advanceNextInPriority();
  });

  socket.on('rotation:clearCurrent', () => {
    onPhraseShowComplete();
  });

  socket.on('phrase:move', ({ id, direction }) => {
    const idx = state.phrases.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= state.phrases.length) return;

    const temp = state.phrases[idx];
    state.phrases[idx] = state.phrases[targetIdx];
    state.phrases[targetIdx] = temp;
    saveState();
    broadcastState();
  });

  // --- Eventos de Múltiplas Playlists (Eventos) & Backup JSON ---
  socket.on('playlist:select', (playlistId) => {
    if (!Array.isArray(state.playlists)) return;
    const targetPl = state.playlists.find((p) => p.id === playlistId);
    if (!targetPl) return;

    state.activePlaylistId = targetPl.id;
    state.phrases = Array.isArray(targetPl.phrases) ? targetPl.phrases : [];
    runtime.queueIndex = -1;
    saveState();

    const isShowingSystem = runtime.phase === 'showing' && runtime.currentPhrase?.source === 'system';
    if (state.settings.visible && state.settings.autoRotate && (isShowingSystem || runtime.phase === 'idle')) {
      advanceNextInPriority();
    } else {
      broadcastState();
    }
  });

  socket.on('playlist:create', ({ name }) => {
    const cleanName = String(name || '').trim();
    if (!cleanName) return;

    const newPl = {
      id: 'pl-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      name: cleanName,
      phrases: []
    };

    if (!Array.isArray(state.playlists)) state.playlists = [];
    state.playlists.push(newPl);
    state.activePlaylistId = newPl.id;
    state.phrases = newPl.phrases;
    runtime.queueIndex = -1;
    saveState();

    const isShowingSystem = runtime.phase === 'showing' && runtime.currentPhrase?.source === 'system';
    if (state.settings.visible && state.settings.autoRotate && isShowingSystem) {
      advanceNextInPriority();
    } else {
      broadcastState();
    }
  });

  socket.on('playlist:rename', ({ id, name }) => {
    const cleanName = String(name || '').trim();
    if (!cleanName || !Array.isArray(state.playlists)) return;
    const targetPl = state.playlists.find((p) => p.id === id);
    if (!targetPl) return;

    targetPl.name = cleanName;
    saveState();
    broadcastState();
  });

  socket.on('playlist:delete', (id) => {
    if (!Array.isArray(state.playlists) || state.playlists.length <= 1) return;
    const idx = state.playlists.findIndex((p) => p.id === id);
    if (idx === -1) return;

    state.playlists.splice(idx, 1);
    if (state.activePlaylistId === id) {
      const fallback = state.playlists[0];
      state.activePlaylistId = fallback.id;
      state.phrases = fallback.phrases;
      runtime.queueIndex = -1;
    }
    saveState();

    const isShowingSystem = runtime.phase === 'showing' && runtime.currentPhrase?.source === 'system';
    if (state.settings.visible && state.settings.autoRotate && (isShowingSystem || runtime.phase === 'idle')) {
      advanceNextInPriority();
    } else {
      broadcastState();
    }
  });

  socket.on('state:import', (importedData) => {
    if (!importedData || typeof importedData !== 'object') return;

    if (importedData.settings && typeof importedData.settings === 'object') {
      state.settings = {
        ...defaultState.settings,
        ...state.settings,
        ...importedData.settings
      };
    }

    if (Array.isArray(importedData.playlists) && importedData.playlists.length > 0) {
      state.playlists = importedData.playlists;
      if (importedData.activePlaylistId) {
        state.activePlaylistId = importedData.activePlaylistId;
      }
    } else if (Array.isArray(importedData.phrases)) {
      state.phrases = importedData.phrases;
    }

    if (Array.isArray(importedData.audienceQueue)) {
      state.audienceQueue = importedData.audienceQueue;
    }

    if (importedData.scoreboard && typeof importedData.scoreboard === 'object') {
      state.scoreboard = {
        ...defaultState.scoreboard,
        ...importedData.scoreboard,
        teamA: { ...defaultState.scoreboard.teamA, ...(importedData.scoreboard.teamA || {}) },
        teamB: { ...defaultState.scoreboard.teamB, ...(importedData.scoreboard.teamB || {}) },
        timer: { ...defaultState.scoreboard.timer, ...(importedData.scoreboard.timer || {}), running: false },
        celebration: null
      };
      io.emit('scoreboard:sync', state.scoreboard);
    }

    state = ensurePlaylistsStructure(sanitizeStateStrings(state));
    runtime.queueIndex = -1;
    saveState();
    notifySettingsChanged(state.settings);
    syncEngineWithSettings(true);
  });

  // --- Eventos de Tarja de Identificação Rápida (Lower Third - Fase 5) ---
  socket.on('lowerThird:show', (payload) => {
    const title = String(payload?.title || '').trim().slice(0, 80);
    if (!title) return;

    const badge = String(payload?.badge || '').trim().slice(0, 50);
    const subtitle = String(payload?.subtitle || '').trim().slice(0, 100);
    const autoHideSeconds = Math.max(0, Number(payload?.autoHideSeconds) ?? 10);

    if (global.lowerThirdTimer) {
      clearTimeout(global.lowerThirdTimer);
      global.lowerThirdTimer = null;
    }

    state.lowerThird = {
      active: true,
      badge,
      title,
      subtitle,
      autoHideSeconds
    };
    saveState();
    broadcastState();

    if (autoHideSeconds > 0) {
      global.lowerThirdTimer = setTimeout(() => {
        if (state.lowerThird) {
          state.lowerThird.active = false;
          saveState();
          broadcastState();
        }
      }, autoHideSeconds * 1000);
    }
  });

  socket.on('lowerThird:hide', () => {
    if (global.lowerThirdTimer) {
      clearTimeout(global.lowerThirdTimer);
      global.lowerThirdTimer = null;
    }
    if (state.lowerThird) {
      state.lowerThird.active = false;
      saveState();
      broadcastState();
    }
  });

  // --- Eventos do Placar Esportivo (Futebol, Vôlei, Basquete, Futsal) ---
  socket.on('scoreboard:update', (payload) => {
    if (!payload || typeof payload !== 'object') return;
    state.scoreboard = {
      ...state.scoreboard,
      ...payload,
      teamA: { ...state.scoreboard.teamA, ...(payload.teamA || {}) },
      teamB: { ...state.scoreboard.teamB, ...(payload.teamB || {}) },
      timer: { ...state.scoreboard.timer, ...(payload.timer || {}) }
    };
    saveState();
    io.emit('scoreboard:sync', state.scoreboard);
  });

  socket.on('scoreboard:toggle-visible', () => {
    state.scoreboard.visible = !state.scoreboard.visible;
    saveState();
    io.emit('scoreboard:sync', state.scoreboard);
  });

  socket.on('scoreboard:score-change', ({ team, delta, triggerCelebration }) => {
    if (!team || (team !== 'teamA' && team !== 'teamB')) return;
    const current = Number(state.scoreboard[team].score) || 0;
    const next = Math.max(0, current + Number(delta));
    state.scoreboard[team].score = next;

    if (delta > 0 && triggerCelebration) {
      const sport = state.scoreboard.sport || 'soccer';
      const defaultText = sport === 'volleyball' ? 'PONTO!' : sport === 'basketball' ? 'CESTA!' : 'GOL!';
      state.scoreboard.celebration = {
        type: 'score',
        team,
        teamName: state.scoreboard[team].name,
        text: defaultText,
        timestamp: Date.now()
      };
      setTimeout(() => {
        if (state.scoreboard.celebration) {
          state.scoreboard.celebration = null;
          io.emit('scoreboard:sync', state.scoreboard);
        }
      }, 5500);
    }

    saveState();
    io.emit('scoreboard:sync', state.scoreboard);
  });

  socket.on('scoreboard:timer-control', ({ action, seconds, extraMinutes, direction }) => {
    if (!state.scoreboard.timer) {
      state.scoreboard.timer = { seconds: 0, running: false, direction: 'up', extraMinutes: 0 };
    }

    if (action === 'start') {
      state.scoreboard.timer.running = true;
      state.scoreboard.timer.startedAtMs = Date.now();
      state.scoreboard.timer.baseSeconds = state.scoreboard.timer.seconds || 0;
    } else if (action === 'pause') {
      state.scoreboard.timer.running = false;
      state.scoreboard.timer.startedAtMs = null;
      state.scoreboard.timer.baseSeconds = state.scoreboard.timer.seconds || 0;
    } else if (action === 'reset') {
      state.scoreboard.timer.running = false;
      state.scoreboard.timer.seconds = 0;
      state.scoreboard.timer.extraMinutes = 0;
      state.scoreboard.timer.startedAtMs = null;
      state.scoreboard.timer.baseSeconds = 0;
    } else if (action === 'set') {
      if (typeof seconds === 'number') {
        state.scoreboard.timer.seconds = Math.max(0, seconds);
        state.scoreboard.timer.baseSeconds = state.scoreboard.timer.seconds;
        if (state.scoreboard.timer.running) {
          state.scoreboard.timer.startedAtMs = Date.now();
        }
      }
      if (typeof extraMinutes === 'number') state.scoreboard.timer.extraMinutes = Math.max(0, extraMinutes);
      if (direction) state.scoreboard.timer.direction = direction;
    }

    saveState();
    io.emit('scoreboard:sync', state.scoreboard);
    io.emit('scoreboard:tick', {
      seconds: state.scoreboard.timer.seconds,
      running: state.scoreboard.timer.running
    });
  });

  socket.on('scoreboard:switch-sides', () => {
    const tempA = JSON.parse(JSON.stringify(state.scoreboard.teamA));
    state.scoreboard.teamA = JSON.parse(JSON.stringify(state.scoreboard.teamB));
    state.scoreboard.teamB = tempA;
    if (state.scoreboard.servingTeam === 'teamA') {
      state.scoreboard.servingTeam = 'teamB';
    } else if (state.scoreboard.servingTeam === 'teamB') {
      state.scoreboard.servingTeam = 'teamA';
    }
    saveState();
    io.emit('scoreboard:sync', state.scoreboard);
  });

  socket.on('scoreboard:trigger-celebration', ({ text, subtext, type }) => {
    state.scoreboard.celebration = {
      type: type || 'custom',
      text: text || 'GOL!',
      subtext: subtext || '',
      timestamp: Date.now()
    };
    saveState();
    io.emit('scoreboard:sync', state.scoreboard);

    setTimeout(() => {
      if (state.scoreboard.celebration) {
        state.scoreboard.celebration = null;
        io.emit('scoreboard:sync', state.scoreboard);
      }
    }, 6000);
  });

  socket.on('scoreboard:reset-match', () => {
    state.scoreboard.teamA.score = 0;
    state.scoreboard.teamA.yellowCards = 0;
    state.scoreboard.teamA.redCards = 0;
    state.scoreboard.teamA.fouls = 0;
    state.scoreboard.teamA.setsWon = 0;
    state.scoreboard.teamA.setHistory = [];

    state.scoreboard.teamB.score = 0;
    state.scoreboard.teamB.yellowCards = 0;
    state.scoreboard.teamB.redCards = 0;
    state.scoreboard.teamB.fouls = 0;
    state.scoreboard.teamB.setsWon = 0;
    state.scoreboard.teamB.setHistory = [];

    state.scoreboard.timer.seconds = 0;
    state.scoreboard.timer.running = false;
    state.scoreboard.timer.extraMinutes = 0;
    state.scoreboard.period = '1T';
    state.scoreboard.periodLabel = '1º Tempo';
    state.scoreboard.currentSet = 1;
    state.scoreboard.celebration = null;

    saveState();
    io.emit('scoreboard:sync', state.scoreboard);
  });

  socket.on('settings:resetDefaults', () => {
    state.settings = {
      ...state.settings,
      theme: 'christmas',
      fontSizePercent: 100,
      overlayScalePercent: 100,
      cardMaxWidthPx: 1020,
      resolutionWidth: 1920,
      resolutionHeight: 1080,
      position: 'bottom-left',
      animationStyle: 'slide-up',
      intervalSeconds: 4,
      defaultDurationSeconds: 10,
      showProgress: true,
      showKicker: true,
      displayMode: 'card',
      tickerSpeedSeconds: 32,
      logoPosition: 'left',
      logoSizePx: 56,
      compactLists: false
    };
    saveState();
    broadcastState();
    notifySettingsChanged(state.settings);
  });
});

let cachedLocalIp = null;
let lastIpCheckAt = 0;

function getLocalIpAddress() {
  const now = Date.now();
  if (cachedLocalIp && now - lastIpCheckAt < 60000) {
    return cachedLocalIp;
  }

  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    const isVirtualName =
      lowerName.includes('vethernet') ||
      lowerName.includes('wsl') ||
      lowerName.includes('virtual') ||
      lowerName.includes('vmware') ||
      lowerName.includes('vbox') ||
      lowerName.includes('vpn') ||
      lowerName.includes('loopback');

    for (const iface of interfaces[name]) {
      if (iface.family !== 'IPv4' || iface.internal) continue;
      // Ignora túneis/VPNs sem MAC físico ou com máscara /32
      const hasPhysicalMac = iface.mac && iface.mac !== '00:00:00:00:00:00';
      const isPointToPoint = iface.netmask === '255.255.255.255';

      let score = 0;
      if (hasPhysicalMac && !isPointToPoint && !isVirtualName) score += 100;
      if (iface.address.startsWith('192.168.')) score += 50;
      else if (iface.address.startsWith('10.')) score += 30;
      if (lowerName.includes('wi-fi') || lowerName.includes('wifi') || lowerName.includes('ethernet')) {
        score += 20;
      }

      candidates.push({ address: iface.address, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  cachedLocalIp = candidates.length > 0 ? candidates[0].address : 'localhost';
  lastIpCheckAt = now;
  return cachedLocalIp;
}

let scoreboardTicker = null;

function startScoreboardTicker() {
  if (scoreboardTicker) return;
  scoreboardTicker = setInterval(() => {
    if (state.scoreboard && state.scoreboard.timer && state.scoreboard.timer.running) {
      const timer = state.scoreboard.timer;
      if (!timer.startedAtMs) {
        timer.startedAtMs = Date.now();
        timer.baseSeconds = timer.seconds || 0;
      }
      const elapsedSec = Math.floor((Date.now() - timer.startedAtMs) / 1000);
      if (timer.direction === 'down') {
        const nextSec = Math.max(0, (timer.baseSeconds || 0) - elapsedSec);
        timer.seconds = nextSec;
        if (nextSec === 0) {
          timer.running = false;
          timer.startedAtMs = null;
        }
      } else {
        timer.seconds = (timer.baseSeconds || 0) + elapsedSec;
      }
      io.emit('scoreboard:tick', {
        seconds: timer.seconds,
        running: timer.running
      });
    }
  }, 1000);
}

function stopScoreboardTicker() {
  if (scoreboardTicker) {
    clearInterval(scoreboardTicker);
    scoreboardTicker = null;
  }
}

/**
 * Inicializa o servidor HTTP + Socket.IO.
 * Pode ser chamado tanto diretamente via `node server.js` quanto pelo processo principal do Electron.
 */
function startServer(preferredPort = PORT) {
  return new Promise((resolve, reject) => {
    let currentPort = Number(preferredPort) || 3000;
    const maxPort = currentPort + 20;

    function tryListen() {
      const onError = (err) => {
        server.removeListener('listening', onListening);
        if (err.code === 'EADDRINUSE') {
          console.warn(`[tImago] Porta ${currentPort} ocupada por outro processo. Tentando porta ${currentPort + 1}...`);
          currentPort++;
          if (currentPort <= maxPort) {
            setTimeout(tryListen, 50);
          } else {
            reject(new Error(`Não foi possível encontrar uma porta livre entre ${preferredPort} e ${maxPort}`));
          }
        } else {
          reject(err);
        }
      };

      const onListening = () => {
        server.removeListener('error', onError);
        activePort = currentPort;
        const localIp = getLocalIpAddress();
        console.log('====================================================');
        console.log('[tImago] SISTEMA DE OVERLAY OBS INICIADO');
        console.log(`[PC]       Painel de Controle:   http://localhost:${currentPort}`);
        console.log(`[REDE]     Painel no Celular:    http://${localIp}:${currentPort}`);
        console.log(`[OBS]      Browser Source:       http://localhost:${currentPort}/overlay`);
        console.log('====================================================');

        startScoreboardTicker();
        syncEngineWithSettings(true);
        resolve({ server, port: currentPort, alreadyRunning: false });
      };

      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(currentPort);
    }

    tryListen();
  });
}

/**
 * Encerra o servidor HTTP e todas as conexões ativas (incluindo o Overlay no OBS)
 */
function stopServer() {
  saveState(true);
  clearRotationTimer();
  stopScoreboardTicker();
  if (global.lowerThirdTimer) {
    clearTimeout(global.lowerThirdTimer);
    global.lowerThirdTimer = null;
  }
  io.emit('app:shutdown');
  io.close();
  server.close();
}

function isOverlayVisible() {
  return Boolean(state?.settings?.visible);
}

if (require.main === module) {
  startServer(PORT);
}

module.exports = {
  startServer,
  stopServer,
  isOverlayVisible,
  getSettings,
  getState,
  onSettingsChange,
  toggleOverlayVisibility
};
