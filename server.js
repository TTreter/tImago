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
const io = new Server(server);

const PORT = process.env.PORT || 3000;

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
    defaultKickerText: 'MENSAGEM DO PÚBLICO'
  },
  activePlaylistId: 'pl-christmas',
  playlists: [
    {
      id: 'pl-christmas',
      name: '🎄 Cantata de Natal',
      phrases: [
        {
          id: 'p-1',
          text: 'Sejam todos muito bem-vindos à nossa Cantata de Natal! Que a paz e a esperança desta noite preencham o seu lar.',
          author: 'Coral & Organização',
          duration: 10,
          enabled: true
        },
        {
          id: 'p-2',
          text: '"Porque um menino nos nasceu, um filho se nos deu; o governo está sobre os seus ombros; e o seu nome será: Maravilhoso Conselheiro, Deus Forte, Pai da Eternidade, Príncipe da Paz."',
          author: 'Isaías 9:6',
          duration: 12,
          enabled: true
        },
        {
          id: 'p-3',
          text: 'Deixe sua mensagem de Natal no chat! Vamos exibir os recados e felicitações especiais aqui na tela durante a transmissão.',
          author: 'Participe ao Vivo',
          duration: 9,
          enabled: true
        },
        {
          id: 'p-4',
          text: '"Glória a Deus nas maiores alturas, e paz na terra entre os homens, a quem ele quer bem!"',
          author: 'Lucas 2:14',
          duration: 9,
          enabled: true
        }
      ]
    },
    {
      id: 'pl-worship',
      name: '⛪ Culto & Avisos Gerais',
      phrases: [
        {
          id: 'p-w1',
          text: 'Sejam bem-vindos ao nosso culto ao vivo! Compartilhe esta transmissão com sua família e amigos.',
          author: 'Recepção & Mídia',
          duration: 10,
          enabled: true
        },
        {
          id: 'p-w2',
          text: '"O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti e tenha misericórdia de ti."',
          author: 'Números 6:24-25',
          duration: 11,
          enabled: true
        }
      ]
    },
    {
      id: 'pl-easter',
      name: '🕊️ Especial de Páscoa',
      phrases: [
        {
          id: 'p-e1',
          text: '"Ele não está aqui, porque já ressuscitou, como havia dito! Cristo vive para sempre!"',
          author: 'Mateus 28:6',
          duration: 11,
          enabled: true
        }
      ]
    }
  ],
  phrases: [
    {
      id: 'p-1',
      text: 'Sejam todos muito bem-vindos à nossa Cantata de Natal! Que a paz e a esperança desta noite preencham o seu lar.',
      author: 'Coral & Organização',
      duration: 10,
      enabled: true
    },
    {
      id: 'p-2',
      text: '"Porque um menino nos nasceu, um filho se nos deu; o governo está sobre os seus ombros; e o seu nome será: Maravilhoso Conselheiro, Deus Forte, Pai da Eternidade, Príncipe da Paz."',
      author: 'Isaías 9:6',
      duration: 12,
      enabled: true
    },
    {
      id: 'p-3',
      text: 'Deixe sua mensagem de Natal no chat! Vamos exibir os recados e felicitações especiais aqui na tela durante a transmissão.',
      author: 'Participe ao Vivo',
      duration: 9,
      enabled: true
    },
    {
      id: 'p-4',
      text: '"Glória a Deus nas maiores alturas, e paz na terra entre os homens, a quem ele quer bem!"',
      author: 'Lucas 2:14',
      duration: 9,
      enabled: true
    }
  ],
  audienceQueue: []
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
 * Garante que a estrutura de playlists exista e esteja sincronizada com state.phrases
 */
