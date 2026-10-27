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
  window.addEventListener('resize', updatePreviewScale);
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

  function updateLiveMonitorTick() {
    if (!currentState || !currentRuntime) return;

    const visible = Boolean(currentState.settings?.visible);
    const phase = currentRuntime.phase;
    const phrase = currentRuntime.currentPhrase;

    livePhaseBadge.className = 'phase-badge';
    if (liveFloatingPopup) {
      liveFloatingPopup.classList.toggle('is-showing-now', visible && phase === 'showing');
    }

    if (!visible) {
      livePhaseBadge.classList.add('phase-off');
      livePhaseBadge.textContent = 'OVERLAY OCULTO';
      liveCurrentText.textContent = 'Overlay desligado (Off Air). Clique em "NO AR" ou em "Exibir Agora".';
      liveCurrentText.title = liveCurrentText.textContent;
      liveCurrentAuthor.textContent = '';
      liveCountdown.textContent = 'OFF';
      liveMiniProgressBar.style.width = '0%';
      return;
    }

    const elapsed = Math.max(0, Date.now() - (currentRuntime.clientSyncedAt || Date.now()));
    const totalDuration = currentRuntime.phaseDurationMs || 0;
    const remainingMs = Math.max(0, totalDuration - (currentRuntime.initialElapsedMs + elapsed));
    const remainingSec = Math.ceil(remainingMs / 1000);
    const progressPct = totalDuration > 0
      ? Math.min(100, Math.max(0, ((totalDuration - remainingMs) / totalDuration) * 100))
      : 0;

    if (phase === 'showing' && phrase) {
      livePhaseBadge.classList.add('phase-showing');
      livePhaseBadge.textContent = phrase.source === 'audience'
        ? '● PÚBLICO NO AR'
        : '● CARROSSEL NO AR';
      liveCurrentText.textContent = phrase.text;
      liveCurrentText.title = phrase.text;
      liveCurrentAuthor.textContent = phrase.author ? `— ${phrase.author}` : '';
      liveCountdown.textContent = `⏱ ${remainingSec}s`;
      liveMiniProgressBar.style.width = `${progressPct}%`;
    } else if (phase === 'interval') {
      const pendingAud = currentRuntime.pendingAudienceCount || 0;
      livePhaseBadge.classList.add('phase-interval');
      livePhaseBadge.textContent = 'INTERVALO';
      liveCurrentText.textContent = pendingAud > 0
        ? `Preparando próxima mensagem do público (${pendingAud} na fila)...`
        : 'Aguardando intervalo para exibir a próxima frase do carrossel...';
      liveCurrentText.title = liveCurrentText.textContent;
      liveCurrentAuthor.textContent = '';
      liveCountdown.textContent = `Próx. ${remainingSec}s`;
      liveMiniProgressBar.style.width = `${progressPct}%`;
    } else {
      livePhaseBadge.classList.add('phase-idle');
      livePhaseBadge.textContent = 'EM ESPERA';
      liveCurrentText.textContent = currentState.settings?.autoRotate
        ? 'Nenhuma frase ativa no carrossel ou na fila do público.'
        : 'Carrossel desligado — adicione uma frase na fila do público ou clique em "Exibir".';
      liveCurrentText.title = liveCurrentText.textContent;
      liveCurrentAuthor.textContent = '';
      liveCountdown.textContent = '--';
      liveMiniProgressBar.style.width = '0%';
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
          statusBadge = '<span class="meta-tag meta-live-badge">● NO AR AGORA</span>';
        } else if (isPending) {
          statusBadge = '<span class="meta-tag meta-pending-badge">⏳ NA FILA</span>';
        } else {
          statusBadge = '<span class="meta-tag meta-played-badge">✓ JÁ EXIBIDA</span>';
        }

        let kickerBadge = '';
        if (item.kicker === '__NONE__') {
          kickerBadge = '<span class="meta-tag meta-played-badge">🚫 Sem Etiqueta</span>';
        } else if (item.kicker) {
          kickerBadge = `<span class="meta-tag meta-kicker">🏷️ ${escapeHtml(item.kicker)}</span>`;
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
            ? `<span class="meta-tag meta-kicker">🏷️ ${escapeHtml(phrase.kicker)}</span>`
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
                  ${isLive ? '<span class="meta-tag meta-live-badge">● NO AR AGORA</span>' : ''}
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
      const span = btnToggleReceptionMode.querySelector('span');
      if (span) {
        span.textContent = enabled ? '🎛️ Voltar ao Painel Completo' : '🙋 Modo Recepção';
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
      labelMobileQr.textContent = `📱 Celular (${ip})`;
    }
    if (qrUrlReception) qrUrlReception.textContent = receptionUrl;
    if (qrUrlFull) qrUrlFull.textContent = baseUrl;

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
  // SINCRONIZAÇÃO SOCKET.IO
  // ==========================================================================
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
    renderPlaylistsSelector(currentState.playlists || [], currentState.activePlaylistId);
    renderMobileQrCodes(currentRuntime);
    renderAudienceQueue(currentState.audienceQueue || [], currentRuntime, currentState.settings);
    renderPhrasesList(currentState.phrases || [], currentRuntime, currentState.settings);
    updateLiveMonitorTick();
  });

  if (!countdownInterval) {
    countdownInterval = setInterval(updateLiveMonitorTick, 200);
  }
})();
