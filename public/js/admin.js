/* ==========================================================================
   tImago — PAINEL DE CONTROLE OBS OVERLAY (LÓGICA DO OPERADOR - Socket.IO)
   ========================================================================== */

(function () {
  const socket = io();

  // Ícones SVG Inline para geração dinâmica nas listas
  const ICONS = {
    play: '<svg class="icon-svg icon-xs" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>',
    user: '<svg class="icon-svg icon-xs" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    clock: '<svg class="icon-svg icon-xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    up: '<svg class="icon-svg icon-xs" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"></polyline></svg>',
    down: '<svg class="icon-svg icon-xs" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>',
    edit: '<svg class="icon-svg icon-xs" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
    trash: '<svg class="icon-svg icon-xs" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
    requeue: '<svg class="icon-svg icon-xs" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>',
    inbox: '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>'
  };

  // Navegação entre Visões (Operação Ao Vivo vs Página de Configurações)
  const navBtnLive = document.getElementById('nav-btn-live');
  const navBtnSettings = document.getElementById('nav-btn-settings');
  const viewLive = document.getElementById('view-live');
  const viewSettings = document.getElementById('view-settings');
  const btnJumpToSettings = document.getElementById('btn-jump-to-settings');
  const btnBackToLive = document.getElementById('btn-back-to-live');

  // Elementos da Página de Configurações
  const topbarOrgName = document.getElementById('topbar-org-name');
  const settingOrgName = document.getElementById('setting-organization-name');
  const settingStartWithWindows = document.getElementById('setting-start-with-windows');
  const settingStartMinimized = document.getElementById('setting-start-minimized');
  const settingCloseBehavior = document.getElementById('setting-close-behavior');
  const settingLogoPosition = document.getElementById('setting-logo-position');
  const settingLogoSize = document.getElementById('setting-logo-size');
  const settingCompactLists = document.getElementById('setting-compact-lists');
  const btnResetDefaults = document.getElementById('btn-reset-defaults');
  const quickThemeSelect = document.getElementById('quick-theme-select');
  const quickDisplayMode = document.getElementById('quick-display-mode');
  const diagUrlReception = document.getElementById('diag-url-reception');
  const diagUrlFull = document.getElementById('diag-url-full');

  // Elementos do Topo e Status Ao Vivo
  const obsUrlDisplay = document.getElementById('obs-url-display');
  const btnCopyUrl = document.getElementById('btn-copy-url');
  const btnToggleVisible = document.getElementById('btn-toggle-visible');
  const masterAirLabel = document.getElementById('master-air-label');

  const liveFloatingPopup = document.getElementById('live-floating-popup');
  const livePhaseBadge = document.getElementById('live-phase-badge');
  const liveCurrentText = document.getElementById('live-current-text');
  const liveCurrentAuthor = document.getElementById('live-current-author');
  const liveCountdown = document.getElementById('live-countdown');
  const liveMiniProgressBar = document.getElementById('live-mini-progress-bar');
  const btnNextPhrase = document.getElementById('btn-next-phrase');
  const btnClearCurrent = document.getElementById('btn-clear-current');

  // Formulário da Fila do Público / Ouvintes
  const formAddAudience = document.getElementById('form-add-audience');
  const audInputText = document.getElementById('aud-input-text');
  const audInputAuthor = document.getElementById('aud-input-author');
  const audInputKicker = document.getElementById('aud-input-kicker');
  const audInputDuration = document.getElementById('aud-input-duration');
  const btnAudShowNow = document.getElementById('btn-aud-show-now');
  const btnStartAudienceBatch = document.getElementById('btn-start-audience-batch');
  const labelStartAudienceBatch = document.getElementById('label-start-audience-batch');
  const btnPauseAudienceBatch = document.getElementById('btn-pause-audience-batch');
  const toggleAudienceHoldMode = document.getElementById('toggle-audience-hold-mode');
  const audienceListEl = document.getElementById('audience-list');
  const audienceCounterEl = document.getElementById('audience-counter');
  const btnClearPlayedAudience = document.getElementById('btn-clear-played-audience');

  // Formulário e Lista de Frases Fixas do Sistema (Carrossel)
  const btnToggleSysForm = document.getElementById('btn-toggle-sys-form');
  const carouselStatusPill = document.getElementById('carousel-status-pill');
  const formAddPhrase = document.getElementById('form-add-phrase');
  const inputText = document.getElementById('input-text');
  const inputAuthor = document.getElementById('input-author');
  const inputKicker = document.getElementById('input-kicker');
  const inputDuration = document.getElementById('input-duration');
  const btnAddAndShow = document.getElementById('btn-add-and-show');

  // Busca e Ações em Massa do Carrossel
  const inputSearchPhrases = document.getElementById('input-search-phrases');
  const btnEnableAllPhrases = document.getElementById('btn-enable-all-phrases');
  const btnDisableAllPhrases = document.getElementById('btn-disable-all-phrases');

  // Playlists (Eventos) e Backup JSON (Fase 2)
  const selectPlaylist = document.getElementById('select-playlist');
  const btnCreatePlaylist = document.getElementById('btn-create-playlist');
  const btnRenamePlaylist = document.getElementById('btn-rename-playlist');
  const btnDeletePlaylist = document.getElementById('btn-delete-playlist');
  const playlistModal = document.getElementById('playlist-modal');
  const playlistModalTitle = document.getElementById('playlist-modal-title');
  const playlistModalMode = document.getElementById('playlist-modal-mode');
  const playlistModalName = document.getElementById('playlist-modal-name');
  const formPlaylistModal = document.getElementById('form-playlist-modal');
  const btnClosePlaylistModal = document.getElementById('btn-close-playlist-modal');
  const btnCancelPlaylistModal = document.getElementById('btn-cancel-playlist-modal');
  const btnExportBackup = document.getElementById('btn-export-backup');
  const btnImportBackup = document.getElementById('btn-import-backup');
  const inputImportJson = document.getElementById('input-import-json');

  // Controle Mobile (QR Code) & Modo Recepção (Fase 3)
  const btnOpenMobileQr = document.getElementById('btn-open-mobile-qr');
  const labelMobileQr = document.getElementById('label-mobile-qr');
  const btnToggleReceptionMode = document.getElementById('btn-toggle-reception-mode');
  const mobileQrModal = document.getElementById('mobile-qr-modal');
  const btnCloseQrModal = document.getElementById('btn-close-qr-modal');
  const btnCloseQrFooter = document.getElementById('btn-close-qr-footer');
  const qrSvgReception = document.getElementById('qr-svg-reception');
  const qrUrlReception = document.getElementById('qr-url-reception');
  const qrSvgFull = document.getElementById('qr-svg-full');
  const qrUrlFull = document.getElementById('qr-url-full');

  const phrasesListEl = document.getElementById('phrases-list');
  const phrasesCounterEl = document.getElementById('phrases-counter');

  // Abas e Seletor de Fundo do Preview
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const bgSwitchBtns = document.querySelectorAll('.bg-switch-btn');
  const previewBackdrop = document.getElementById('preview-backdrop');

  // Configurações e Temas
  const themeBtns = document.querySelectorAll('.theme-option-btn');
  const themeCatBtns = document.querySelectorAll('.theme-cat-btn');
  const activeThemeNamePill = document.getElementById('active-theme-name-pill');
  const posBtns = document.querySelectorAll('.pos-btn');
  const toggleAutoRotate = document.getElementById('toggle-auto-rotate');
  const toggleShowProgress = document.getElementById('toggle-show-progress');
  const toggleShowKicker = document.getElementById('toggle-show-kicker');
  const settingDefaultKicker = document.getElementById('setting-default-kicker');
  const settingInterval = document.getElementById('setting-interval');
  const settingDefaultDuration = document.getElementById('setting-default-duration');

  // Controles de Tamanho da Letra e Escala do Overlay
  const settingFontSize = document.getElementById('setting-font-size');
  const labelFontSize = document.getElementById('label-font-size');
  const settingOverlayScale = document.getElementById('setting-overlay-scale');
  const labelOverlayScale = document.getElementById('label-overlay-scale');
  const settingCardWidth = document.getElementById('setting-card-width');
  const labelCardWidth = document.getElementById('label-card-width');
  const btnResetSizes = document.getElementById('btn-reset-sizes');

  // Animação, Logo e Cores do Tema Custom (Fase 4)
  const customThemeColorsBox = document.getElementById('custom-theme-colors-box');
  const colorCustomBg1 = document.getElementById('color-custom-bg1');
  const colorCustomBg2 = document.getElementById('color-custom-bg2');
  const colorCustomBorder = document.getElementById('color-custom-border');
  const colorCustomText = document.getElementById('color-custom-text');
  const colorCustomAuthor = document.getElementById('color-custom-author');
  const settingAnimationStyle = document.getElementById('setting-animation-style');
  const toggleShowLogo = document.getElementById('toggle-show-logo');
  const btnUploadLogo = document.getElementById('btn-upload-logo');
  const btnRemoveLogo = document.getElementById('btn-remove-logo');
  const inputLogoFile = document.getElementById('input-logo-file');

  // Ticker de Rodapé e Tarja Lower Third (Fase 5)
  const settingDisplayMode = document.getElementById('setting-display-mode');
  const tickerSpeedBox = document.getElementById('ticker-speed-box');
  const settingTickerSpeed = document.getElementById('setting-ticker-speed');
  const formLowerThird = document.getElementById('form-lower-third');
  const ltInputBadge = document.getElementById('lt-input-badge');
  const ltInputTitle = document.getElementById('lt-input-title');
  const ltInputSubtitle = document.getElementById('lt-input-subtitle');
  const ltInputAutohide = document.getElementById('lt-input-autohide');
  const btnHideLowerThird = document.getElementById('btn-hide-lower-third');
  const ltStatusPill = document.getElementById('lt-status-pill');

  // Controles de Resolução
  const resPresetBtns = document.querySelectorAll('.res-preset-btn');
  const settingResWidth = document.getElementById('setting-res-width');
  const settingResHeight = document.getElementById('setting-res-height');
  const previewResBadge = document.getElementById('preview-res-badge');

  // Preview 16:9
  const previewWrapper = document.getElementById('preview-wrapper');
  const previewIframe = document.getElementById('overlay-preview-iframe');

  // Modal de Edição
  const editModal = document.getElementById('edit-modal');
  const editModalTitle = document.getElementById('edit-modal-title');
  const formEditPhrase = document.getElementById('form-edit-phrase');
  const editIdInput = document.getElementById('edit-id');
  const editSourceInput = document.getElementById('edit-source');
  const editTextInput = document.getElementById('edit-text');
  const editAuthorInput = document.getElementById('edit-author');
  const editKickerInput = document.getElementById('edit-kicker');
  const editDurationInput = document.getElementById('edit-duration');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');

  let currentState = null;
  let currentRuntime = null;
  let countdownInterval = null;
  let defaultDurationInitialized = false;

  // Define a URL dinâmica correta para copiar no OBS
  const overlayFullUrl = `${window.location.origin}/overlay`;
  obsUrlDisplay.textContent = overlayFullUrl;

  btnCopyUrl.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(overlayFullUrl);
      const spanEl = btnCopyUrl.querySelector('span');
      const original = spanEl ? spanEl.textContent : 'Copiar Link';
      if (spanEl) spanEl.textContent = 'Copiado!';
      setTimeout(() => {
        if (spanEl) spanEl.textContent = original;
      }, 1800);
    } catch {
      prompt('Copie a URL abaixo para o OBS Browser Source:', overlayFullUrl);
    }
  });

  // ==========================================================================
  // NAVEGAÇÃO ENTRE TELAS: OPERAÇÃO AO VIVO vs PLACAR ESPORTIVO vs CONFIGURAÇÕES
  // ==========================================================================
  const navBtnSports = document.getElementById('nav-btn-sports');
  const viewSports = document.getElementById('view-sports');

  function switchView(viewName) {
    const isLive = viewName === 'live';
    const isSports = viewName === 'sports';
    const isSettings = viewName === 'settings';

    if (navBtnLive) navBtnLive.classList.toggle('active', isLive);
    if (navBtnSports) navBtnSports.classList.toggle('active', isSports);
    if (navBtnSettings) navBtnSettings.classList.toggle('active', isSettings);

    if (viewLive) viewLive.classList.toggle('active', isLive);
    if (viewSports) viewSports.classList.toggle('active', isSports);
    if (viewSettings) viewSettings.classList.toggle('active', isSettings);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(updatePreviewScale, 60);
  }

  if (navBtnLive) navBtnLive.addEventListener('click', () => switchView('live'));
  if (navBtnSports) navBtnSports.addEventListener('click', () => switchView('sports'));
  if (navBtnSettings) navBtnSettings.addEventListener('click', () => switchView('settings'));
  if (btnJumpToSettings) btnJumpToSettings.addEventListener('click', () => switchView('settings'));
  if (btnBackToLive) btnBackToLive.addEventListener('click', () => switchView('live'));

  const THEME_NAMES = {
    'clean': 'Clean Dark Pro (Prefeitura)',
    'inst-light': 'Clean Alabaster (Institucional)',
    'inst-gold': 'Solene Black & Gold (Cerimonial)',
    'civil-defense': 'Defesa Civil & Alerta (Laranja)',
    'october-pink': 'Outubro Rosa (Saúde da Mulher)',
    'november-blue': 'Novembro Azul (Saúde do Homem)',
    'september-yellow': 'Setembro Amarelo (Prevenção)',
    'cycling-tour': 'Passeio Ciclístico (Verde)',
    'city-marathon': 'Corrida & Movimento (Esporte)',
    'soccer-pitch': 'Arena Gramado (Futebol)',
    'soccer-champion': 'Noite de Copa (Azul Champions)',
    'christmas': 'Natal Luz Municipal (Rubi & Ouro)',
    'christmas-snow': 'Noite Feliz (Azul Gelo)',
    'christmas-pine': 'Bosque Real (Pinheiro & Ouro)',
    'easter-resurrection': 'Aurora de Páscoa (Luz & Ouro)',
    'easter-royal': 'Páscoa Imperial (Púrpura & Ouro)',
    'easter-olive': 'Outono & Paz (Verde Sálvia)',
    'mothers-rose': 'Jardim de Rosas (Rubi Rosé)',
    'mothers-pearl': 'Pérola & Afeto (Creme & Coral)',
    'fathers-navy': 'Executivo Navy (Azul Marinho)',
    'fathers-espresso': 'Clássico Espresso (Tabaco)',
    'new-year': 'Réveillon na Praça (Champanhe)',
    'youth-neon': 'Festival & Podcast (Cyber Neon)',
    'junina-fest': 'Arraial Municipal (Terracota)',
    'custom': 'Tema Personalizado'
  };

  if (quickThemeSelect) {
    Object.entries(THEME_NAMES).forEach(([key, label]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = label;
      quickThemeSelect.appendChild(opt);
    });
    quickThemeSelect.addEventListener('change', () => {
      socket.emit('settings:update', { theme: quickThemeSelect.value });
    });
  }

  if (quickDisplayMode) {
    quickDisplayMode.addEventListener('change', () => {
      socket.emit('settings:update', { displayMode: quickDisplayMode.value });
    });
  }

  if (settingOrgName) {
    settingOrgName.addEventListener('change', () => {
      socket.emit('settings:update', { organizationName: settingOrgName.value.trim() });
    });
  }
  if (settingStartWithWindows) {
    settingStartWithWindows.addEventListener('change', () => {
      socket.emit('settings:update', { startWithWindows: settingStartWithWindows.checked });
    });
  }
  if (settingStartMinimized) {
    settingStartMinimized.addEventListener('change', () => {
      socket.emit('settings:update', { startMinimized: settingStartMinimized.checked });
    });
  }
  if (settingCloseBehavior) {
    settingCloseBehavior.addEventListener('change', () => {
      socket.emit('settings:update', { closeBehavior: settingCloseBehavior.value });
    });
  }
  if (settingLogoPosition) {
    settingLogoPosition.addEventListener('change', () => {
      socket.emit('settings:update', { logoPosition: settingLogoPosition.value });
    });
  }
  if (settingLogoSize) {
    settingLogoSize.addEventListener('input', () => {
      socket.emit('settings:update', { logoSizePx: Number(settingLogoSize.value) || 56 });
    });
  }
  if (settingCompactLists) {
    settingCompactLists.addEventListener('change', () => {
      socket.emit('settings:update', { compactLists: settingCompactLists.checked });
    });
  }
  if (btnResetDefaults) {
    btnResetDefaults.addEventListener('click', () => {
      if (confirm('Deseja realmente restaurar as configurações visuais e técnicas de fábrica?')) {
        socket.emit('settings:resetDefaults');
      }
    });
  }

  // Navegação por Abas na Coluna Direita
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tab;
      tabBtns.forEach((b) => b.classList.toggle('active', b === btn));
      tabPanes.forEach((pane) => pane.classList.toggle('active', pane.id === targetId));
    });
  });

  // Alternador de Fundo de Simulação do Preview
  bgSwitchBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.bg || 'grid';
      bgSwitchBtns.forEach((b) => b.classList.toggle('active', b === btn));
      if (previewBackdrop) {
        previewBackdrop.classList.remove('bg-mode-grid', 'bg-mode-dark', 'bg-mode-warm');
        previewBackdrop.classList.add(`bg-mode-${mode}`);
      }
    });
  });

  // Filtro por Categoria na Galeria de Temas
  themeCatBtns.forEach((catBtn) => {
    catBtn.addEventListener('click', () => {
      const cat = catBtn.dataset.cat || 'all';
      themeCatBtns.forEach((b) => b.classList.toggle('active', b === catBtn));
      themeBtns.forEach((tBtn) => {
        const match = cat === 'all' || tBtn.dataset.cat === cat;
        tBtn.classList.toggle('is-filtered-out', !match);
      });
    });
  });

  // Escala proporcional do Preview (Resolução Dinâmica) dentro do card lateral
  let previewResizeRaf = null;
  function scheduleUpdatePreviewScale() {
    if (previewResizeRaf) return;
    previewResizeRaf = requestAnimationFrame(() => {
      previewResizeRaf = null;
      updatePreviewScale();
    });
  }

  function updatePreviewScale() {
    if (!previewWrapper || !previewIframe) return;
    const resW = Math.max(360, Number(currentState?.settings?.resolutionWidth) || 1920);
    const resH = Math.max(360, Number(currentState?.settings?.resolutionHeight) || 1080);

    previewWrapper.style.aspectRatio = `${resW} / ${resH}`;
    previewIframe.style.width = `${resW}px`;
    previewIframe.style.height = `${resH}px`;

    const width = previewWrapper.clientWidth;
    const scale = width / resW;
    previewIframe.style.transform = `scale(${scale})`;
  }

  if (typeof ResizeObserver !== 'undefined' && previewWrapper) {
    const previewRo = new ResizeObserver(() => scheduleUpdatePreviewScale());
    previewRo.observe(previewWrapper);
  } else {
    window.addEventListener('resize', scheduleUpdatePreviewScale);
  }
  updatePreviewScale();

  // ==========================================================================
  // RENDERIZAÇÃO DO ESTADO E MONITOR AO VIVO
  // ==========================================================================
  function renderMasterControls(settings) {
    if (!settings) return;

    if (settings.visible) {
      btnToggleVisible.classList.remove('is-off');
      btnToggleVisible.classList.add('is-on');
      masterAirLabel.textContent = 'NO AR (VISÍVEL)';
    } else {
      btnToggleVisible.classList.remove('is-on');
      btnToggleVisible.classList.add('is-off');
      masterAirLabel.textContent = 'OCULTO (OFF AIR)';
    }

    themeBtns.forEach((btn) => {
      const isAct = btn.dataset.theme === settings.theme;
      btn.classList.toggle('active', isAct);
      if (isAct && activeThemeNamePill) {
        const strongEl = btn.querySelector('.theme-info strong');
        if (strongEl) activeThemeNamePill.textContent = strongEl.textContent;
      }
    });

    if (customThemeColorsBox) {
      customThemeColorsBox.classList.toggle('is-hidden', settings.theme !== 'custom');
    }
    if (settings.customThemeColors) {
      const c = settings.customThemeColors;
      if (colorCustomBg1 && c.bg1) colorCustomBg1.value = c.bg1;
      if (colorCustomBg2 && c.bg2) colorCustomBg2.value = c.bg2;
      if (colorCustomBorder && c.border) colorCustomBorder.value = c.border;
      if (colorCustomText && c.text) colorCustomText.value = c.text;
      if (colorCustomAuthor && c.author) colorCustomAuthor.value = c.author;
    }

    if (settingAnimationStyle && document.activeElement !== settingAnimationStyle) {
      settingAnimationStyle.value = settings.animationStyle || 'slide-up';
    }
    if (toggleShowLogo) {
      toggleShowLogo.checked = Boolean(settings.showLogo);
    }
    if (btnRemoveLogo) {
      btnRemoveLogo.classList.toggle('is-hidden', !settings.logoDataUrl);
    }

    const dispMode = settings.displayMode === 'ticker' ? 'ticker' : 'card';
    if (settingDisplayMode && document.activeElement !== settingDisplayMode) {
      settingDisplayMode.value = dispMode;
    }
    if (quickDisplayMode && document.activeElement !== quickDisplayMode) {
      quickDisplayMode.value = dispMode;
    }
    if (quickThemeSelect && document.activeElement !== quickThemeSelect) {
      quickThemeSelect.value = settings.theme || 'christmas';
    }
    if (topbarOrgName) {
      topbarOrgName.textContent = settings.organizationName || 'Prefeitura Municipal • ASCOM';
    }
    if (settingOrgName && document.activeElement !== settingOrgName) {
      settingOrgName.value = settings.organizationName || 'Prefeitura Municipal';
    }
    if (settingStartWithWindows) {
      settingStartWithWindows.checked = Boolean(settings.startWithWindows);
    }
    if (settingStartMinimized) {
      settingStartMinimized.checked = Boolean(settings.startMinimized);
    }
    if (settingCloseBehavior && document.activeElement !== settingCloseBehavior) {
      settingCloseBehavior.value = settings.closeBehavior || 'tray';
    }
    if (settingLogoPosition && document.activeElement !== settingLogoPosition) {
      settingLogoPosition.value = settings.logoPosition || 'left';
    }
    if (settingLogoSize && document.activeElement !== settingLogoSize) {
      settingLogoSize.value = settings.logoSizePx || 56;
    }
    if (settingCompactLists) {
      settingCompactLists.checked = Boolean(settings.compactLists);
      document.body.classList.toggle('is-compact-lists', Boolean(settings.compactLists));
    }
    if (tickerSpeedBox) {
      tickerSpeedBox.classList.toggle('is-hidden', dispMode !== 'ticker');
    }
    if (settingTickerSpeed && document.activeElement !== settingTickerSpeed) {
      settingTickerSpeed.value = settings.tickerSpeedSeconds ?? 32;
    }

    posBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.pos === settings.position);
    });

    toggleAutoRotate.checked = Boolean(settings.autoRotate);
    toggleShowProgress.checked = settings.showProgress !== false;
    if (toggleShowKicker) {
      toggleShowKicker.checked = settings.showKicker !== false;
    }
    if (settingDefaultKicker && document.activeElement !== settingDefaultKicker) {
      settingDefaultKicker.value = settings.defaultKickerText ?? 'MENSAGEM DO PÚBLICO';
    }
    if (toggleAudienceHoldMode) {
      toggleAudienceHoldMode.checked = settings.audienceHoldMode !== false;
    }

    if (document.activeElement !== settingInterval) {
      settingInterval.value = settings.intervalSeconds ?? 4;
    }
    if (document.activeElement !== settingDefaultDuration) {
      settingDefaultDuration.value = settings.defaultDurationSeconds ?? 10;
    }
    if (!defaultDurationInitialized) {
      inputDuration.value = settings.defaultDurationSeconds ?? 10;
      if (audInputDuration) audInputDuration.value = settings.defaultDurationSeconds ?? 10;
      defaultDurationInitialized = true;
    }

    // Sliders de Tamanho da Letra, Escala do Overlay e Largura
    const fontPercent = Number(settings.fontSizePercent) || 100;
    const scalePercent = Number(settings.overlayScalePercent) || 100;
    const cardWidthPx = Number(settings.cardMaxWidthPx) || 1020;

    if (settingFontSize && document.activeElement !== settingFontSize) {
      settingFontSize.value = fontPercent;
    }
    if (labelFontSize) labelFontSize.textContent = `${fontPercent}%`;

    if (settingOverlayScale && document.activeElement !== settingOverlayScale) {
      settingOverlayScale.value = scalePercent;
    }
    if (labelOverlayScale) labelOverlayScale.textContent = `${scalePercent}%`;

    if (settingCardWidth && document.activeElement !== settingCardWidth) {
      settingCardWidth.value = cardWidthPx;
    }
    if (labelCardWidth) labelCardWidth.textContent = `${cardWidthPx}px`;

    // Resolução configurada
    const resW = Number(settings.resolutionWidth) || 1920;
    const resH = Number(settings.resolutionHeight) || 1080;

    if (settingResWidth && document.activeElement !== settingResWidth) {
      settingResWidth.value = resW;
    }
    if (settingResHeight && document.activeElement !== settingResHeight) {
      settingResHeight.value = resH;
    }
    if (previewResBadge) {
      previewResBadge.textContent = `${resW}×${resH}`;
    }

    resPresetBtns.forEach((btn) => {
      const bw = Number(btn.dataset.w);
      const bh = Number(btn.dataset.h);
      btn.classList.toggle('active', bw === resW && bh === resH);
    });

    updatePreviewScale();
  }

  let _lastMonitorText = '';
  let _lastMonitorAuthor = '';
  let _lastMonitorCountdown = '';
  let _lastMonitorProgressPct = -1;

  function setElTextIfChanged(el, text) {
    if (el && el.textContent !== text) {
      el.textContent = text;
    }
  }

  function updateLiveMonitorTick() {
    if (!currentState || !currentRuntime) return;

    const visible = Boolean(currentState.settings?.visible);
    const phase = currentRuntime.phase;
    const phrase = currentRuntime.currentPhrase;

    if (liveFloatingPopup) {
      liveFloatingPopup.classList.toggle('is-showing-now', visible && phase === 'showing');
    }

    if (!visible) {
      if (livePhaseBadge.className !== 'phase-badge phase-off') {
        livePhaseBadge.className = 'phase-badge phase-off';
      }
      setElTextIfChanged(livePhaseBadge, 'OVERLAY OCULTO');
      if (_lastMonitorText !== 'off') {
        _lastMonitorText = 'off';
        const offMsg = 'Overlay desligado (Off Air). Clique em "NO AR" ou em "Exibir Agora".';
        setElTextIfChanged(liveCurrentText, offMsg);
        if (liveCurrentText) liveCurrentText.title = offMsg;
      }
      setElTextIfChanged(liveCurrentAuthor, '');
      setElTextIfChanged(liveCountdown, 'OFF');
      if (_lastMonitorProgressPct !== 0) {
        _lastMonitorProgressPct = 0;
        liveMiniProgressBar.style.width = '0%';
      }
      return;
    }

    const elapsed = Math.max(0, Date.now() - (currentRuntime.clientSyncedAt || Date.now()));
    const totalDuration = currentRuntime.phaseDurationMs || 0;
    const remainingMs = Math.max(0, totalDuration - (currentRuntime.initialElapsedMs + elapsed));
    const remainingSec = Math.ceil(remainingMs / 1000);
    const progressPct = totalDuration > 0
      ? Math.min(100, Math.max(0, ((totalDuration - remainingMs) / totalDuration) * 100))
      : 0;
    const roundedPct = Math.round(progressPct * 10) / 10;

    if (phase === 'showing' && phrase) {
      const targetBadgeCls = 'phase-badge phase-showing';
      if (livePhaseBadge.className !== targetBadgeCls) livePhaseBadge.className = targetBadgeCls;
      setElTextIfChanged(livePhaseBadge, phrase.source === 'audience' ? '● PÚBLICO NO AR' : '● CARROSSEL NO AR');
      if (_lastMonitorText !== phrase.text) {
        _lastMonitorText = phrase.text;
        setElTextIfChanged(liveCurrentText, phrase.text);
        if (liveCurrentText) liveCurrentText.title = phrase.text;
      }
      const authStr = phrase.author ? `— ${phrase.author}` : '';
      setElTextIfChanged(liveCurrentAuthor, authStr);
      setElTextIfChanged(liveCountdown, `${remainingSec}s`);
    } else if (phase === 'interval') {
      const pendingAud = currentRuntime.pendingAudienceCount || 0;
      const targetBadgeCls = 'phase-badge phase-interval';
      if (livePhaseBadge.className !== targetBadgeCls) livePhaseBadge.className = targetBadgeCls;
      setElTextIfChanged(livePhaseBadge, 'INTERVALO');
      const intervalMsg = pendingAud > 0
        ? `Preparando próxima mensagem do público (${pendingAud} na fila)...`
        : 'Aguardando intervalo para exibir a próxima frase do carrossel...';
      if (_lastMonitorText !== intervalMsg) {
        _lastMonitorText = intervalMsg;
        setElTextIfChanged(liveCurrentText, intervalMsg);
        if (liveCurrentText) liveCurrentText.title = intervalMsg;
      }
      setElTextIfChanged(liveCurrentAuthor, '');
      setElTextIfChanged(liveCountdown, `Próx. ${remainingSec}s`);
    } else {
      const targetBadgeCls = 'phase-badge phase-idle';
      if (livePhaseBadge.className !== targetBadgeCls) livePhaseBadge.className = targetBadgeCls;
      setElTextIfChanged(livePhaseBadge, 'EM ESPERA');
      const idleMsg = currentState.settings?.autoRotate
        ? 'Nenhuma frase ativa no carrossel ou na fila do público.'
        : 'Carrossel desligado — adicione uma frase na fila do público ou clique em "Exibir".';
      if (_lastMonitorText !== idleMsg) {
        _lastMonitorText = idleMsg;
        setElTextIfChanged(liveCurrentText, idleMsg);
        if (liveCurrentText) liveCurrentText.title = idleMsg;
      }
      setElTextIfChanged(liveCurrentAuthor, '');
      setElTextIfChanged(liveCountdown, '--');
    }

    if (_lastMonitorProgressPct !== roundedPct) {
      _lastMonitorProgressPct = roundedPct;
      liveMiniProgressBar.style.width = `${roundedPct}%`;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function renderAudienceQueue(audienceQueue, runtime, settings) {
    if (!audienceListEl) return;
    const list = Array.isArray(audienceQueue) ? audienceQueue : [];
    const pendingItems = list.filter((a) => a.status === 'pending');
    const showingItem = list.find((a) => a.status === 'showing');

    const pendingCount = pendingItems.length;
    const isPlayingAudienceNow = Boolean(showingItem) || (runtime?.phase === 'showing' && runtime?.currentPhrase?.source === 'audience');
    const isBatchActive = Boolean(settings?.audienceBatchPlaying) || (!settings?.audienceHoldMode && pendingCount > 0);

    if (audienceCounterEl) {
      audienceCounterEl.textContent = `${pendingCount} na fila`;
    }

    // Atualiza o botão "Iniciar Exibição da Fila (X)"
    if (btnStartAudienceBatch && labelStartAudienceBatch) {
      if (isBatchActive && (pendingCount > 0 || isPlayingAudienceNow)) {
        btnStartAudienceBatch.disabled = true;
        btnStartAudienceBatch.classList.add('is-playing');
        labelStartAudienceBatch.textContent = `Exibindo Fila do Público (${pendingCount} restantes)`;
        if (btnPauseAudienceBatch) btnPauseAudienceBatch.classList.remove('is-hidden');
      } else {
        btnStartAudienceBatch.classList.remove('is-playing');
        btnStartAudienceBatch.disabled = pendingCount === 0;
        labelStartAudienceBatch.textContent = pendingCount > 0
          ? `Iniciar Exibição da Fila (${pendingCount})`
          : 'Iniciar Exibição da Fila (0)';
        if (btnPauseAudienceBatch) btnPauseAudienceBatch.classList.add('is-hidden');
      }
    }

    // Atualiza o indicador visual de status do Carrossel do Sistema
    if (carouselStatusPill) {
      carouselStatusPill.className = 'badge-carousel-state';
      if (!settings?.autoRotate) {
        carouselStatusPill.classList.add('is-off');
        carouselStatusPill.textContent = 'Carrossel Desativado';
      } else if (isBatchActive || isPlayingAudienceNow) {
        carouselStatusPill.classList.add('is-paused');
        carouselStatusPill.textContent = 'Pausado (Exibindo Fila do Público)';
      } else {
        carouselStatusPill.classList.add('is-running');
        carouselStatusPill.textContent = 'Em Rotação Contínua';
      }
    }

    if (list.length === 0) {
      audienceListEl.innerHTML = `
        <div class="empty-state-box">
          ${ICONS.inbox}
          <span>Nenhuma mensagem do público na fila. Adicione uma acima para pausar o carrossel!</span>
        </div>
      `;
      return;
    }

    const sorted = [...list].sort((a, b) => {
      const order = { showing: 0, pending: 1, played: 2 };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    });

    const activeId = settings?.visible && runtime?.phase === 'showing' ? runtime.currentPhraseId : null;

    audienceListEl.innerHTML = sorted
      .map((item, idx) => {
        const isLive = item.id === activeId || item.status === 'showing';
        const isPending = item.status === 'pending' && !isLive;
        const isPlayed = item.status === 'played' && !isLive;

        const itemClasses = [
          'phrase-item',
          isLive ? 'is-active-now' : '',
          isPending ? 'is-audience-pending' : '',
          isPlayed ? 'is-audience-played' : ''
        ]
          .filter(Boolean)
          .join(' ');

        let statusBadge = '';
        if (isLive) {
          statusBadge = '<span class="meta-tag meta-live-badge"><svg class="icon-svg icon-xxs" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> NO AR AGORA</span>';
        } else if (isPending) {
          statusBadge = '<span class="meta-tag meta-pending-badge"><svg class="icon-svg icon-xxs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> NA FILA</span>';
        } else {
          statusBadge = '<span class="meta-tag meta-played-badge"><svg class="icon-svg icon-xxs" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> JÁ EXIBIDA</span>';
        }

        let kickerBadge = '';
        if (item.kicker === '__NONE__') {
          kickerBadge = '<span class="meta-tag meta-played-badge">Sem Etiqueta</span>';
        } else if (item.kicker) {
          kickerBadge = `<span class="meta-tag meta-kicker"><svg class="icon-svg icon-xxs" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg> ${escapeHtml(item.kicker)}</span>`;
        }

        const origIdx = list.findIndex((a) => a.id === item.id);

        return `
          <div class="${itemClasses}" data-id="${escapeHtml(item.id)}">
            <div class="phrase-item-left">
              <div class="phrase-body">
                <p class="phrase-item-text">${escapeHtml(item.text)}</p>
                <div class="phrase-meta">
                  ${statusBadge}
                  ${kickerBadge}
                  ${item.author ? `<span class="meta-tag meta-author">${ICONS.user} ${escapeHtml(item.author)}</span>` : ''}
                  <span class="meta-tag">${ICONS.clock} ${Number(item.duration) || 10}s</span>
                </div>
              </div>
            </div>

            <div class="phrase-actions">
              ${
                isPlayed
                  ? `<button type="button" class="btn btn-sm btn-secondary js-requeue-audience" data-id="${escapeHtml(item.id)}" title="Colocar novamente na fila de espera">
                      ${ICONS.requeue}
                      <span>Reenviar</span>
                    </button>`
                  : `<button type="button" class="btn-trigger-now js-trigger-audience" data-id="${escapeHtml(item.id)}" title="Exibir imediatamente na tela">
                      ${ICONS.play}
                      <span>Exibir Agora</span>
                    </button>`
              }
              <button type="button" class="btn-icon-sm js-move-audience" data-id="${escapeHtml(item.id)}" data-dir="up" ${origIdx <= 0 ? 'disabled' : ''} title="Mover para cima na fila">
                ${ICONS.up}
              </button>
              <button type="button" class="btn-icon-sm js-move-audience" data-id="${escapeHtml(item.id)}" data-dir="down" ${origIdx === -1 || origIdx >= list.length - 1 ? 'disabled' : ''} title="Mover para baixo na fila">
                ${ICONS.down}
              </button>
              <button type="button" class="btn-icon-sm js-edit-audience" data-id="${escapeHtml(item.id)}" title="Editar mensagem/autor/etiqueta/tempo">
                ${ICONS.edit}
              </button>
              <button type="button" class="btn-icon-sm danger js-delete-audience" data-id="${escapeHtml(item.id)}" title="Remover da lista">
                ${ICONS.trash}
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderPhrasesList(phrases, runtime, settings) {
    const enabledCount = phrases.filter((p) => p.enabled).length;
    phrasesCounterEl.textContent = `${enabledCount} de ${phrases.length} ativas`;

    if (phrases.length === 0) {
      phrasesListEl.innerHTML = `
        <div class="empty-state-box">
          <span>Nenhuma frase fixa cadastrada no carrossel. Clique em "Nova Frase Fixa" acima!</span>
        </div>
      `;
      return;
    }

    const searchQuery = (inputSearchPhrases?.value || '').trim().toLowerCase();
    const filteredPhrases = searchQuery
      ? phrases.filter(
          (p) =>
            (p.text || '').toLowerCase().includes(searchQuery) ||
            (p.author || '').toLowerCase().includes(searchQuery) ||
            (p.kicker || '').toLowerCase().includes(searchQuery)
        )
      : phrases;

    if (filteredPhrases.length === 0) {
      phrasesListEl.innerHTML = `
        <div class="empty-state-box">
          <span>Nenhuma frase encontrada para o filtro "${escapeHtml(searchQuery)}".</span>
        </div>
      `;
      return;
    }

    const activeId = settings?.visible && runtime?.phase === 'showing' ? runtime.currentPhraseId : null;

    phrasesListEl.innerHTML = filteredPhrases
      .map((phrase) => {
        const idx = phrases.findIndex((p) => p.id === phrase.id);
        const isLive = phrase.id === activeId;
        const itemClasses = [
          'phrase-item',
          isLive ? 'is-active-now' : '',
          !phrase.enabled ? 'is-disabled' : ''
        ]
          .filter(Boolean)
          .join(' ');

        const kickerBadge =
          phrase.kicker && phrase.kicker !== '__NONE__'
            ? `<span class="meta-tag meta-kicker"><svg class="icon-svg icon-xxs" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg> ${escapeHtml(phrase.kicker)}</span>`
            : '';

        return `
          <div class="${itemClasses}" data-id="${escapeHtml(phrase.id)}">
            <div class="phrase-item-left">
              <label class="switch" title="Incluir/remover esta frase da rotação automática">
                <input type="checkbox" class="js-toggle-phrase" data-id="${escapeHtml(phrase.id)}" ${phrase.enabled ? 'checked' : ''}>
                <span class="slider"></span>
              </label>

              <div class="phrase-body">
                <p class="phrase-item-text">${escapeHtml(phrase.text)}</p>
                <div class="phrase-meta">
                  ${isLive ? '<span class="meta-tag meta-live-badge"><svg class="icon-svg icon-xxs" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> NO AR AGORA</span>' : ''}
                  ${kickerBadge}
                  ${phrase.author ? `<span class="meta-tag meta-author">${ICONS.user} ${escapeHtml(phrase.author)}</span>` : ''}
                  <span class="meta-tag">${ICONS.clock} ${Number(phrase.duration) || 10}s</span>
                </div>
              </div>
            </div>

            <div class="phrase-actions">
              <button type="button" class="btn-trigger-now js-trigger-phrase" data-id="${escapeHtml(phrase.id)}" title="Exibir esta frase imediatamente no OBS">
                ${ICONS.play}
                <span>Exibir</span>
              </button>
              <button type="button" class="btn-icon-sm js-move-phrase" data-id="${escapeHtml(phrase.id)}" data-dir="up" ${idx === 0 ? 'disabled' : ''} title="Mover para cima">
                ${ICONS.up}
              </button>
              <button type="button" class="btn-icon-sm js-move-phrase" data-id="${escapeHtml(phrase.id)}" data-dir="down" ${idx === phrases.length - 1 ? 'disabled' : ''} title="Mover para baixo">
                ${ICONS.down}
              </button>
              <button type="button" class="btn-icon-sm js-edit-phrase" data-id="${escapeHtml(phrase.id)}" title="Editar frase/autor/tempo">
                ${ICONS.edit}
              </button>
              <button type="button" class="btn-icon-sm danger js-delete-phrase" data-id="${escapeHtml(phrase.id)}" title="Excluir frase">
                ${ICONS.trash}
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // ==========================================================================
  // EVENTOS DO USUÁRIO NO PAINEL
  // ==========================================================================

  // Botão Mestre ON AIR / OFF AIR
  btnToggleVisible.addEventListener('click', () => {
    if (!currentState) return;
    socket.emit('settings:update', {
      visible: !currentState.settings.visible
    });
  });

  // Próxima frase e Recolher atual
  btnNextPhrase.addEventListener('click', () => {
    socket.emit('rotation:next');
  });

  btnClearCurrent.addEventListener('click', () => {
    socket.emit('rotation:clearCurrent');
  });

  // Adicionar nova frase do PÚBLICO / OUVINTE (Fila prioritária que pausa o carrossel e não repete)
  function submitAudiencePhrase(showImmediately) {
    if (!audInputText) return;
    const text = audInputText.value.trim();
    if (!text) {
      audInputText.focus();
      return;
    }

    const author = audInputAuthor.value.trim();
    const kicker = audInputKicker ? audInputKicker.value : '';
    const duration = Math.max(2, Number(audInputDuration.value) || 10);

    socket.emit('audience:add', {
      text,
      author,
      kicker,
      duration,
      showImmediately
    });

    audInputText.value = '';
    audInputAuthor.value = '';
    if (audInputKicker) audInputKicker.value = '';
    audInputText.focus();
  }

  if (formAddAudience) {
    formAddAudience.addEventListener('submit', (e) => {
      e.preventDefault();
      submitAudiencePhrase(false);
    });
  }

  if (btnAudShowNow) {
    btnAudShowNow.addEventListener('click', () => {
      submitAudiencePhrase(true);
    });
  }

  if (audInputText) {
    audInputText.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        submitAudiencePhrase(false);
      }
    });
  }

  if (btnClearPlayedAudience) {
    btnClearPlayedAudience.addEventListener('click', () => {
      socket.emit('audience:clearPlayed');
    });
  }

  // Botões para Iniciar / Pausar a bateria acumulada da Fila do Público
  if (btnStartAudienceBatch) {
    btnStartAudienceBatch.addEventListener('click', () => {
      socket.emit('audience:startBatch');
    });
  }

  if (btnPauseAudienceBatch) {
    btnPauseAudienceBatch.addEventListener('click', () => {
      socket.emit('audience:pauseBatch');
    });
  }

  if (toggleAudienceHoldMode) {
    toggleAudienceHoldMode.addEventListener('change', () => {
      socket.emit('settings:update', {
        audienceHoldMode: toggleAudienceHoldMode.checked
      });
    });
  }

  if (audienceListEl) {
    audienceListEl.addEventListener('click', (e) => {
      const triggerBtn = e.target.closest('.js-trigger-audience');
      if (triggerBtn) {
        socket.emit('audience:trigger', triggerBtn.dataset.id);
        return;
      }

      const requeueBtn = e.target.closest('.js-requeue-audience');
      if (requeueBtn) {
        socket.emit('audience:requeue', requeueBtn.dataset.id);
        return;
      }

      const moveBtn = e.target.closest('.js-move-audience');
      if (moveBtn) {
        socket.emit('audience:move', {
          id: moveBtn.dataset.id,
          direction: moveBtn.dataset.dir
        });
        return;
      }

      const editBtn = e.target.closest('.js-edit-audience');
      if (editBtn && currentState) {
        const item = (currentState.audienceQueue || []).find((a) => a.id === editBtn.dataset.id);
        if (item) {
          if (editModalTitle) editModalTitle.textContent = 'Editar Mensagem da Fila do Público';
          if (editSourceInput) editSourceInput.value = 'audience';
          editIdInput.value = item.id;
          editTextInput.value = item.text;
          editAuthorInput.value = item.author || '';
          if (editKickerInput) editKickerInput.value = item.kicker || '';
          editDurationInput.value = item.duration || 10;
          editModal.classList.remove('is-hidden');
          editTextInput.focus();
        }
        return;
      }

      const deleteBtn = e.target.closest('.js-delete-audience');
      if (deleteBtn) {
        socket.emit('audience:delete', deleteBtn.dataset.id);
      }
    });
  }

  // Mostrar/ocultar formulário de adicionar nova frase fixa ao Carrossel do Sistema
  if (btnToggleSysForm && formAddPhrase) {
    btnToggleSysForm.addEventListener('click', () => {
      formAddPhrase.classList.toggle('is-collapsed');
      if (!formAddPhrase.classList.contains('is-collapsed')) {
        inputText.focus();
      }
    });
  }

  // Adicionar nova frase FIXA DO SISTEMA (Carrossel)
  function submitNewPhrase(showImmediately) {
    const text = inputText.value.trim();
    if (!text) {
      inputText.focus();
      return;
    }

    const author = inputAuthor.value.trim();
    const kicker = inputKicker ? inputKicker.value.trim() : '';
    const duration = Math.max(2, Number(inputDuration.value) || 10);

    socket.emit('phrase:add', {
      text,
      author,
      kicker,
      duration,
      enabled: true,
      showImmediately
    });

    inputText.value = '';
    inputAuthor.value = '';
    if (inputKicker) inputKicker.value = '';
    formAddPhrase.classList.add('is-collapsed');
  }

  formAddPhrase.addEventListener('submit', (e) => {
    e.preventDefault();
    submitNewPhrase(false);
  });

  btnAddAndShow.addEventListener('click', () => {
    submitNewPhrase(true);
  });

  inputText.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submitNewPhrase(true);
    }
  });

  // Busca e ações em massa no Carrossel
  if (inputSearchPhrases) {
    inputSearchPhrases.addEventListener('input', () => {
      if (currentState) {
        renderPhrasesList(currentState.phrases || [], currentRuntime, currentState.settings);
      }
    });
  }

  if (btnEnableAllPhrases) {
    btnEnableAllPhrases.addEventListener('click', () => {
      socket.emit('phrase:bulkToggle', { enabled: true });
    });
  }

  if (btnDisableAllPhrases) {
    btnDisableAllPhrases.addEventListener('click', () => {
      socket.emit('phrase:bulkToggle', { enabled: false });
    });
  }

  // Delegação de eventos na lista de frases do carrossel
  phrasesListEl.addEventListener('click', (e) => {
    const triggerBtn = e.target.closest('.js-trigger-phrase');
    if (triggerBtn) {
      socket.emit('phrase:trigger', triggerBtn.dataset.id);
      return;
    }

    const moveBtn = e.target.closest('.js-move-phrase');
    if (moveBtn) {
      socket.emit('phrase:move', {
        id: moveBtn.dataset.id,
        direction: moveBtn.dataset.dir
      });
      return;
    }

    const editBtn = e.target.closest('.js-edit-phrase');
    if (editBtn && currentState) {
      const phrase = currentState.phrases.find((p) => p.id === editBtn.dataset.id);
      if (phrase) {
        if (editModalTitle) editModalTitle.textContent = 'Editar Frase do Carrossel';
        if (editSourceInput) editSourceInput.value = 'system';
        editIdInput.value = phrase.id;
        editTextInput.value = phrase.text;
        editAuthorInput.value = phrase.author || '';
        if (editKickerInput) editKickerInput.value = phrase.kicker || '';
        editDurationInput.value = phrase.duration || 10;
        editModal.classList.remove('is-hidden');
        editTextInput.focus();
      }
      return;
    }

    const deleteBtn = e.target.closest('.js-delete-phrase');
    if (deleteBtn) {
      socket.emit('phrase:delete', deleteBtn.dataset.id);
    }
  });

  phrasesListEl.addEventListener('change', (e) => {
    const toggleInput = e.target.closest('.js-toggle-phrase');
    if (toggleInput) {
      socket.emit('phrase:update', {
        id: toggleInput.dataset.id,
        enabled: toggleInput.checked
      });
    }
  });

  // Modal de edição (suporta tanto 'audience' quanto 'system')
  function closeEditModal() {
    editModal.classList.add('is-hidden');
  }
  btnCloseModal.addEventListener('click', closeEditModal);
  btnCancelEdit.addEventListener('click', closeEditModal);

  formEditPhrase.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = editIdInput.value;
    const text = editTextInput.value.trim();
    const source = editSourceInput ? editSourceInput.value : 'system';
    if (!id || !text) return;

    const payload = {
      id,
      text,
      author: editAuthorInput.value.trim(),
      kicker: editKickerInput ? editKickerInput.value.trim() : '',
      duration: Math.max(2, Number(editDurationInput.value) || 10)
    };

    if (source === 'audience') {
      socket.emit('audience:update', payload);
    } else {
      socket.emit('phrase:update', payload);
    }
    closeEditModal();
  });

  // Controles de Tema, Posição e Configurações
  themeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      socket.emit('settings:update', { theme: btn.dataset.theme });
    });
  });

  posBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      socket.emit('settings:update', { position: btn.dataset.pos });
    });
  });

  toggleAutoRotate.addEventListener('change', () => {
    socket.emit('settings:update', { autoRotate: toggleAutoRotate.checked });
  });

  toggleShowProgress.addEventListener('change', () => {
    socket.emit('settings:update', { showProgress: toggleShowProgress.checked });
  });

  if (toggleShowKicker) {
    toggleShowKicker.addEventListener('change', () => {
      socket.emit('settings:update', { showKicker: toggleShowKicker.checked });
    });
  }

  if (settingDefaultKicker) {
    settingDefaultKicker.addEventListener('change', () => {
      const val = settingDefaultKicker.value.trim() || 'MENSAGEM DO PÚBLICO';
      settingDefaultKicker.value = val;
      socket.emit('settings:update', { defaultKickerText: val });
    });
  }

  settingInterval.addEventListener('change', () => {
    const val = Math.max(0, Number(settingInterval.value) || 0);
    settingInterval.value = val;
    socket.emit('settings:update', { intervalSeconds: val });
  });

  settingDefaultDuration.addEventListener('change', () => {
    const val = Math.max(2, Number(settingDefaultDuration.value) || 10);
    settingDefaultDuration.value = val;
    inputDuration.value = val;
    if (audInputDuration) audInputDuration.value = val;
    socket.emit('settings:update', { defaultDurationSeconds: val });
  });

  // Eventos em Tempo Real dos Sliders de Tamanho da Letra e do Overlay
  if (settingFontSize) {
    settingFontSize.addEventListener('input', () => {
      const val = Number(settingFontSize.value) || 100;
      labelFontSize.textContent = `${val}%`;
      socket.emit('settings:update', { fontSizePercent: val });
    });
  }

  if (settingOverlayScale) {
    settingOverlayScale.addEventListener('input', () => {
      const val = Number(settingOverlayScale.value) || 100;
      labelOverlayScale.textContent = `${val}%`;
      socket.emit('settings:update', { overlayScalePercent: val });
    });
  }

  if (settingCardWidth) {
    settingCardWidth.addEventListener('input', () => {
      const val = Number(settingCardWidth.value) || 1020;
      labelCardWidth.textContent = `${val}px`;
      socket.emit('settings:update', { cardMaxWidthPx: val });
    });
  }

  if (btnResetSizes) {
    btnResetSizes.addEventListener('click', () => {
      settingFontSize.value = 100;
      settingOverlayScale.value = 100;
      settingCardWidth.value = 1020;
      labelFontSize.textContent = '100%';
      labelOverlayScale.textContent = '100%';
      labelCardWidth.textContent = '1020px';
      socket.emit('settings:update', {
        fontSizePercent: 100,
        overlayScalePercent: 100,
        cardMaxWidthPx: 1020
      });
    });
  }

  // Eventos de Resolução (Presets e Campos Customizados)
  resPresetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const w = Math.max(360, Number(btn.dataset.w) || 1920);
      const h = Math.max(360, Number(btn.dataset.h) || 1080);
      if (settingResWidth) settingResWidth.value = w;
      if (settingResHeight) settingResHeight.value = h;
      socket.emit('settings:update', {
        resolutionWidth: w,
        resolutionHeight: h
      });
    });
  });

  function emitCustomResolution() {
    const w = Math.min(7680, Math.max(360, Number(settingResWidth.value) || 1920));
    const h = Math.min(7680, Math.max(360, Number(settingResHeight.value) || 1080));
    settingResWidth.value = w;
    settingResHeight.value = h;
    socket.emit('settings:update', {
      resolutionWidth: w,
      resolutionHeight: h
    });
  }

  if (settingResWidth) {
    settingResWidth.addEventListener('change', emitCustomResolution);
  }
  if (settingResHeight) {
    settingResHeight.addEventListener('change', emitCustomResolution);
  }

  // ==========================================================================
  // MÚLTIPLAS PLAYLISTS (EVENTOS) & BACKUP JSON (FASE 2)
  // ==========================================================================
  function renderPlaylistsSelector(playlists, activePlaylistId) {
    if (!selectPlaylist) return;
    const list = Array.isArray(playlists) ? playlists : [];
    selectPlaylist.innerHTML = list
      .map((pl) => {
        const count = Array.isArray(pl.phrases) ? pl.phrases.length : 0;
        const selected = pl.id === activePlaylistId ? 'selected' : '';
        return `<option value="${escapeHtml(pl.id)}" ${selected}>${escapeHtml(pl.name)} (${count} frases)</option>`;
      })
      .join('');

    if (btnDeletePlaylist) {
      btnDeletePlaylist.disabled = list.length <= 1;
    }
  }

  if (selectPlaylist) {
    selectPlaylist.addEventListener('change', () => {
      const selectedId = selectPlaylist.value;
      if (selectedId) {
        socket.emit('playlist:select', selectedId);
      }
    });
  }

  function closePlaylistModal() {
    if (playlistModal) playlistModal.classList.add('is-hidden');
  }

  if (btnClosePlaylistModal) btnClosePlaylistModal.addEventListener('click', closePlaylistModal);
  if (btnCancelPlaylistModal) btnCancelPlaylistModal.addEventListener('click', closePlaylistModal);

  if (btnCreatePlaylist) {
    btnCreatePlaylist.addEventListener('click', () => {
      if (!playlistModal) return;
      if (playlistModalTitle) playlistModalTitle.textContent = 'Nova Playlist de Evento';
      if (playlistModalMode) playlistModalMode.value = 'create';
      if (playlistModalName) playlistModalName.value = '';
      playlistModal.classList.remove('is-hidden');
      if (playlistModalName) playlistModalName.focus();
    });
  }

  if (btnRenamePlaylist) {
    btnRenamePlaylist.addEventListener('click', () => {
      if (!playlistModal || !currentState) return;
      const activePl = (currentState.playlists || []).find((p) => p.id === currentState.activePlaylistId);
      if (!activePl) return;
      if (playlistModalTitle) playlistModalTitle.textContent = 'Renomear Playlist';
      if (playlistModalMode) playlistModalMode.value = 'rename';
      if (playlistModalName) playlistModalName.value = activePl.name || '';
      playlistModal.classList.remove('is-hidden');
      if (playlistModalName) playlistModalName.focus();
    });
  }

  if (formPlaylistModal) {
    formPlaylistModal.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = playlistModalName ? playlistModalName.value.trim() : '';
      const mode = playlistModalMode ? playlistModalMode.value : 'create';
      if (!name) return;

      if (mode === 'rename' && currentState?.activePlaylistId) {
        socket.emit('playlist:rename', { id: currentState.activePlaylistId, name });
      } else {
        socket.emit('playlist:create', { name });
      }
      closePlaylistModal();
    });
  }

  if (btnDeletePlaylist) {
    btnDeletePlaylist.addEventListener('click', () => {
      if (!currentState || !Array.isArray(currentState.playlists) || currentState.playlists.length <= 1) return;
      const activePl = currentState.playlists.find((p) => p.id === currentState.activePlaylistId);
      if (!activePl) return;
      const confirmed = window.confirm(`Deseja realmente excluir a playlist "${activePl.name}" e todas as suas frases?`);
      if (confirmed) {
        socket.emit('playlist:delete', activePl.id);
      }
    });
  }

  // Exportar e Importar Backup (.json)
  if (btnExportBackup) {
    btnExportBackup.addEventListener('click', () => {
      if (!currentState) return;
      const backupPayload = {
        exportedAt: new Date().toISOString(),
        app: 'tImago',
        ...currentState
      };
      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `tImago-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  if (btnImportBackup && inputImportJson) {
    btnImportBackup.addEventListener('click', () => {
      inputImportJson.value = '';
      inputImportJson.click();
    });

    inputImportJson.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(String(ev.target?.result || '{}'));
          socket.emit('state:import', parsed);
        } catch (err) {
          window.alert('Arquivo JSON inválido. Verifique o arquivo selecionado.');
        }
      };
      reader.readAsText(file, 'utf-8');
    });
  }

  // ==========================================================================
  // ACESSO REMOTO VIA CELULAR (QR CODE) & MODO RECEPÇÃO (FASE 3)
  // ==========================================================================
  function setReceptionMode(enabled) {
    document.body.classList.toggle('is-reception-mode', Boolean(enabled));
    if (btnToggleReceptionMode) {
      btnToggleReceptionMode.classList.toggle('is-active', Boolean(enabled));
      const span = btnToggleReceptionMode.querySelector('#label-reception-mode') || btnToggleReceptionMode.querySelector('span');
      if (span) {
        span.textContent = enabled ? 'Painel Completo' : 'Modo Recepção';
      }
    }
    setTimeout(updatePreviewScale, 60);
  }

  // Ativa automaticamente o Modo Recepção se a URL tiver ?mode=recepcao
  if (new URLSearchParams(window.location.search).get('mode') === 'recepcao') {
    setReceptionMode(true);
  }

  if (btnToggleReceptionMode) {
    btnToggleReceptionMode.addEventListener('click', () => {
      const next = !document.body.classList.contains('is-reception-mode');
      setReceptionMode(next);
    });
  }

  function renderMobileQrCodes(runtime) {
    const ip = runtime?.localIp || window.location.hostname || 'localhost';
    const port = runtime?.port || window.location.port || 3000;
    const baseUrl = `http://${ip}:${port}`;
    const receptionUrl = `${baseUrl}/?mode=recepcao`;

    if (labelMobileQr && ip !== 'localhost') {
      labelMobileQr.textContent = `Celular (${ip})`;
    }
    if (qrUrlReception) qrUrlReception.textContent = receptionUrl;
    if (qrUrlFull) qrUrlFull.textContent = baseUrl;
    if (diagUrlReception) diagUrlReception.textContent = receptionUrl;
    if (diagUrlFull) diagUrlFull.textContent = baseUrl;

    if (window.tImagoQR && typeof window.tImagoQR.renderQrSvg === 'function') {
      if (qrSvgReception) qrSvgReception.innerHTML = window.tImagoQR.renderQrSvg(receptionUrl);
      if (qrSvgFull) qrSvgFull.innerHTML = window.tImagoQR.renderQrSvg(baseUrl);
    }
  }

  function closeQrModal() {
    if (mobileQrModal) mobileQrModal.classList.add('is-hidden');
  }

  if (btnOpenMobileQr) {
    btnOpenMobileQr.addEventListener('click', () => {
      renderMobileQrCodes(currentRuntime);
      if (mobileQrModal) mobileQrModal.classList.remove('is-hidden');
    });
  }
  if (btnCloseQrModal) btnCloseQrModal.addEventListener('click', closeQrModal);
  if (btnCloseQrFooter) btnCloseQrFooter.addEventListener('click', closeQrModal);

  // ==========================================================================
  // ANIMAÇÕES DE ENTRADA, LOGO PERSONALIZADO E CORES DO TEMA CUSTOM (FASE 4)
  // ==========================================================================
  function emitCustomColorsUpdate() {
    socket.emit('settings:update', {
      customThemeColors: {
        bg1: colorCustomBg1 ? colorCustomBg1.value : '#1e1b4b',
        bg2: colorCustomBg2 ? colorCustomBg2.value : '#0f172a',
        border: colorCustomBorder ? colorCustomBorder.value : '#38bdf8',
        text: colorCustomText ? colorCustomText.value : '#f8fafc',
        author: colorCustomAuthor ? colorCustomAuthor.value : '#fde047'
      }
    });
  }

  [colorCustomBg1, colorCustomBg2, colorCustomBorder, colorCustomText, colorCustomAuthor].forEach((input) => {
    if (input) {
      input.addEventListener('input', emitCustomColorsUpdate);
    }
  });

  if (settingAnimationStyle) {
    settingAnimationStyle.addEventListener('change', () => {
      socket.emit('settings:update', { animationStyle: settingAnimationStyle.value });
    });
  }

  if (toggleShowLogo) {
    toggleShowLogo.addEventListener('change', () => {
      socket.emit('settings:update', { showLogo: toggleShowLogo.checked });
    });
  }

  /**
   * Redimensiona e comprime imagens via Canvas antes do envio para o servidor,
   * garantindo que o payload de rede e o state.json permaneçam ultraleves (< 25 KB).
   */
  function compressLogoImage(file, maxDim = 140) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('Nenhum arquivo fornecido'));
      if (file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload = (e) => resolve(String(e.target?.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w >= h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(String(e.target?.result || ''));
        img.src = String(e.target?.result || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  if (btnUploadLogo && inputLogoFile) {
    btnUploadLogo.addEventListener('click', () => {
      inputLogoFile.value = '';
      inputLogoFile.click();
    });

    inputLogoFile.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await compressLogoImage(file, 140);
        if (dataUrl.startsWith('data:image/')) {
          socket.emit('settings:update', {
            logoDataUrl: dataUrl,
            showLogo: true
          });
        }
      } catch (err) {
        window.alert('Erro ao processar imagem do brasão. Escolha um arquivo PNG, JPG ou SVG.');
      }
    });
  }

  if (btnRemoveLogo) {
    btnRemoveLogo.addEventListener('click', () => {
      socket.emit('settings:update', {
        logoDataUrl: '',
        showLogo: false
      });
    });
  }

  // ==========================================================================
  // MODO TICKER DE RODAPÉ & TARJA LOWER THIRD (FASE 5)
  // ==========================================================================
  if (settingDisplayMode) {
    settingDisplayMode.addEventListener('change', () => {
      socket.emit('settings:update', { displayMode: settingDisplayMode.value });
    });
  }

  if (settingTickerSpeed) {
    settingTickerSpeed.addEventListener('change', () => {
      const val = Math.min(180, Math.max(8, Number(settingTickerSpeed.value) || 32));
      settingTickerSpeed.value = val;
      socket.emit('settings:update', { tickerSpeedSeconds: val });
    });
  }

  function renderLowerThirdControls(lowerThird) {
    if (!ltStatusPill) return;
    const isActive = Boolean(lowerThird?.active);
    ltStatusPill.className = 'badge-carousel-state ' + (isActive ? 'is-running' : 'is-off');
    ltStatusPill.textContent = isActive ? '● TARJA NO AR' : 'Oculta';
    if (btnHideLowerThird) {
      btnHideLowerThird.disabled = !isActive;
    }
    if (lowerThird && document.activeElement !== ltInputTitle && document.activeElement !== ltInputSubtitle) {
      if (ltInputTitle && !ltInputTitle.value && lowerThird.title) {
        ltInputTitle.value = lowerThird.title;
      }
      if (ltInputSubtitle && !ltInputSubtitle.value && lowerThird.subtitle) {
        ltInputSubtitle.value = lowerThird.subtitle;
      }
    }
  }

  if (formLowerThird) {
    formLowerThird.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = ltInputTitle ? ltInputTitle.value.trim() : '';
      if (!title) {
        if (ltInputTitle) ltInputTitle.focus();
        return;
      }
      socket.emit('lowerThird:show', {
        badge: ltInputBadge ? ltInputBadge.value : '',
        title,
        subtitle: ltInputSubtitle ? ltInputSubtitle.value.trim() : '',
        autoHideSeconds: Math.max(0, Number(ltInputAutohide?.value) ?? 10)
      });
    });
  }

  if (btnHideLowerThird) {
    btnHideLowerThird.addEventListener('click', () => {
      socket.emit('lowerThird:hide');
    });
  }

  // ==========================================================================
  // MÓDULO DE TRANSMISSÃO ESPORTIVA (PLACAR AO VIVO - VIEW-SPORTS)
  // ==========================================================================
  let currentScoreboard = {
    visible: false,
    sport: 'soccer',
    position: 'top-left',
    theme: 'soccer-pitch',
    teamA: { name: 'Mandante FC', shortName: 'MAN', color: '#16a34a', score: 0, yellowCards: 0, redCards: 0, setsWon: 0, logo: '' },
    teamB: { name: 'Visitante EC', shortName: 'VIS', color: '#2563eb', score: 0, yellowCards: 0, redCards: 0, setsWon: 0, logo: '' },
    timer: { seconds: 0, running: false, extraMinutes: 0, direction: 'up' },
    period: '1T'
  };

  const btnToggleSbAir = document.getElementById('btn-toggle-sb-air');
  const sbAirLabel = document.getElementById('sb-air-label');
  const btnSbResetMatch = document.getElementById('btn-sb-reset-match');
  const sbSportSelect = document.getElementById('sb-sport-select');
  const sbPosSelect = document.getElementById('sb-pos-select');
  const btnSbSwitchSides = document.getElementById('btn-sb-switch-sides');

  // Elementos do Mini-Preview do Placar
  const sbPreviewStatusDot = document.getElementById('sb-preview-status-dot');
  const sbPreviewAirBadge = document.getElementById('sb-preview-air-badge');
  const sbPreviewPosLabel = document.getElementById('sb-preview-pos-label');
  const sbPreviewStage = document.querySelector('.sports-preview-stage');
  const sbPreviewCapsule = document.querySelector('.sb-preview-capsule');
  const prevColorA = document.getElementById('prev-color-a');
  const prevColorB = document.getElementById('prev-color-b');
  const prevNameA = document.getElementById('prev-name-a');
  const prevNameB = document.getElementById('prev-name-b');
  const prevScoreA = document.getElementById('prev-score-a');
  const prevScoreB = document.getElementById('prev-score-b');
  const prevYellowA = document.getElementById('prev-yellow-a');
  const prevYellowB = document.getElementById('prev-yellow-b');
  const prevRedA = document.getElementById('prev-red-a');
  const prevRedB = document.getElementById('prev-red-b');
  const prevLogoBoxA = document.getElementById('prev-logo-box-a');
  const prevLogoImgA = document.getElementById('prev-logo-img-a');
  const prevLogoBoxB = document.getElementById('prev-logo-box-b');
  const prevLogoImgB = document.getElementById('prev-logo-img-b');
  const prevTimeBlock = document.getElementById('prev-time-block');
  const prevVoleyBlock = document.getElementById('prev-voley-block');
  const prevPeriod = document.getElementById('prev-period');
  const prevTimer = document.getElementById('prev-timer');
  const prevExtra = document.getElementById('prev-extra');
  const prevSetsA = document.getElementById('prev-sets-a');
  const prevSetsB = document.getElementById('prev-sets-b');

  function updateScoreboardMiniPreview() {
    if (!currentScoreboard) return;
    const isLive = Boolean(currentScoreboard.visible);

    if (sbPreviewStatusDot) sbPreviewStatusDot.classList.toggle('is-live', isLive);
    if (sbPreviewAirBadge) {
      sbPreviewAirBadge.textContent = isLive ? 'NO AR NO OBS' : 'PLACAR OCULTO';
      sbPreviewAirBadge.classList.toggle('is-live', isLive);
    }
    if (sbPreviewCapsule) sbPreviewCapsule.classList.toggle('is-live', isLive);

    const pos = currentScoreboard.position || 'top-left';
    if (sbPreviewPosLabel) {
      sbPreviewPosLabel.textContent = pos === 'top-center' ? 'POSIÇÃO: SUPERIOR CENTRO' :
                                      pos === 'top-right' ? 'POSIÇÃO: SUPERIOR DIREITA' :
                                      'POSIÇÃO: SUPERIOR ESQUERDA';
    }
    if (sbPreviewStage) {
      sbPreviewStage.classList.toggle('pos-top-center', pos === 'top-center');
      sbPreviewStage.classList.toggle('pos-top-right', pos === 'top-right');
    }

    const tA = currentScoreboard.teamA || {};
    const tB = currentScoreboard.teamB || {};

    if (prevColorA) prevColorA.style.background = tA.color || '#16a34a';
    if (prevNameA) prevNameA.textContent = (tA.shortName || tA.name || 'MAN').toUpperCase();
    if (prevScoreA) prevScoreA.textContent = tA.score ?? 0;

    const yA = Number(tA.yellowCards) || 0;
    const rA = Number(tA.redCards) || 0;
    if (prevYellowA) {
      prevYellowA.textContent = yA;
      prevYellowA.classList.toggle('is-hidden', yA <= 0);
    }
    if (prevRedA) {
      prevRedA.textContent = rA;
      prevRedA.classList.toggle('is-hidden', rA <= 0);
    }
    if (prevLogoBoxA && prevLogoImgA) {
      if (tA.logo) {
        prevLogoImgA.src = tA.logo;
        prevLogoBoxA.classList.remove('is-hidden');
      } else {
        prevLogoBoxA.classList.add('is-hidden');
      }
    }

    if (prevColorB) prevColorB.style.background = tB.color || '#2563eb';
    if (prevNameB) prevNameB.textContent = (tB.shortName || tB.name || 'VIS').toUpperCase();
    if (prevScoreB) prevScoreB.textContent = tB.score ?? 0;

    const yB = Number(tB.yellowCards) || 0;
    const rB = Number(tB.redCards) || 0;
    if (prevYellowB) {
      prevYellowB.textContent = yB;
      prevYellowB.classList.toggle('is-hidden', yB <= 0);
    }
    if (prevRedB) {
      prevRedB.textContent = rB;
      prevRedB.classList.toggle('is-hidden', rB <= 0);
    }
    if (prevLogoBoxB && prevLogoImgB) {
      if (tB.logo) {
        prevLogoImgB.src = tB.logo;
        prevLogoBoxB.classList.remove('is-hidden');
      } else {
        prevLogoBoxB.classList.add('is-hidden');
      }
    }

    const isVoley = currentScoreboard.sport === 'volleyball';
    if (prevTimeBlock) prevTimeBlock.classList.toggle('is-hidden', isVoley);
    if (prevVoleyBlock) prevVoleyBlock.classList.toggle('is-hidden', !isVoley);

    if (isVoley) {
      if (prevSetsA) prevSetsA.textContent = tA.setsWon ?? 0;
      if (prevSetsB) prevSetsB.textContent = tB.setsWon ?? 0;
    } else {
      const timer = currentScoreboard.timer || {};
      if (prevPeriod) prevPeriod.textContent = currentScoreboard.period || '1T';
      if (prevTimer) prevTimer.textContent = formatTime(timer.seconds || 0);
      const extra = Number(timer.extraMinutes) || 0;
      if (prevExtra) {
        prevExtra.textContent = `+${extra}'`;
        prevExtra.classList.toggle('is-hidden', extra <= 0);
      }
    }
  }

  // Ticker Local Resiliente no Painel do Operador
  let localTimerInterval = null;
  function updateLocalTimerTick() {
    if (currentScoreboard && currentScoreboard.timer && currentScoreboard.timer.running) {
      if (currentScoreboard.timer.direction === 'down') {
        currentScoreboard.timer.seconds = Math.max(0, (currentScoreboard.timer.seconds || 0) - 1);
      } else {
        currentScoreboard.timer.seconds = (currentScoreboard.timer.seconds || 0) + 1;
      }
      if (sbTimerDigits) sbTimerDigits.textContent = formatTime(currentScoreboard.timer.seconds);
      updateScoreboardMiniPreview();
    }
  }

  if (!localTimerInterval) {
    localTimerInterval = setInterval(updateLocalTimerTick, 1000);
  }

  // Mandante (Time A)
  const sbInputNameA = document.getElementById('sb-input-name-a');
  const sbInputShortA = document.getElementById('sb-input-short-a');
  const sbInputColorA = document.getElementById('sb-input-color-a');
  const sbTextColorA = document.getElementById('sb-text-color-a');
  const badgePillA = document.getElementById('badge-pill-a');
  const sbFileLogoA = document.getElementById('sb-file-logo-a');
  const btnUploadLogoA = document.getElementById('btn-upload-logo-a');
  const btnRemoveLogoA = document.getElementById('btn-remove-logo-a');
  const sbLogoPreviewNameA = document.getElementById('sb-logo-preview-name-a');
  const btnIncScoreA = document.getElementById('btn-inc-score-a');
  const btnDecScoreA = document.getElementById('btn-dec-score-a');
  const sbDisplayScoreA = document.getElementById('sb-display-score-a');
  const btnTriggerGoalA = document.getElementById('btn-trigger-goal-a');
  const btnIncYellowA = document.getElementById('btn-inc-yellow-a');
  const btnDecYellowA = document.getElementById('btn-dec-yellow-a');
  const sbCountYellowA = document.getElementById('sb-count-yellow-a');
  const btnIncRedA = document.getElementById('btn-inc-red-a');
  const btnDecRedA = document.getElementById('btn-dec-red-a');
  const sbCountRedA = document.getElementById('sb-count-red-a');
  const btnIncSetsA = document.getElementById('btn-inc-sets-a');
  const btnDecSetsA = document.getElementById('btn-dec-sets-a');
  const sbCountSetsA = document.getElementById('sb-count-sets-a');
  const radioServingA = document.getElementById('radio-serving-a');
  const sbSoccerActionsA = document.getElementById('sb-soccer-actions-a');
  const sbVoleyActionsA = document.getElementById('sb-voley-actions-a');

  // Visitante (Time B)
  const sbInputNameB = document.getElementById('sb-input-name-b');
  const sbInputShortB = document.getElementById('sb-input-short-b');
  const sbInputColorB = document.getElementById('sb-input-color-b');
  const sbTextColorB = document.getElementById('sb-text-color-b');
  const badgePillB = document.getElementById('badge-pill-b');
  const sbFileLogoB = document.getElementById('sb-file-logo-b');
  const btnUploadLogoB = document.getElementById('btn-upload-logo-b');
  const btnRemoveLogoB = document.getElementById('btn-remove-logo-b');
  const sbLogoPreviewNameB = document.getElementById('sb-logo-preview-name-b');
  const btnIncScoreB = document.getElementById('btn-inc-score-b');
  const btnDecScoreB = document.getElementById('btn-dec-score-b');
  const sbDisplayScoreB = document.getElementById('sb-display-score-b');
  const btnTriggerGoalB = document.getElementById('btn-trigger-goal-b');
  const btnIncYellowB = document.getElementById('btn-inc-yellow-b');
  const btnDecYellowB = document.getElementById('btn-dec-yellow-b');
  const sbCountYellowB = document.getElementById('sb-count-yellow-b');
  const btnIncRedB = document.getElementById('btn-inc-red-b');
  const btnDecRedB = document.getElementById('btn-dec-red-b');
  const sbCountRedB = document.getElementById('sb-count-red-b');
  const btnIncSetsB = document.getElementById('btn-inc-sets-b');
  const btnDecSetsB = document.getElementById('btn-dec-sets-b');
  const sbCountSetsB = document.getElementById('sb-count-sets-b');
  const radioServingB = document.getElementById('radio-serving-b');
  const sbSoccerActionsB = document.getElementById('sb-soccer-actions-b');
  const sbVoleyActionsB = document.getElementById('sb-voley-actions-b');

  // Relógio e Período
  const sbTimerDigits = document.getElementById('sb-timer-digits');
  const sbTimerStateLabel = document.getElementById('sb-timer-state-label');
  const btnSbToggleTimer = document.getElementById('btn-sb-toggle-timer');
  const labelBtnTimer = document.getElementById('label-btn-timer');
  const btnSbPlus1m = document.getElementById('btn-sb-plus-1m');
  const btnSbMinus1m = document.getElementById('btn-sb-minus-1m');
  const btnSbResetTimer = document.getElementById('btn-sb-reset-timer');
  const sbPeriodSelect = document.getElementById('sb-period-select');
  const extraPills = document.querySelectorAll('.btn-extra-pill');

  function formatTime(totalSeconds) {
    const sec = Math.max(0, Number(totalSeconds) || 0);
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function renderScoreboardControls(sb) {
    if (!sb) return;
    currentScoreboard = sb;

    // Botão NO AR
    if (btnToggleSbAir && sbAirLabel) {
      btnToggleSbAir.classList.toggle('is-on', Boolean(sb.visible));
      sbAirLabel.textContent = sb.visible ? 'PLACAR NO AR (VISÍVEL)' : 'PLACAR OCULTO';
    }

    // Modalidade e Posição
    if (sbSportSelect) sbSportSelect.value = sb.sport || 'soccer';
    if (sbPosSelect) sbPosSelect.value = sb.position || 'top-left';

    const isVoley = sb.sport === 'volleyball';
    if (sbSoccerActionsA) sbSoccerActionsA.classList.toggle('is-hidden', isVoley);
    if (sbSoccerActionsB) sbSoccerActionsB.classList.toggle('is-hidden', isVoley);
    if (sbVoleyActionsA) sbVoleyActionsA.classList.toggle('is-hidden', !isVoley);
    if (sbVoleyActionsB) sbVoleyActionsB.classList.toggle('is-hidden', !isVoley);

    // Time Mandante (A)
    const tA = sb.teamA || {};
    if (sbInputNameA && document.activeElement !== sbInputNameA) sbInputNameA.value = tA.name || '';
    if (sbInputShortA && document.activeElement !== sbInputShortA) sbInputShortA.value = tA.shortName || '';
    if (sbInputColorA) sbInputColorA.value = tA.color || '#16a34a';
    if (sbTextColorA && document.activeElement !== sbTextColorA) sbTextColorA.value = tA.color || '#16a34a';
    if (badgePillA) badgePillA.style.background = tA.color || '#16a34a';
    if (sbDisplayScoreA) sbDisplayScoreA.textContent = tA.score ?? 0;
    if (sbCountYellowA) sbCountYellowA.textContent = tA.yellowCards ?? 0;
    if (sbCountRedA) sbCountRedA.textContent = tA.redCards ?? 0;
    if (sbCountSetsA) sbCountSetsA.textContent = tA.setsWon ?? 0;
    if (btnRemoveLogoA) btnRemoveLogoA.classList.toggle('is-hidden', !tA.logo);
    if (sbLogoPreviewNameA) sbLogoPreviewNameA.textContent = tA.logo ? 'Escudo ativo' : 'Sem escudo';

    // Time Visitante (B)
    const tB = sb.teamB || {};
    if (sbInputNameB && document.activeElement !== sbInputNameB) sbInputNameB.value = tB.name || '';
    if (sbInputShortB && document.activeElement !== sbInputShortB) sbInputShortB.value = tB.shortName || '';
    if (sbInputColorB) sbInputColorB.value = tB.color || '#2563eb';
    if (sbTextColorB && document.activeElement !== sbTextColorB) sbTextColorB.value = tB.color || '#2563eb';
    if (badgePillB) badgePillB.style.background = tB.color || '#2563eb';
    if (sbDisplayScoreB) sbDisplayScoreB.textContent = tB.score ?? 0;
    if (sbCountYellowB) sbCountYellowB.textContent = tB.yellowCards ?? 0;
    if (sbCountRedB) sbCountRedB.textContent = tB.redCards ?? 0;
    if (sbCountSetsB) sbCountSetsB.textContent = tB.setsWon ?? 0;
    if (btnRemoveLogoB) btnRemoveLogoB.classList.toggle('is-hidden', !tB.logo);
    if (sbLogoPreviewNameB) sbLogoPreviewNameB.textContent = tB.logo ? 'Escudo ativo' : 'Sem escudo';

    // Saque Vôlei
    if (radioServingA && radioServingB) {
      if (sb.servingTeam === 'teamB') {
        radioServingB.checked = true;
      } else {
        radioServingA.checked = true;
      }
    }

    // Relógio e Período
    const timer = sb.timer || {};
    if (sbTimerDigits) sbTimerDigits.textContent = formatTime(timer.seconds || 0);
    if (sbTimerStateLabel) {
      sbTimerStateLabel.textContent = timer.running ? 'EM ANDAMENTO' : 'PAUSADO';
      sbTimerStateLabel.classList.toggle('is-running', Boolean(timer.running));
    }
    if (btnSbToggleTimer && labelBtnTimer) {
      btnSbToggleTimer.classList.toggle('is-running', Boolean(timer.running));
      labelBtnTimer.textContent = timer.running ? 'Pausar Relógio' : 'Iniciar Tempo';
    }
    if (sbPeriodSelect && document.activeElement !== sbPeriodSelect) {
      sbPeriodSelect.value = sb.period || '1T';
    }

    // Acréscimos
    const currentExtra = Number(timer.extraMinutes) || 0;
    extraPills.forEach((p) => {
      p.classList.toggle('active', Number(p.dataset.extra) === currentExtra);
    });

    updateScoreboardMiniPreview();
  }

  // Interações de controle
  if (btnToggleSbAir) {
    btnToggleSbAir.addEventListener('click', () => {
      const nextVis = !Boolean(currentScoreboard?.visible);
      if (currentScoreboard) currentScoreboard.visible = nextVis;
      btnToggleSbAir.classList.toggle('is-on', nextVis);
      if (sbAirLabel) sbAirLabel.textContent = nextVis ? 'PLACAR NO AR (VISÍVEL)' : 'PLACAR OCULTO';
      socket.emit('scoreboard:update', { visible: nextVis });
      updateScoreboardMiniPreview();
    });
  }

  if (btnSbResetMatch) {
    btnSbResetMatch.addEventListener('click', () => {
      if (confirm('Deseja realmente zerar todos os gols, cartões e cronômetro da partida?')) {
        socket.emit('scoreboard:reset-match');
      }
    });
  }

  if (sbSportSelect) {
    sbSportSelect.addEventListener('change', () => {
      if (currentScoreboard) currentScoreboard.sport = sbSportSelect.value;
      socket.emit('scoreboard:update', { sport: sbSportSelect.value });
      updateScoreboardMiniPreview();
    });
  }

  if (sbPosSelect) {
    sbPosSelect.addEventListener('change', () => {
      if (currentScoreboard) currentScoreboard.position = sbPosSelect.value;
      socket.emit('scoreboard:update', { position: sbPosSelect.value });
      updateScoreboardMiniPreview();
    });
  }

  if (btnSbSwitchSides) {
    btnSbSwitchSides.addEventListener('click', () => {
      if (currentScoreboard) {
        const tempA = currentScoreboard.teamA;
        currentScoreboard.teamA = currentScoreboard.teamB;
        currentScoreboard.teamB = tempA;
        if (currentScoreboard.servingTeam === 'teamA') currentScoreboard.servingTeam = 'teamB';
        else if (currentScoreboard.servingTeam === 'teamB') currentScoreboard.servingTeam = 'teamA';
        renderScoreboardControls(currentScoreboard);
      }
      socket.emit('scoreboard:switch-sides');
      updateScoreboardMiniPreview();
    });
  }

  // Ações de Gols/Pontos Mandante
  if (btnIncScoreA) {
    btnIncScoreA.addEventListener('click', () => {
      if (!currentScoreboard) currentScoreboard = { teamA: {}, teamB: {}, timer: {} };
      if (!currentScoreboard.teamA) currentScoreboard.teamA = {};
      const next = (Number(currentScoreboard.teamA.score) || 0) + 1;
      currentScoreboard.teamA.score = next;
      if (sbDisplayScoreA) sbDisplayScoreA.textContent = next;
      socket.emit('scoreboard:score-change', { team: 'teamA', delta: 1, triggerCelebration: true });
      updateScoreboardMiniPreview();
    });
  }
  if (btnDecScoreA) {
    btnDecScoreA.addEventListener('click', () => {
      if (!currentScoreboard) currentScoreboard = { teamA: {}, teamB: {}, timer: {} };
      if (!currentScoreboard.teamA) currentScoreboard.teamA = {};
      const next = Math.max(0, (Number(currentScoreboard.teamA.score) || 0) - 1);
      currentScoreboard.teamA.score = next;
      if (sbDisplayScoreA) sbDisplayScoreA.textContent = next;
      socket.emit('scoreboard:score-change', { team: 'teamA', delta: -1 });
      updateScoreboardMiniPreview();
    });
  }
  if (btnTriggerGoalA) {
    btnTriggerGoalA.addEventListener('click', () => {
      const name = sbInputNameA?.value || 'Mandante';
      socket.emit('scoreboard:trigger-celebration', { text: 'GOL!', subtext: name, type: 'goal' });
    });
  }

  // Ações de Gols/Pontos Visitante
  if (btnIncScoreB) {
    btnIncScoreB.addEventListener('click', () => {
      if (!currentScoreboard) currentScoreboard = { teamA: {}, teamB: {}, timer: {} };
      if (!currentScoreboard.teamB) currentScoreboard.teamB = {};
      const next = (Number(currentScoreboard.teamB.score) || 0) + 1;
      currentScoreboard.teamB.score = next;
      if (sbDisplayScoreB) sbDisplayScoreB.textContent = next;
      socket.emit('scoreboard:score-change', { team: 'teamB', delta: 1, triggerCelebration: true });
      updateScoreboardMiniPreview();
    });
  }
  if (btnDecScoreB) {
    btnDecScoreB.addEventListener('click', () => {
      if (!currentScoreboard) currentScoreboard = { teamA: {}, teamB: {}, timer: {} };
      if (!currentScoreboard.teamB) currentScoreboard.teamB = {};
      const next = Math.max(0, (Number(currentScoreboard.teamB.score) || 0) - 1);
      currentScoreboard.teamB.score = next;
      if (sbDisplayScoreB) sbDisplayScoreB.textContent = next;
      socket.emit('scoreboard:score-change', { team: 'teamB', delta: -1 });
      updateScoreboardMiniPreview();
    });
  }
  if (btnTriggerGoalB) {
    btnTriggerGoalB.addEventListener('click', () => {
      const name = sbInputNameB?.value || 'Visitante';
      socket.emit('scoreboard:trigger-celebration', { text: 'GOL!', subtext: name, type: 'goal' });
    });
  }

  // Cartões Mandante
  if (btnIncYellowA) btnIncYellowA.addEventListener('click', () => {
    const cur = (Number(currentScoreboard?.teamA?.yellowCards) || 0) + 1;
    if (currentScoreboard?.teamA) currentScoreboard.teamA.yellowCards = cur;
    if (sbCountYellowA) sbCountYellowA.textContent = cur;
    socket.emit('scoreboard:update', { teamA: { yellowCards: cur } });
    updateScoreboardMiniPreview();
  });
  if (btnDecYellowA) btnDecYellowA.addEventListener('click', () => {
    const cur = Math.max(0, (Number(currentScoreboard?.teamA?.yellowCards) || 0) - 1);
    if (currentScoreboard?.teamA) currentScoreboard.teamA.yellowCards = cur;
    if (sbCountYellowA) sbCountYellowA.textContent = cur;
    socket.emit('scoreboard:update', { teamA: { yellowCards: cur } });
    updateScoreboardMiniPreview();
  });
  if (btnIncRedA) btnIncRedA.addEventListener('click', () => {
    const cur = (Number(currentScoreboard?.teamA?.redCards) || 0) + 1;
    if (currentScoreboard?.teamA) currentScoreboard.teamA.redCards = cur;
    if (sbCountRedA) sbCountRedA.textContent = cur;
    socket.emit('scoreboard:update', { teamA: { redCards: cur } });
    updateScoreboardMiniPreview();
  });
  if (btnDecRedA) btnDecRedA.addEventListener('click', () => {
    const cur = Math.max(0, (Number(currentScoreboard?.teamA?.redCards) || 0) - 1);
    if (currentScoreboard?.teamA) currentScoreboard.teamA.redCards = cur;
    if (sbCountRedA) sbCountRedA.textContent = cur;
    socket.emit('scoreboard:update', { teamA: { redCards: cur } });
    updateScoreboardMiniPreview();
  });

  // Cartões Visitante
  if (btnIncYellowB) btnIncYellowB.addEventListener('click', () => {
    const cur = (Number(currentScoreboard?.teamB?.yellowCards) || 0) + 1;
    if (currentScoreboard?.teamB) currentScoreboard.teamB.yellowCards = cur;
    if (sbCountYellowB) sbCountYellowB.textContent = cur;
    socket.emit('scoreboard:update', { teamB: { yellowCards: cur } });
    updateScoreboardMiniPreview();
  });
  if (btnDecYellowB) btnDecYellowB.addEventListener('click', () => {
    const cur = Math.max(0, (Number(currentScoreboard?.teamB?.yellowCards) || 0) - 1);
    if (currentScoreboard?.teamB) currentScoreboard.teamB.yellowCards = cur;
    if (sbCountYellowB) sbCountYellowB.textContent = cur;
    socket.emit('scoreboard:update', { teamB: { yellowCards: cur } });
    updateScoreboardMiniPreview();
  });
  if (btnIncRedB) btnIncRedB.addEventListener('click', () => {
    const cur = (Number(currentScoreboard?.teamB?.redCards) || 0) + 1;
    if (currentScoreboard?.teamB) currentScoreboard.teamB.redCards = cur;
    if (sbCountRedB) sbCountRedB.textContent = cur;
    socket.emit('scoreboard:update', { teamB: { redCards: cur } });
    updateScoreboardMiniPreview();
  });
  if (btnDecRedB) btnDecRedB.addEventListener('click', () => {
    const cur = Math.max(0, (Number(currentScoreboard?.teamB?.redCards) || 0) - 1);
    if (currentScoreboard?.teamB) currentScoreboard.teamB.redCards = cur;
    if (sbCountRedB) sbCountRedB.textContent = cur;
    socket.emit('scoreboard:update', { teamB: { redCards: cur } });
    updateScoreboardMiniPreview();
  });

  // Sets Vôlei
  if (btnIncSetsA) btnIncSetsA.addEventListener('click', () => {
    const cur = (Number(currentScoreboard?.teamA?.setsWon) || 0) + 1;
    if (currentScoreboard?.teamA) currentScoreboard.teamA.setsWon = cur;
    if (sbCountSetsA) sbCountSetsA.textContent = cur;
    socket.emit('scoreboard:update', { teamA: { setsWon: cur } });
    updateScoreboardMiniPreview();
  });
  if (btnDecSetsA) btnDecSetsA.addEventListener('click', () => {
    const cur = Math.max(0, (Number(currentScoreboard?.teamA?.setsWon) || 0) - 1);
    if (currentScoreboard?.teamA) currentScoreboard.teamA.setsWon = cur;
    if (sbCountSetsA) sbCountSetsA.textContent = cur;
    socket.emit('scoreboard:update', { teamA: { setsWon: cur } });
    updateScoreboardMiniPreview();
  });
  if (btnIncSetsB) btnIncSetsB.addEventListener('click', () => {
    const cur = (Number(currentScoreboard?.teamB?.setsWon) || 0) + 1;
    if (currentScoreboard?.teamB) currentScoreboard.teamB.setsWon = cur;
    if (sbCountSetsB) sbCountSetsB.textContent = cur;
    socket.emit('scoreboard:update', { teamB: { setsWon: cur } });
    updateScoreboardMiniPreview();
  });
  if (btnDecSetsB) btnDecSetsB.addEventListener('click', () => {
    const cur = Math.max(0, (Number(currentScoreboard?.teamB?.setsWon) || 0) - 1);
    if (currentScoreboard?.teamB) currentScoreboard.teamB.setsWon = cur;
    if (sbCountSetsB) sbCountSetsB.textContent = cur;
    socket.emit('scoreboard:update', { teamB: { setsWon: cur } });
    updateScoreboardMiniPreview();
  });

  // Saque Vôlei
  if (radioServingA) radioServingA.addEventListener('change', () => {
    if (radioServingA.checked) socket.emit('scoreboard:update', { servingTeam: 'teamA' });
  });
  if (radioServingB) radioServingB.addEventListener('change', () => {
    if (radioServingB.checked) socket.emit('scoreboard:update', { servingTeam: 'teamB' });
  });

  // Inputs de Texto e Cores dos Clubes
  function syncTeamAInfo() {
    if (!currentScoreboard.teamA) currentScoreboard.teamA = {};
    currentScoreboard.teamA.name = sbInputNameA?.value || 'Mandante FC';
    currentScoreboard.teamA.shortName = (sbInputShortA?.value || 'MAN').toUpperCase();
    currentScoreboard.teamA.color = sbInputColorA?.value || '#16a34a';
    socket.emit('scoreboard:update', {
      teamA: {
        name: currentScoreboard.teamA.name,
        shortName: currentScoreboard.teamA.shortName,
        color: currentScoreboard.teamA.color
      }
    });
    updateScoreboardMiniPreview();
  }

  function syncTeamBInfo() {
    if (!currentScoreboard.teamB) currentScoreboard.teamB = {};
    currentScoreboard.teamB.name = sbInputNameB?.value || 'Visitante EC';
    currentScoreboard.teamB.shortName = (sbInputShortB?.value || 'VIS').toUpperCase();
    currentScoreboard.teamB.color = sbInputColorB?.value || '#2563eb';
    socket.emit('scoreboard:update', {
      teamB: {
        name: currentScoreboard.teamB.name,
        shortName: currentScoreboard.teamB.shortName,
        color: currentScoreboard.teamB.color
      }
    });
    updateScoreboardMiniPreview();
  }

  if (sbInputNameA) sbInputNameA.addEventListener('change', syncTeamAInfo);
  if (sbInputShortA) sbInputShortA.addEventListener('change', syncTeamAInfo);
  if (sbInputColorA) sbInputColorA.addEventListener('input', () => {
    if (sbTextColorA) sbTextColorA.value = sbInputColorA.value;
    if (badgePillA) badgePillA.style.background = sbInputColorA.value;
  });
  if (sbInputColorA) sbInputColorA.addEventListener('change', syncTeamAInfo);
  if (sbTextColorA) sbTextColorA.addEventListener('change', () => {
    if (sbInputColorA) sbInputColorA.value = sbTextColorA.value;
    syncTeamAInfo();
  });

  if (sbInputNameB) sbInputNameB.addEventListener('change', syncTeamBInfo);
  if (sbInputShortB) sbInputShortB.addEventListener('change', syncTeamBInfo);
  if (sbInputColorB) sbInputColorB.addEventListener('input', () => {
    if (sbTextColorB) sbTextColorB.value = sbInputColorB.value;
    if (badgePillB) badgePillB.style.background = sbInputColorB.value;
  });
  if (sbInputColorB) sbInputColorB.addEventListener('change', syncTeamBInfo);
  if (sbTextColorB) sbTextColorB.addEventListener('change', () => {
    if (sbInputColorB) sbInputColorB.value = sbTextColorB.value;
    syncTeamBInfo();
  });

  // Upload de Escudos Time A e Time B com compressão automática
  if (btnUploadLogoA && sbFileLogoA) {
    btnUploadLogoA.addEventListener('click', () => sbFileLogoA.click());
    sbFileLogoA.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const compressed = await compressLogoImage(file, 140);
        if (!currentScoreboard.teamA) currentScoreboard.teamA = {};
        currentScoreboard.teamA.logo = compressed;
        socket.emit('scoreboard:update', { teamA: { logo: compressed } });
        if (btnRemoveLogoA) btnRemoveLogoA.classList.remove('is-hidden');
        if (sbLogoPreviewNameA) sbLogoPreviewNameA.textContent = 'Escudo ativo';
        updateScoreboardMiniPreview();
      } catch (err) {
        window.alert('Erro ao carregar escudo do Time A. Escolha um arquivo PNG, JPG ou SVG.');
      }
    });
  }
  if (btnRemoveLogoA) {
    btnRemoveLogoA.addEventListener('click', () => {
      if (currentScoreboard?.teamA) currentScoreboard.teamA.logo = '';
      socket.emit('scoreboard:update', { teamA: { logo: '' } });
      if (sbFileLogoA) sbFileLogoA.value = '';
      btnRemoveLogoA.classList.add('is-hidden');
      if (sbLogoPreviewNameA) sbLogoPreviewNameA.textContent = 'Sem escudo';
      updateScoreboardMiniPreview();
    });
  }

  if (btnUploadLogoB && sbFileLogoB) {
    btnUploadLogoB.addEventListener('click', () => sbFileLogoB.click());
    sbFileLogoB.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const compressed = await compressLogoImage(file, 140);
        if (!currentScoreboard.teamB) currentScoreboard.teamB = {};
        currentScoreboard.teamB.logo = compressed;
        socket.emit('scoreboard:update', { teamB: { logo: compressed } });
        if (btnRemoveLogoB) btnRemoveLogoB.classList.remove('is-hidden');
        if (sbLogoPreviewNameB) sbLogoPreviewNameB.textContent = 'Escudo ativo';
        updateScoreboardMiniPreview();
      } catch (err) {
        window.alert('Erro ao carregar escudo do Time B. Escolha um arquivo PNG, JPG ou SVG.');
      }
    });
  }
  if (btnRemoveLogoB) {
    btnRemoveLogoB.addEventListener('click', () => {
      if (currentScoreboard?.teamB) currentScoreboard.teamB.logo = '';
      socket.emit('scoreboard:update', { teamB: { logo: '' } });
      if (sbFileLogoB) sbFileLogoB.value = '';
      btnRemoveLogoB.classList.add('is-hidden');
      if (sbLogoPreviewNameB) sbLogoPreviewNameB.textContent = 'Sem escudo';
      updateScoreboardMiniPreview();
    });
  }

  // Controles do Cronômetro
  if (btnSbToggleTimer) {
    btnSbToggleTimer.addEventListener('click', () => {
      const isRunning = Boolean(currentScoreboard?.timer?.running);
      const nextRunning = !isRunning;
      if (currentScoreboard?.timer) currentScoreboard.timer.running = nextRunning;
      btnSbToggleTimer.classList.toggle('is-running', nextRunning);
      if (labelBtnTimer) labelBtnTimer.textContent = nextRunning ? 'Pausar Relógio' : 'Iniciar Tempo';
      if (sbTimerStateLabel) {
        sbTimerStateLabel.textContent = nextRunning ? 'EM ANDAMENTO' : 'PAUSADO';
        sbTimerStateLabel.classList.toggle('is-running', nextRunning);
      }
      socket.emit('scoreboard:timer-control', { action: nextRunning ? 'start' : 'pause' });
      updateScoreboardMiniPreview();
    });
  }

  if (btnSbPlus1m) {
    btnSbPlus1m.addEventListener('click', () => {
      const sec = (currentScoreboard?.timer?.seconds || 0) + 60;
      if (currentScoreboard?.timer) currentScoreboard.timer.seconds = sec;
      if (sbTimerDigits) sbTimerDigits.textContent = formatTime(sec);
      socket.emit('scoreboard:timer-control', { action: 'set', seconds: sec });
      updateScoreboardMiniPreview();
    });
  }

  if (btnSbMinus1m) {
    btnSbMinus1m.addEventListener('click', () => {
      const sec = Math.max(0, (currentScoreboard?.timer?.seconds || 0) - 60);
      if (currentScoreboard?.timer) currentScoreboard.timer.seconds = sec;
      if (sbTimerDigits) sbTimerDigits.textContent = formatTime(sec);
      socket.emit('scoreboard:timer-control', { action: 'set', seconds: sec });
      updateScoreboardMiniPreview();
    });
  }

  if (btnSbResetTimer) {
    btnSbResetTimer.addEventListener('click', () => {
      if (currentScoreboard?.timer) {
        currentScoreboard.timer.seconds = 0;
        currentScoreboard.timer.running = false;
        currentScoreboard.timer.extraMinutes = 0;
      }
      if (sbTimerDigits) sbTimerDigits.textContent = '00:00';
      if (sbTimerStateLabel) {
        sbTimerStateLabel.textContent = 'PAUSADO';
        sbTimerStateLabel.classList.remove('is-running');
      }
      if (btnSbToggleTimer) btnSbToggleTimer.classList.remove('is-running');
      if (labelBtnTimer) labelBtnTimer.textContent = 'Iniciar Tempo';
      extraPills.forEach(p => p.classList.toggle('active', Number(p.dataset.extra) === 0));
      socket.emit('scoreboard:timer-control', { action: 'reset' });
      updateScoreboardMiniPreview();
    });
  }

  if (sbPeriodSelect) {
    sbPeriodSelect.addEventListener('change', () => {
      const selOpt = sbPeriodSelect.options[sbPeriodSelect.selectedIndex];
      if (currentScoreboard) currentScoreboard.period = sbPeriodSelect.value;
      socket.emit('scoreboard:update', {
        period: sbPeriodSelect.value,
        periodLabel: selOpt ? selOpt.text : sbPeriodSelect.value
      });
      updateScoreboardMiniPreview();
    });
  }

  extraPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const extra = Number(pill.dataset.extra) || 0;
      if (currentScoreboard?.timer) currentScoreboard.timer.extraMinutes = extra;
      extraPills.forEach(p => p.classList.toggle('active', Number(p.dataset.extra) === extra));
      socket.emit('scoreboard:timer-control', { action: 'set', extraMinutes: extra });
      updateScoreboardMiniPreview();
    });
  });

  // Listeners Socket do Placar
  socket.on('scoreboard:sync', (sb) => {
    renderScoreboardControls(sb);
  });

  socket.on('scoreboard:tick', ({ seconds, running }) => {
    if (currentScoreboard && currentScoreboard.timer) {
      if (typeof seconds === 'number') currentScoreboard.timer.seconds = seconds;
      if (typeof running === 'boolean') currentScoreboard.timer.running = running;
    }
    if (sbTimerDigits && typeof seconds === 'number') sbTimerDigits.textContent = formatTime(seconds);
    if (typeof running === 'boolean') {
      if (sbTimerStateLabel) {
        sbTimerStateLabel.textContent = running ? 'EM ANDAMENTO' : 'PAUSADO';
        sbTimerStateLabel.classList.toggle('is-running', running);
      }
      if (btnSbToggleTimer && labelBtnTimer) {
        btnSbToggleTimer.classList.toggle('is-running', running);
        labelBtnTimer.textContent = running ? 'Pausar Relógio' : 'Iniciar Tempo';
      }
    }
    updateScoreboardMiniPreview();
  });

  // ==========================================================================
  // ATALHOS DE TECLADO DE ESTÚDIO AO VIVO (FASE 6)
  // ==========================================================================
  window.addEventListener('keydown', (e) => {
    // Fecha qualquer modal aberto com ESC
    if (e.key === 'Escape') {
      closeEditModal();
      closePlaylistModal();
      closeQrModal();
      return;
    }

    // Atalhos Alt + Tecla (funcionam em qualquer lugar do painel, ignorando AltGr do teclado ABNT2)
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.getModifierState?.('AltGraph')) {
      const key = e.key.toLowerCase();
      if (key === 'a') {
        e.preventDefault();
        if (currentState) {
          socket.emit('settings:update', { visible: !currentState.settings.visible });
        }
      } else if (key === 'o') {
        e.preventDefault();
        switchView('live');
      } else if (key === 's') {
        e.preventDefault();
        switchView('settings');
      } else if (key === 'p') {
        e.preventDefault();
        switchView('sports');
      } else if (key === 'n') {
        e.preventDefault();
        socket.emit('rotation:next');
      } else if (key === 'c') {
        e.preventDefault();
        socket.emit('rotation:clearCurrent');
      } else if (key === 'i') {
        e.preventDefault();
        socket.emit('audience:startBatch');
      } else if (key === 'l') {
        e.preventDefault();
        socket.emit('lowerThird:hide');
      }
    }

    // Atalhos Rápidos no Teclado Numérico (Numpad) para Operação do Placar
    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA';
    if (!isTyping) {
      if (e.code === 'Numpad7') {
        e.preventDefault();
        btnIncScoreA?.click();
      } else if (e.code === 'Numpad4') {
        e.preventDefault();
        btnDecScoreA?.click();
      } else if (e.code === 'Numpad9') {
        e.preventDefault();
        btnIncScoreB?.click();
      } else if (e.code === 'Numpad6') {
        e.preventDefault();
        btnDecScoreB?.click();
      } else if (e.code === 'Numpad8') {
        e.preventDefault();
        btnSbToggleTimer?.click();
      } else if (e.code === 'Numpad5') {
        e.preventDefault();
        btnTriggerGoalA?.click();
      } else if (e.code === 'Numpad2') {
        e.preventDefault();
        btnTriggerGoalB?.click();
      } else if (e.code === 'Numpad0') {
        e.preventDefault();
        btnSbSwitchSides?.click();
      }
    }
  });

  // ==========================================================================
  // SINCRONIZAÇÃO SOCKET.IO & RESILIÊNCIA DE CONEXÃO
  // ==========================================================================
  socket.on('connect', () => {
    console.log('[tImago] Conexão Socket.IO estabelecida com sucesso');
    const notice = document.getElementById('offline-notice-banner');
    if (notice) notice.remove();
  });

  socket.on('disconnect', () => {
    console.warn('[tImago] Conexão com o servidor local perdida. Reconectando...');
    if (!document.getElementById('offline-notice-banner')) {
      const banner = document.createElement('div');
      banner.id = 'offline-notice-banner';
      banner.style.cssText = 'position:fixed;bottom:20px;right:20px;background:rgba(239,68,68,0.92);backdrop-filter:blur(8px);color:#fff;padding:10px 18px;border-radius:10px;font-weight:700;font-size:13px;z-index:999999;box-shadow:0 8px 30px rgba(0,0,0,0.6);display:flex;align-items:center;gap:10px;border:1px solid rgba(255,255,255,0.2);';
      banner.innerHTML = '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#fff;animation:airPulse 1s infinite;"></span> Reconectando ao tImago...';
      document.body.appendChild(banner);
    }
  });

  socket.on('connect_error', () => {
    console.warn('[tImago] Erro ao conectar ao servidor local');
  });

  socket.on('state:sync', (payload) => {
    if (!payload) return;
    currentState = payload.state;

    const serverNow = payload.runtime?.serverNow || Date.now();
    const phaseStartedAt = payload.runtime?.phaseStartedAt || serverNow;

    currentRuntime = {
      ...payload.runtime,
      initialElapsedMs: Math.max(0, serverNow - phaseStartedAt),
      clientSyncedAt: Date.now()
    };

    renderMasterControls(currentState.settings);
    renderLowerThirdControls(currentState.lowerThird);
    renderPlaylistsSelector(currentState.playlists || [], currentState.activePlaylistId);
    if (mobileQrModal && !mobileQrModal.classList.contains('is-hidden')) {
      renderMobileQrCodes(currentRuntime);
    }
    renderAudienceQueue(currentState.audienceQueue || [], currentRuntime, currentState.settings);
    renderPhrasesList(currentState.phrases || [], currentRuntime, currentState.settings);
    if (currentState.scoreboard) {
      renderScoreboardControls(currentState.scoreboard);
    }
    if (!updaterAutoChecked && currentRuntime.appVersion) {
      updaterAutoChecked = true;
      if (settingsAppVersion) {
        settingsAppVersion.textContent = 'v' + currentRuntime.appVersion;
      }
      setTimeout(() => {
        socket.emit('updater:check', { force: false });
      }, 3000);
    }
    updateLiveMonitorTick();
  });

  // ==========================================================================
  // SISTEMA DE ATUALIZAÇÕES AUTOMÁTICAS E GERENCIADOR DE VERSÕES
  // ==========================================================================
  let latestUpdateInfo = null;
  let downloadedInstallerPath = null;
  let isDownloadingUpdate = false;
  let updaterAutoChecked = false;

  const updateBanner = document.getElementById('update-topbar-banner');
  const updateBannerVersion = document.getElementById('update-banner-version');
  const btnBannerUpdate = document.getElementById('btn-banner-update');
  const btnBannerChangelog = document.getElementById('btn-banner-changelog');
  const btnBannerDismiss = document.getElementById('btn-banner-dismiss');

  const settingsAppVersion = document.getElementById('settings-app-version');
  const settingsUpdateMsg = document.getElementById('settings-update-msg');
  const settingsLastCheck = document.getElementById('settings-last-check');
  const btnCheckUpdatesNow = document.getElementById('btn-check-updates-now');
  const iconCheckUpdates = document.getElementById('icon-check-updates');
  const btnSettingsOpenUpdate = document.getElementById('btn-settings-open-update');

  const updateModal = document.getElementById('update-modal');
  const btnCloseUpdateModal = document.getElementById('btn-close-update-modal');
  const modalUpdateBadge = document.getElementById('modal-update-badge');
  const updateStateInfo = document.getElementById('update-state-info');
  const updateStateDownloading = document.getElementById('update-state-downloading');
  const updateStateReady = document.getElementById('update-state-ready');

  const updateCurrVer = document.getElementById('update-curr-ver');
  const updateNewVer = document.getElementById('update-new-ver');
  const updateReleaseDate = document.getElementById('update-release-date');
  const updateReleaseTitle = document.getElementById('update-release-title');
  const updateChangelogBody = document.getElementById('update-changelog-body');
  const linkDownloadPortable = document.getElementById('link-download-portable');
  const linkViewGithub = document.getElementById('link-view-github');
  const btnCancelUpdateInfo = document.getElementById('btn-cancel-update-info');
  const btnStartAutoUpdate = document.getElementById('btn-start-auto-update');

  const updateProgressFill = document.getElementById('update-progress-fill');
  const updateStatPercent = document.getElementById('update-stat-percent');
  const updateStatBytes = document.getElementById('update-stat-bytes');
  const updateStatSpeed = document.getElementById('update-stat-speed');
  const btnCancelDownloadActive = document.getElementById('btn-cancel-download-active');

  const updateReadyVer = document.getElementById('update-ready-ver');
  const btnPostponeInstall = document.getElementById('btn-postpone-install');
  const btnInstallAndRestart = document.getElementById('btn-install-and-restart');

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function renderMarkdownNotes(text) {
    if (!text) return '<p class="text-gray-400 italic">Nenhum detalhe adicional informado.</p>';
    const escapeHtml = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = text.split(/\r?\n/);
    let html = '';
    let inList = false;

    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        if (inList) { html += '</ul>'; inList = false; }
        continue;
      }
      if (line.startsWith('### ')) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h5 class="text-xs font-bold text-gray-200 mt-2 mb-1">${escapeHtml(line.slice(4))}</h5>`;
      } else if (line.startsWith('## ') || line.startsWith('# ')) {
        if (inList) { html += '</ul>'; inList = false; }
        const title = line.replace(/^#+\s*/, '');
        html += `<h4 class="text-sm font-bold text-emerald-400 mt-3 mb-1">${escapeHtml(title)}</h4>`;
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!inList) { html += '<ul class="list-disc list-inside space-y-1 text-gray-300 text-xs">'; inList = true; }
        html += `<li>${escapeHtml(line.slice(2))}</li>`;
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<p class="text-xs text-gray-300 mb-1">${escapeHtml(line)}</p>`;
      }
    }
    if (inList) html += '</ul>';
    return html;
  }

  function setUpdateModalStep(step) {
    if (!updateStateInfo || !updateStateDownloading || !updateStateReady) return;
    updateStateInfo.classList.add('is-hidden');
    updateStateDownloading.classList.add('is-hidden');
    updateStateReady.classList.add('is-hidden');

    if (step === 'info') {
      updateStateInfo.classList.remove('is-hidden');
      if (modalUpdateBadge) modalUpdateBadge.textContent = 'Nova Versão';
    } else if (step === 'downloading') {
      updateStateDownloading.classList.remove('is-hidden');
      if (modalUpdateBadge) modalUpdateBadge.textContent = 'Baixando...';
    } else if (step === 'ready') {
      updateStateReady.classList.remove('is-hidden');
      if (modalUpdateBadge) modalUpdateBadge.textContent = 'Pronto para Instalar';
    }
  }

  function showUpdateModal(step = 'info') {
    if (!updateModal) return;
    setUpdateModalStep(step);
    updateModal.classList.remove('is-hidden');
  }

  function hideUpdateModal() {
    if (!updateModal) return;
    if (isDownloadingUpdate) {
      const confirmCancel = window.confirm('O download da atualização está em andamento. Deseja cancelar o download?');
      if (!confirmCancel) return;
      socket.emit('updater:cancelDownload');
      isDownloadingUpdate = false;
    }
    updateModal.classList.add('is-hidden');
  }

  function handleUpdateStatus(info) {
    if (!info) return;
    latestUpdateInfo = info;

    if (settingsAppVersion && info.currentVersion) {
      settingsAppVersion.textContent = 'v' + info.currentVersion;
    }

    if (settingsLastCheck) {
      settingsLastCheck.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    if (iconCheckUpdates) iconCheckUpdates.classList.remove('fa-spin');
    if (btnCheckUpdatesNow) btnCheckUpdatesNow.disabled = false;

    if (info.error) {
      if (settingsUpdateMsg) {
        settingsUpdateMsg.innerHTML = `<span class="status-indicator-dot bg-amber-500"></span> <span class="text-amber-400">Não foi possível checar: ${info.error}</span>`;
      }
      return;
    }

    if (info.updateAvailable || info.available) {
      // Exibe banner superior
      if (updateBanner) {
        updateBanner.classList.remove('is-hidden');
        if (updateBannerVersion) {
          updateBannerVersion.textContent = 'v' + info.latestVersion;
        }
      }

      // Exibe botão de atalho em configurações
      if (btnSettingsOpenUpdate) {
        btnSettingsOpenUpdate.classList.remove('is-hidden');
      }

      if (settingsUpdateMsg) {
        settingsUpdateMsg.innerHTML = `<span class="status-indicator-dot bg-blue-500"></span> <strong class="text-blue-400">Nova versão v${info.latestVersion} disponível!</strong>`;
      }

      // Atualiza campos do modal
      if (updateCurrVer) updateCurrVer.textContent = 'v' + info.currentVersion;
      if (updateNewVer) updateNewVer.textContent = 'v' + info.latestVersion;
      if (updateReadyVer) updateReadyVer.textContent = 'v' + info.latestVersion;
      if (updateReleaseTitle) updateReleaseTitle.textContent = info.releaseName || ('Novidades da Versão ' + info.latestVersion);
      if (updateReleaseDate) {
        updateReleaseDate.textContent = info.publishedAt
          ? new Date(info.publishedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
          : 'Recente';
      }
      if (updateChangelogBody) {
        updateChangelogBody.innerHTML = renderMarkdownNotes(info.releaseNotes);
      }
      if (linkDownloadPortable) {
        linkDownloadPortable.href = info.portableAsset ? info.portableAsset.downloadUrl : (info.releaseUrl || '#');
      }
      if (linkViewGithub) {
        linkViewGithub.href = info.releaseUrl || 'https://github.com/TTreter/tImago/releases';
      }

      if (btnStartAutoUpdate) {
        if (info.setupAsset && info.setupAsset.downloadUrl) {
          btnStartAutoUpdate.disabled = false;
          btnStartAutoUpdate.innerHTML = '<i class="fas fa-download"></i> Baixar e Atualizar';
        } else {
          btnStartAutoUpdate.disabled = false;
          btnStartAutoUpdate.innerHTML = '<i class="fab fa-github"></i> Baixar no GitHub';
        }
      }
    } else {
      // Já está atualizado
      if (updateBanner) updateBanner.classList.add('is-hidden');
      if (btnSettingsOpenUpdate) btnSettingsOpenUpdate.classList.add('is-hidden');
      if (settingsUpdateMsg) {
        settingsUpdateMsg.innerHTML = `<span class="status-indicator-dot bg-emerald-500"></span> <span class="text-emerald-400">Você já está usando a versão mais recente (v${info.currentVersion})!</span>`;
      }
    }
  }

  // Socket events do Updater
  socket.on('updater:status', (info) => {
    handleUpdateStatus(info);
  });

  socket.on('updater:progress', (progress) => {
    if (!progress) return;
    const { percent = 0, transferredBytes = 0, totalBytes = 0, speedBytesPerSec = 0 } = progress;
    if (updateProgressFill) {
      updateProgressFill.style.width = Math.min(100, Math.max(0, percent)) + '%';
    }
    if (updateStatPercent) {
      updateStatPercent.textContent = Math.round(percent) + '%';
    }
    if (updateStatBytes) {
      updateStatBytes.textContent = `${formatBytes(transferredBytes)} / ${formatBytes(totalBytes)}`;
    }
    if (updateStatSpeed) {
      updateStatSpeed.textContent = `${formatBytes(speedBytesPerSec)}/s`;
    }
  });

  socket.on('updater:downloadComplete', (result) => {
    isDownloadingUpdate = false;
    downloadedInstallerPath = result.installerPath;
    if (updateReadyVer) {
      updateReadyVer.textContent = 'v' + (result.version || (latestUpdateInfo ? latestUpdateInfo.latestVersion : '1.4.0'));
    }
    setUpdateModalStep('ready');
  });

  socket.on('updater:error', ({ message }) => {
    isDownloadingUpdate = false;
    setUpdateModalStep('info');
    if (iconCheckUpdates) iconCheckUpdates.classList.remove('fa-spin');
    if (btnCheckUpdatesNow) btnCheckUpdatesNow.disabled = false;
    window.alert('Erro durante a atualização: ' + (message || 'Falha desconhecida'));
  });

  socket.on('updater:cancelled', () => {
    isDownloadingUpdate = false;
    setUpdateModalStep('info');
  });

  // Interações de UI
  btnBannerUpdate?.addEventListener('click', () => {
    showUpdateModal('info');
  });

  btnBannerChangelog?.addEventListener('click', () => {
    showUpdateModal('info');
  });

  btnBannerDismiss?.addEventListener('click', () => {
    if (updateBanner) updateBanner.classList.add('is-hidden');
  });

  btnSettingsOpenUpdate?.addEventListener('click', () => {
    showUpdateModal('info');
  });

  btnCheckUpdatesNow?.addEventListener('click', () => {
    if (iconCheckUpdates) iconCheckUpdates.classList.add('fa-spin');
    if (btnCheckUpdatesNow) btnCheckUpdatesNow.disabled = true;
    if (settingsUpdateMsg) {
      settingsUpdateMsg.innerHTML = '<span class="status-indicator-dot bg-blue-500"></span> Buscando atualizações no GitHub...';
    }
    socket.emit('updater:check', { force: true });
  });

  btnCloseUpdateModal?.addEventListener('click', hideUpdateModal);
  btnCancelUpdateInfo?.addEventListener('click', hideUpdateModal);
  btnPostponeInstall?.addEventListener('click', hideUpdateModal);

  updateModal?.addEventListener('click', (e) => {
    if (e.target === updateModal) {
      hideUpdateModal();
    }
  });

  btnStartAutoUpdate?.addEventListener('click', () => {
    if (!latestUpdateInfo) return;
    if (latestUpdateInfo.setupAsset && latestUpdateInfo.setupAsset.downloadUrl) {
      isDownloadingUpdate = true;
      if (updateProgressFill) updateProgressFill.style.width = '0%';
      if (updateStatPercent) updateStatPercent.textContent = '0%';
      if (updateStatBytes) updateStatBytes.textContent = 'Iniciando download...';
      if (updateStatSpeed) updateStatSpeed.textContent = '0 KB/s';
      setUpdateModalStep('downloading');
      socket.emit('updater:startDownload', { url: latestUpdateInfo.setupAsset.downloadUrl });
    } else if (latestUpdateInfo.releaseUrl) {
      window.open(latestUpdateInfo.releaseUrl, '_blank');
    }
  });

  btnCancelDownloadActive?.addEventListener('click', () => {
    socket.emit('updater:cancelDownload');
    isDownloadingUpdate = false;
    setUpdateModalStep('info');
  });

  btnInstallAndRestart?.addEventListener('click', () => {
    if (!downloadedInstallerPath) {
      window.alert('Arquivo do instalador não localizado. Tente baixar novamente.');
      setUpdateModalStep('info');
      return;
    }
    btnInstallAndRestart.disabled = true;
    btnInstallAndRestart.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando instalador e fechando app...';
    socket.emit('updater:launchInstaller', { installerPath: downloadedInstallerPath });
  });

  // Pontes globais chamadas pelo processo principal Electron via webContents.executeJavaScript
  window.tImagoOnUpdateFound = (info) => {
    handleUpdateStatus(info);
  };

  window.tImagoOpenUpdateModal = () => {
    showUpdateModal('info');
  };

  if (!countdownInterval) {
    countdownInterval = setInterval(updateLiveMonitorTick, 200);
  }
})();