function ensurePlaylistsStructure(st) {
  if (!Array.isArray(st.playlists) || st.playlists.length === 0) {
    const initialPhrases = Array.isArray(st.phrases) && st.phrases.length > 0
      ? st.phrases
      : JSON.parse(JSON.stringify(defaultState.phrases));
    st.playlists = [
      {
        id: 'pl-christmas',
        name: '🎄 Cantata de Natal',
        phrases: initialPhrases
      },
      ...JSON.parse(JSON.stringify(defaultState.playlists.slice(1)))
    ];
    st.activePlaylistId = 'pl-christmas';
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
        activePlaylistId: parsed.activePlaylistId || 'pl-christmas',
        playlists: Array.isArray(parsed.playlists) ? parsed.playlists : [],
        phrases: Array.isArray(parsed.phrases) ? parsed.phrases : defaultState.phrases,
        audienceQueue: Array.isArray(parsed.audienceQueue) ? parsed.audienceQueue : []
      };
      return ensurePlaylistsStructure(loaded);
    }
  } catch (err) {
    console.error('Erro ao carregar state.json:', err.message);
  }
  return ensurePlaylistsStructure(JSON.parse(JSON.stringify(defaultState)));
}

/**
 * Salva o estado atual em disco de forma síncrona e segura, sincronizando a playlist ativa
 */
function saveState() {
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
  } catch (err) {
    console.error('Erro ao salvar state.json:', err.message);
  }
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
      pendingAudienceCount: getPendingAudiencePhrases().length
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
      pendingAudienceCount: getPendingAudiencePhrases().length
    }
  });

  socket.on('settings:update', (partialSettings) => {
    const prevVisible = state.settings.visible;
    const prevAutoRotate = state.settings.autoRotate;

    state.settings = {
      ...state.settings,
      ...partialSettings
    };
    saveState();

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
    const text = String(payload?.text || '').trim();
    if (!text) return;

    const author = String(payload?.author || '').trim();
    const kicker = payload?.kicker !== undefined ? String(payload.kicker).trim() : '';
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
      text: payload.text !== undefined ? String(payload.text).trim() : current.text,
      author: payload.author !== undefined ? String(payload.author).trim() : current.author,
      kicker: payload.kicker !== undefined ? String(payload.kicker).trim() : (current.kicker || ''),
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
    const text = String(payload?.text || '').trim();
    if (!text) return;

    const author = String(payload?.author || '').trim();
    const kicker = payload?.kicker !== undefined ? String(payload.kicker).trim() : '';
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
      text: payload.text !== undefined ? String(payload.text).trim() : current.text,
      author: payload.author !== undefined ? String(payload.author).trim() : current.author,
      kicker: payload.kicker !== undefined ? String(payload.kicker).trim() : (current.kicker || ''),
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

    state = ensurePlaylistsStructure(state);
    runtime.queueIndex = -1;
    saveState();
    syncEngineWithSettings(true);
  });
});

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

/**
 * Inicializa o servidor HTTP + Socket.IO.
 * Pode ser chamado tanto diretamente via `node server.js` quanto pelo processo principal do Electron.
 */
function startServer(port = PORT) {
  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Porta ${port} já está em uso. Conectando à instância ativa...`);
        resolve({ server, port, alreadyRunning: true });
      } else {
        reject(err);
      }
    });

    server.listen(port, () => {
      const localIp = getLocalIpAddress();
      console.log('====================================================');
      console.log('🎬 tImago — SISTEMA DE OVERLAY OBS INICIADO!');
      console.log(`🖥️  Painel de Controle (PC):   http://localhost:${port}`);
      console.log(`📱 Painel na Rede (Celular):  http://${localIp}:${port}`);
      console.log(`🎥 URL para Browser no OBS:   http://localhost:${port}/overlay`);
      console.log('====================================================');

      syncEngineWithSettings(true);
      resolve({ server, port, alreadyRunning: false });
    });
  });
}

/**
 * Encerra o servidor HTTP e todas as conexões ativas (incluindo o Overlay no OBS)
 */
function stopServer() {
  clearRotationTimer();
  io.emit('app:shutdown');
  io.close();
  server.close();
}

if (require.main === module) {
  startServer(PORT);
}

module.exports = { startServer, stopServer };
