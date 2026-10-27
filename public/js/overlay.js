/* ==========================================================================
   OBS OVERLAY CLIENT ENGINE (Real-Time Sync via Socket.IO)
   ========================================================================== */

(function () {
  const socket = io();

  const stageEl = document.getElementById('overlay-stage');
  const cardEl = document.getElementById('overlay-card');
  const cardLogoBoxEl = document.getElementById('card-logo-box');
  const cardLogoImgEl = document.getElementById('card-logo-img');
  const themeBadgeIconEl = document.getElementById('theme-badge-icon');
  const audienceKickerEl = document.getElementById('audience-kicker');
  const phraseTextEl = document.getElementById('phrase-text');
  const authorContainerEl = document.getElementById('author-container');
  const phraseAuthorEl = document.getElementById('phrase-author');
  const progressWrapperEl = document.getElementById('progress-wrapper');
  const progressBarEl = document.getElementById('progress-bar');

  // Elementos Lower Third & Ticker (Fase 5)
  const lowerThirdEl = document.getElementById('overlay-lower-third');
  const ltBadgeEl = document.getElementById('lt-badge');
  const ltTitleEl = document.getElementById('lt-title');
  const ltSubtitleEl = document.getElementById('lt-subtitle');
  const tickerEl = document.getElementById('overlay-ticker');
  const tickerTrackEl = document.getElementById('ticker-track');
  let lastTickerSignature = '';

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
    'junina-fest',
    'october-pink',
    'november-blue',
    'september-yellow',
    'cycling-tour',
    'city-marathon',
    'civil-defense',
    'custom'
  ];

  const VALID_ANIMATIONS = [
    'slide-up',
    'slide-left',
    'slide-right',
    'zoom',
    'fade'
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
    'junina-fest': `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#FDE047" stroke-width="2" fill="none"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
    'october-pink': `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#F9A8D4" stroke-width="2.2" fill="none"><path d="M12 2a5 5 0 0 0-5 5c0 4 5 9 9 14"/><path d="M12 2a5 5 0 0 1 5 5c0 4-5 9-9 14"/></svg>`,
    'november-blue': `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#7DD3FC" stroke-width="2.2" fill="none"><path d="M12 2a5 5 0 0 0-5 5c0 4 5 9 9 14"/><path d="M12 2a5 5 0 0 1 5 5c0 4-5 9-9 14"/></svg>`,
    'september-yellow': `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#FDE047" stroke-width="2.2" fill="none"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
    'cycling-tour': `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#86EFAC" stroke-width="2" fill="none"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>`,
    'city-marathon': `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#FDBA74" stroke-width="2" fill="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    'civil-defense': `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#FB923C" stroke-width="2.2" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
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

    // Estilo de Animação (Fase 4)
    const anim = VALID_ANIMATIONS.includes(settings.animationStyle) ? settings.animationStyle : 'slide-up';
    VALID_ANIMATIONS.forEach((a) => stageEl.classList.remove(`anim-${a}`));
    stageEl.classList.add(`anim-${anim}`);

    // Cores Personalizadas do 19º Tema (Custom Theme)
    if (settings.customThemeColors && typeof settings.customThemeColors === 'object') {
      const c = settings.customThemeColors;
      if (c.bg1) document.documentElement.style.setProperty('--custom-bg1', c.bg1);
      if (c.bg2) document.documentElement.style.setProperty('--custom-bg2', c.bg2);
      if (c.border) document.documentElement.style.setProperty('--custom-border', c.border);
      if (c.text) document.documentElement.style.setProperty('--custom-text', c.text);
      if (c.author) document.documentElement.style.setProperty('--custom-author', c.author);
    }

    // Logo / Ícone Personalizado no Card
    if (cardLogoBoxEl && cardLogoImgEl) {
      if (settings.showLogo && settings.logoDataUrl) {
        if (cardLogoImgEl.getAttribute('src') !== settings.logoDataUrl) {
          cardLogoImgEl.setAttribute('src', settings.logoDataUrl);
        }
        const logoSize = Math.min(140, Math.max(36, Number(settings.logoSizePx) || 56));
        cardLogoImgEl.style.width = `${logoSize}px`;
        cardLogoImgEl.style.height = `${logoSize}px`;

        const logoPos = settings.logoPosition === 'right' ? 'right' : 'left';
        const cardContentRow = cardEl.querySelector('.card-content-row');
        if (cardContentRow) {
          if (logoPos === 'right') {
            cardContentRow.classList.add('logo-pos-right');
          } else {
            cardContentRow.classList.remove('logo-pos-right');
          }
        }
        cardLogoBoxEl.classList.remove('is-hidden');
      } else {
        cardLogoBoxEl.classList.add('is-hidden');
      }
    }

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

    const tickerSpeed = Math.min(180, Math.max(8, Number(settings.tickerSpeedSeconds) || 32));
    document.documentElement.style.setProperty('--ticker-duration', `${tickerSpeed}s`);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function renderLowerThird(state) {
    if (!lowerThirdEl) return;
    const isVisibleGlobal = Boolean(state?.settings?.visible);
    const lt = state?.lowerThird;

    if (!isVisibleGlobal || !lt || !lt.active || !lt.title) {
      lowerThirdEl.classList.remove('is-visible');
      lowerThirdEl.classList.add('is-hidden');
      return;
    }

    if (ltBadgeEl) {
      ltBadgeEl.textContent = lt.badge || '';
      ltBadgeEl.style.display = lt.badge ? 'inline-block' : 'none';
    }
    if (ltTitleEl) ltTitleEl.textContent = lt.title || '';
    if (ltSubtitleEl) ltSubtitleEl.textContent = lt.subtitle || '';

    lowerThirdEl.classList.remove('is-hidden');
    lowerThirdEl.classList.add('is-visible');
  }

  function renderTicker(state) {
    if (!tickerEl || !tickerTrackEl) return;
    const isVisibleGlobal = Boolean(state?.settings?.visible);
    const isTickerMode = state?.settings?.displayMode === 'ticker';

    if (!isVisibleGlobal || !isTickerMode) {
      tickerEl.classList.remove('is-visible');
      tickerEl.classList.add('is-hidden');
      return;
    }

    const audItems = (state?.audienceQueue || []).filter(
      (a) => a.status === 'pending' || a.status === 'showing'
    );
    const sysItems = (state?.phrases || []).filter((p) => p.enabled);

    const combined = [
      ...audItems.map((a) => ({
        text: a.text,
        author: a.author,
        kicker: a.kicker && a.kicker !== '__NONE__' ? a.kicker : (state?.settings?.defaultKickerText || 'PÚBLICO')
      })),
      ...sysItems.map((p) => ({
        text: p.text,
        author: p.author,
        kicker: p.kicker && p.kicker !== '__NONE__' ? p.kicker : ''
      }))
    ];

    if (combined.length === 0) {
      tickerEl.classList.remove('is-visible');
      tickerEl.classList.add('is-hidden');
      return;
    }

    const signature = JSON.stringify(combined);
    if (signature !== lastTickerSignature) {
      lastTickerSignature = signature;
      const singlePassHtml = combined
        .map(
          (item) => `
          <span class="ticker-item">
            ${item.kicker ? `<span class="ticker-item-kicker">${escapeHtml(item.kicker)}</span>` : ''}
            <span>${escapeHtml(item.text)}</span>
            ${item.author ? `<span class="ticker-item-author">— ${escapeHtml(item.author)}</span>` : ''}
            <span class="ticker-sep">•</span>
          </span>
        `
        )
        .join('');
      // Duplica o bloco para criar loop contínuo (-50%) sem salto visual
      tickerTrackEl.innerHTML = singlePassHtml + singlePassHtml;
    }

    tickerEl.classList.remove('is-hidden');
    tickerEl.classList.add('is-visible');
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

  function setCardContent(phrase, settings) {
    phraseTextEl.textContent = phrase.text || '';

    // Diferencia visualmente recados do público ou etiqueta personalizada da frase
    if (audienceKickerEl) {
      const kickerTextSpan = audienceKickerEl.querySelector('.audience-kicker-text');
      const showKickerGlobal = settings?.showKicker !== false;
      const customKicker = (phrase.kicker || '').trim();

      if (!showKickerGlobal || customKicker === '__NONE__') {
        audienceKickerEl.classList.add('is-hidden');
      } else if (customKicker) {
        if (kickerTextSpan) kickerTextSpan.textContent = customKicker;
        audienceKickerEl.classList.remove('is-hidden');
      } else if (phrase.source === 'audience') {
        const defaultLabel = (settings?.defaultKickerText || 'MENSAGEM DO PÚBLICO').trim();
        if (defaultLabel) {
          if (kickerTextSpan) kickerTextSpan.textContent = defaultLabel;
          audienceKickerEl.classList.remove('is-hidden');
        } else {
          audienceKickerEl.classList.add('is-hidden');
        }
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
    renderLowerThird(state);
    renderTicker(state);

    const isVisibleSetting = Boolean(state?.settings?.visible);
    const isTickerMode = state?.settings?.displayMode === 'ticker';
    const isShowingPhase = runtime?.phase === 'showing' && Boolean(runtime?.currentPhrase);

    if (!isVisibleSetting || isTickerMode || !isShowingPhase) {
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
        setCardContent(phrase, state?.settings);
        renderedPhraseId = phrase.id;
        renderedPhaseStartedAt = runtime.phaseStartedAt;
        cardEl.classList.remove('is-switching', 'is-hidden');
        cardEl.classList.add('is-visible');
        startProgressAnimation(durationMs, elapsedMs + 260);
      }, 250);
      return;
    }

    // Atualiza texto/autor (inclusive se o operador editou o texto ao vivo)
    setCardContent(phrase, state?.settings);

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
    if (lowerThirdEl) lowerThirdEl.classList.replace('is-visible', 'is-hidden');
    if (tickerEl) tickerEl.classList.replace('is-visible', 'is-hidden');
  });

  socket.on('disconnect', () => {
    hideCard();
    if (lowerThirdEl) lowerThirdEl.classList.replace('is-visible', 'is-hidden');
    if (tickerEl) tickerEl.classList.replace('is-visible', 'is-hidden');
  });
})();
