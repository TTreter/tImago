/* ==========================================================================
   OBS OVERLAY CLIENT ENGINE (Real-Time Sync via Socket.IO)
   ========================================================================== */

(function () {
  const socket = io();

  const stageEl = document.getElementById('overlay-stage');
  const cardEl = document.getElementById('overlay-card');
  const themeBadgeIconEl = document.getElementById('theme-badge-icon');
  const audienceKickerEl = document.getElementById('audience-kicker');
  const phraseTextEl = document.getElementById('phrase-text');
  const authorContainerEl = document.getElementById('author-container');
  const phraseAuthorEl = document.getElementById('phrase-author');
  const progressWrapperEl = document.getElementById('progress-wrapper');
  const progressBarEl = document.getElementById('progress-bar');

  let renderedPhraseId = null;
  let renderedPhaseStartedAt = null;
  let switchTimeout = null;
  let progressAnimationFrame = null;

  const VALID_POSITIONS = [
    'bottom-left',
    'bottom-center',
    'bottom-right',
    'top-left',
    'top-center',
    'top-right'
  ];

  const ALL_THEMES = [
    'christmas',
    'christmas-snow',
    'christmas-pine',
    'clean',
    'inst-light',
    'inst-gold',
    'easter-resurrection',
    'easter-royal',
    'easter-olive',
    'mothers-rose',
    'mothers-pearl',
    'fathers-navy',
    'fathers-espresso',
    'soccer-pitch',
    'soccer-champion',
    'new-year',
    'youth-neon',
    'junina-fest'
  ];

  // Ícones SVG exclusivos para o medalhão de cada tema
  const THEME_BADGE_SVGS = {
    'christmas-snow': `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#7DD3FC" stroke-width="2" fill="none"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/></svg>`,
    'christmas-pine': `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#FDE047" stroke-width="2" fill="none"><polygon points="12 2 6 11 10 11 5 19 19 19 14 11 18 11 12 2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`,
    'easter-resurrection': `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#FDE047" stroke-width="2.4" fill="none"><line x1="12" y1="2" x2="12" y2="22"/><line x1="6" y1="8" x2="18" y2="8"/></svg>`,
    'easter-royal': `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#FDE047" stroke-width="2.4" fill="none"><line x1="12" y1="2" x2="12" y2="22"/><line x1="6" y1="8" x2="18" y2="8"/></svg>`,
    'easter-olive': `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#86EFAC" stroke-width="2" fill="none"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
    'mothers-rose': `<svg viewBox="0 0 24 24" width="20" height="20" fill="#FDA4AF" stroke="#FFE4E6" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    'mothers-pearl': `<svg viewBox="0 0 24 24" width="20" height="20" fill="#F43F5E" stroke="#F43F5E" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    'fathers-navy': `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#38BDF8" stroke-width="2" fill="none"><polygon points="12 2 15 8 21 9 17 14 18 20 12 17 6 20 7 14 3 9 9 8 12 2"/></svg>`,
    'fathers-espresso': `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#FBBF24" stroke-width="2" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    'soccer-pitch': `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#FDE047" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><polygon points="12 7 16 10 14.5 15 9.5 15 8 10 12 7"/></svg>`,
    'soccer-champion': `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#38BDF8" stroke-width="2" fill="none"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
    'new-year': `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#FDE047" stroke-width="2" fill="none"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6l2.1-2.1"/></svg>`,
    'youth-neon': `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#22D3EE" stroke-width="2" fill="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    'junina-fest': `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#FDE047" stroke-width="2" fill="none"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`
  };

  function applySettings(settings) {
    if (!settings) return;

    const theme = ALL_THEMES.includes(settings.theme) ? settings.theme : 'christmas';
    ALL_THEMES.forEach((t) => stageEl.classList.remove(`theme-${t}`));
    stageEl.classList.add(`theme-${theme}`);

    if (themeBadgeIconEl) {
      if (THEME_BADGE_SVGS[theme]) {
        themeBadgeIconEl.innerHTML = THEME_BADGE_SVGS[theme];
        themeBadgeIconEl.classList.add('has-badge');
      } else {
        themeBadgeIconEl.innerHTML = '';
        themeBadgeIconEl.classList.remove('has-badge');
      }
    }

    // Posição
    const pos = VALID_POSITIONS.includes(settings.position) ? settings.position : 'bottom-left';
    VALID_POSITIONS.forEach((p) => stageEl.classList.remove(`pos-${p}`));
    stageEl.classList.add(`pos-${pos}`);

    // Barra de progresso
    if (settings.showProgress === false) {
      progressWrapperEl.classList.add('is-disabled');
    } else {
      progressWrapperEl.classList.remove('is-disabled');
    }

    // Tamanho da letra, Escala do Overlay, Largura Máxima e Resolução
    const fontPercent = Math.min(200, Math.max(50, Number(settings.fontSizePercent) || 100));
    const scalePercent = Math.min(160, Math.max(50, Number(settings.overlayScalePercent) || 100));
    const maxWidthPx = Math.min(3400, Math.max(320, Number(settings.cardMaxWidthPx) || 1020));
    const resW = Math.min(7680, Math.max(360, Number(settings.resolutionWidth) || 1920));
    const resH = Math.min(7680, Math.max(360, Number(settings.resolutionHeight) || 1080));

    // Margem segura proporcional à resolução configurada
    const padX = Math.round(Math.max(24, resW * 0.04));
    const padY = Math.round(Math.max(24, resH * 0.052));

    document.documentElement.style.setProperty('--font-scale', (fontPercent / 100).toFixed(2));
    document.documentElement.style.setProperty('--overlay-scale', (scalePercent / 100).toFixed(2));
    document.documentElement.style.setProperty('--card-max-width', `${maxWidthPx}px`);
    document.documentElement.style.setProperty('--res-width', `${resW}px`);
    document.documentElement.style.setProperty('--res-height', `${resH}px`);
    document.documentElement.style.setProperty('--stage-pad-x', `${padX}px`);
    document.documentElement.style.setProperty('--stage-pad-y', `${padY}px`);
  }

  function stopProgressAnimation() {
    if (progressAnimationFrame) {
      cancelAnimationFrame(progressAnimationFrame);
      progressAnimationFrame = null;
    }
  }

  function startProgressAnimation(durationMs, elapsedMs = 0) {
    stopProgressAnimation();

    if (!durationMs || durationMs <= 0) {
      progressBarEl.style.transform = 'scaleX(0)';
      return;
    }

    const startPerf = performance.now() - elapsedMs;

    function tick(now) {
      const elapsed = now - startPerf;
      const ratio = Math.min(1, Math.max(0, elapsed / durationMs));
      progressBarEl.style.transform = `scaleX(${ratio})`;

      if (ratio < 1) {
        progressAnimationFrame = requestAnimationFrame(tick);
      }
    }

    progressAnimationFrame = requestAnimationFrame(tick);
  }

  function setCardContent(phrase) {
    phraseTextEl.textContent = phrase.text || '';

    // Diferencia visualmente recados do público vs frases do carrossel do sistema
    if (audienceKickerEl) {
      if (phrase.source === 'audience') {
        audienceKickerEl.classList.remove('is-hidden');
      } else {
        audienceKickerEl.classList.add('is-hidden');
      }
    }

    const author = (phrase.author || '').trim();
    if (author) {
      phraseAuthorEl.textContent = author;
      authorContainerEl.classList.remove('is-empty');
    } else {
      phraseAuthorEl.textContent = '';
      authorContainerEl.classList.add('is-empty');
    }
  }

  function hideCard() {
    if (switchTimeout) {
      clearTimeout(switchTimeout);
      switchTimeout = null;
    }
    stopProgressAnimation();
    cardEl.classList.remove('is-visible', 'is-switching');
    cardEl.classList.add('is-hidden');
    renderedPhraseId = null;
    renderedPhaseStartedAt = null;
  }

  function renderRuntime(state, runtime) {
    const isVisibleSetting = Boolean(state?.settings?.visible);
    const isShowingPhase = runtime?.phase === 'showing' && Boolean(runtime?.currentPhrase);

    if (!isVisibleSetting || !isShowingPhase) {
      hideCard();
      return;
    }

    const phrase = runtime.currentPhrase;
    const serverNow = runtime.serverNow || Date.now();
    const elapsedMs = Math.max(0, serverNow - (runtime.phaseStartedAt || serverNow));
    const durationMs = runtime.phaseDurationMs || (phrase.duration || 10) * 1000;

    // Caso já esteja exibindo outra frase diferente e trocou direto sem intervalo
    const isCurrentlyVisible = cardEl.classList.contains('is-visible');
    const isDifferentRun =
      renderedPhraseId !== phrase.id || renderedPhaseStartedAt !== runtime.phaseStartedAt;

    if (isCurrentlyVisible && renderedPhraseId && renderedPhraseId !== phrase.id) {
      // Faz uma transição suave rápida entre a frase anterior e a nova
      if (switchTimeout) clearTimeout(switchTimeout);
      cardEl.classList.add('is-switching');

      switchTimeout = setTimeout(() => {
        setCardContent(phrase);
        renderedPhraseId = phrase.id;
        renderedPhaseStartedAt = runtime.phaseStartedAt;
        cardEl.classList.remove('is-switching', 'is-hidden');
        cardEl.classList.add('is-visible');
        startProgressAnimation(durationMs, elapsedMs + 260);
      }, 250);
      return;
    }

    // Atualiza texto/autor (inclusive se o operador editou o texto ao vivo)
    setCardContent(phrase);

    cardEl.classList.remove('is-hidden', 'is-switching');
    cardEl.classList.add('is-visible');

    if (isDifferentRun) {
      renderedPhraseId = phrase.id;
      renderedPhaseStartedAt = runtime.phaseStartedAt;
      startProgressAnimation(durationMs, elapsedMs);
    }
  }

  socket.on('state:sync', (payload) => {
    if (!payload) return;
    applySettings(payload.state?.settings);
    renderRuntime(payload.state, payload.runtime);
  });

  // Quando o aplicativo desktop (tImago.exe) ou o servidor é fechado, recolhe imediatamente o card no OBS
  socket.on('app:shutdown', () => {
    hideCard();
  });

  socket.on('disconnect', () => {
    hideCard();
  });
})();
