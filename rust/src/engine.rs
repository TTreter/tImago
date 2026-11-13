//! Motor do tImago: estado em memória, temporização do carrossel, fila
//! prioritária do público, placar esportivo e tratamento dos eventos Socket.IO.
//!
//! Tudo aqui é síncrono e roda sob um único `Mutex`. As mensagens de saída vão
//! para um canal (`Outbox`) drenado pela camada de rede, e os temporizadores
//! são tarefas tokio invalidadas por contadores de geração.

use crate::js::*;
use crate::{net, state};
use parking_lot::Mutex;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{Arc, Weak};
use std::time::Duration;
use tokio::sync::{mpsc::UnboundedSender, Notify};

pub type Shared = Arc<Mutex<Core>>;
pub type Outbox = UnboundedSender<(&'static str, Value)>;
pub type Replies = Vec<(&'static str, Value)>;
pub type SettingsHook = Box<dyn Fn(&Value) + Send + Sync>;

const MAX_PIN_ATTEMPTS: u32 = 5;
const PIN_LOCKOUT_MS: i64 = 5 * 60 * 1000;

/// Identidade do cliente Socket.IO que originou um evento.
pub struct Client {
    pub ip: String,
    pub is_local: bool,
    pub token: Option<String>,
}

#[derive(Clone, Copy)]
enum Source {
    System,
    Audience,
}

impl Source {
    fn as_str(self) -> &'static str {
        match self {
            Source::System => "system",
            Source::Audience => "audience",
        }
    }
}

enum AfterDelay {
    ShowComplete,
    Advance,
}

/// Estado de execução em memória do motor de rotação.
struct Runtime {
    current_phrase_id: Value,
    current_phrase: Value,
    phase: &'static str, // "showing" | "interval" | "idle"
    phase_started_at: i64,
    phase_duration_ms: f64,
    queue_index: i64,
}

pub struct Core {
    pub state: Value,
    rt: Runtime,
    pub port: u16,
    pub version: String,
    pub data_dir: PathBuf,
    me: Weak<Mutex<Core>>,
    handle: tokio::runtime::Handle,
    out: Outbox,
    pub save_signal: Arc<Notify>,
    rotation_gen: u64,
    lower_third_gen: u64,
    tokens: HashSet<String>,
    pin_attempts: HashMap<String, (u32, i64)>,
    settings_hook: Option<SettingsHook>,
}

impl Core {
    pub fn new_shared(
        data_dir: PathBuf,
        version: String,
        out: Outbox,
        settings_hook: Option<SettingsHook>,
    ) -> Shared {
        let st = state::load(&data_dir);
        let handle = tokio::runtime::Handle::current();
        Arc::new_cyclic(|me| {
            Mutex::new(Core {
                state: st,
                rt: Runtime {
                    current_phrase_id: Value::Null,
                    current_phrase: Value::Null,
                    phase: "idle",
                    phase_started_at: now_ms(),
                    phase_duration_ms: 0.0,
                    queue_index: -1,
                },
                port: 3000,
                version,
                data_dir,
                me: me.clone(),
                handle,
                out,
                save_signal: Arc::new(Notify::new()),
                rotation_gen: 0,
                lower_third_gen: 0,
                tokens: HashSet::new(),
                pin_attempts: HashMap::new(),
                settings_hook,
            })
        })
    }

    // ------------------------------------------------------------------
    // Acesso ao estado
    // ------------------------------------------------------------------

    fn setting(&self, key: &str) -> &Value {
        &self.state["settings"][key]
    }

    fn flag(&self, key: &str) -> bool {
        truthy(self.setting(key))
    }

    fn set_setting(&mut self, key: &str, value: Value) {
        om(field(&mut self.state, "settings")).insert(key.into(), value);
    }

    pub fn settings(&self) -> &Value {
        &self.state["settings"]
    }

    pub fn is_overlay_visible(&self) -> bool {
        self.flag("visible")
    }

    fn security_mut(&mut self) -> &mut serde_json::Map<String, Value> {
        om(field(field(&mut self.state, "settings"), "security"))
    }

    fn pin_enabled(&self) -> bool {
        truthy(&self.state["settings"]["security"]["pinEnabled"])
    }

    fn scoreboard(&mut self) -> &mut Value {
        field(&mut self.state, "scoreboard")
    }

    fn team(&mut self, key: &str) -> &mut serde_json::Map<String, Value> {
        om(field(self.scoreboard(), key))
    }

    fn timer(&mut self) -> &mut serde_json::Map<String, Value> {
        om(field(self.scoreboard(), "timer"))
    }

    fn queue(&mut self) -> &mut Vec<Value> {
        am(field(&mut self.state, "audienceQueue"))
    }

    fn phrases(&mut self) -> &mut Vec<Value> {
        am(field(&mut self.state, "phrases"))
    }

    fn playlists(&mut self) -> &mut Vec<Value> {
        am(field(&mut self.state, "playlists"))
    }

    /// Frases fixas do sistema que estão ativas no carrossel.
    fn enabled_system_phrases(&self) -> Vec<Value> {
        self.state["phrases"]
            .as_array()
            .map(|a| a.iter().filter(|p| truthy(&p["enabled"])).cloned().collect())
            .unwrap_or_default()
    }

    /// Recados do público que ainda aguardam exibição.
    fn pending_audience(&self) -> Vec<Value> {
        self.state["audienceQueue"]
            .as_array()
            .map(|a| a.iter().filter(|i| i["status"] == "pending").cloned().collect())
            .unwrap_or_default()
    }

    fn pending_count(&self) -> usize {
        self.state["audienceQueue"]
            .as_array()
            .map_or(0, |a| a.iter().filter(|i| i["status"] == "pending").count())
    }

    /// A fila do público pode interromper o carrossel?
    /// - `audienceHoldMode` desligado: dispara assim que há itens pendentes.
    /// - `audienceHoldMode` ligado: aguarda o operador iniciar a exibição da fila.
    fn audience_allowed_to_play(&self) -> bool {
        if self.pending_count() == 0 {
            return false;
        }
        if !self.flag("audienceHoldMode") {
            return true;
        }
        self.flag("audienceBatchPlaying")
    }

    fn showing(&self, source: Source) -> bool {
        self.rt.phase == "showing" && self.rt.current_phrase["source"] == source.as_str()
    }

    // ------------------------------------------------------------------
    // Persistência e difusão
    // ------------------------------------------------------------------

    /// Mantém a playlist ativa espelhando `state.phrases`.
    fn sync_active_playlist(&mut self) {
        let id = self.state["activePlaylistId"].clone();
        let phrases = self.state["phrases"].clone();
        if let Some(pl) = self.playlists().iter_mut().find(|p| p["id"] == id) {
            if let Some(o) = pl.as_object_mut() {
                o.insert("phrases".into(), phrases);
            }
        }
    }

    /// Agenda gravação em disco (debounce feito pela tarefa de persistência).
    fn save(&mut self) {
        self.sync_active_playlist();
        self.save_signal.notify_one();
    }

    /// Gravação síncrona imediata (encerramento da aplicação).
    pub fn save_now(&mut self) {
        self.sync_active_playlist();
        if let Err(e) = state::write_atomic(&self.data_dir, &state::to_pretty(&self.state)) {
            eprintln!("Erro ao salvar state.json: {e}");
        }
    }

    pub fn snapshot_json(&self) -> String {
        state::to_pretty(&self.state)
    }

    fn emit(&self, event: &'static str, data: Value) {
        let _ = self.out.send((event, data));
    }

    /// Payload do evento `state:sync`.
    pub fn sync_payload(&self, is_local: Option<bool>) -> Value {
        let mut runtime = json!({
            "currentPhraseId": self.rt.current_phrase_id,
            "currentPhrase": self.rt.current_phrase,
            "phase": self.rt.phase,
            "phaseStartedAt": self.rt.phase_started_at,
            "phaseDurationMs": jnum(self.rt.phase_duration_ms),
            "queueIndex": self.rt.queue_index,
            "appVersion": self.version,
            "serverNow": now_ms(),
            "pendingAudienceCount": self.pending_count(),
            "localIp": net::local_ip(),
            "localDomain": "timago.local",
            "port": self.port,
        });
        if let Some(is_local) = is_local {
            om(&mut runtime).insert("isLocalHost".into(), Value::Bool(is_local));
        }
        om(&mut runtime).insert(
            "security".into(),
            json!({
                "pinEnabled": self.pin_enabled(),
                "pinConfigured": truthy(&self.state["settings"]["security"]["pinConfigured"]),
            }),
        );
        json!({ "state": self.state, "runtime": runtime })
    }

    pub fn auth_status(&self, is_local: bool) -> Value {
        json!({
            "isLocalHost": is_local,
            "pinEnabled": self.pin_enabled(),
            "pinConfigured": truthy(&self.state["settings"]["security"]["pinConfigured"]),
            "localDomain": "timago.local",
            "localIp": net::local_ip(),
            "port": self.port,
        })
    }

    pub fn scoreboard_json(&self) -> Value {
        self.state["scoreboard"].clone()
    }

    fn broadcast_state(&self) {
        self.emit("state:sync", self.sync_payload(None));
    }

    fn broadcast_scoreboard(&self) {
        self.emit("scoreboard:sync", self.scoreboard_json());
    }

    fn notify_settings_changed(&self) {
        if let Some(hook) = &self.settings_hook {
            hook(&self.state["settings"]);
        }
    }

    // ------------------------------------------------------------------
    // Temporizadores
    // ------------------------------------------------------------------

    fn clear_rotation_timer(&mut self) {
        self.rotation_gen += 1;
    }

    fn schedule_rotation(&mut self, delay_ms: f64, action: AfterDelay) {
        self.rotation_gen += 1;
        let gen = self.rotation_gen;
        let me = self.me.clone();
        self.handle.spawn(async move {
            tokio::time::sleep(Duration::from_millis(delay_ms.max(0.0) as u64)).await;
            let Some(core) = me.upgrade() else { return };
            let mut core = core.lock();
            if core.rotation_gen != gen {
                return;
            }
            match action {
                AfterDelay::ShowComplete => core.on_phrase_show_complete(),
                AfterDelay::Advance => core.advance_next_in_priority(),
            }
        });
    }

    fn after(&self, delay_ms: u64, f: impl FnOnce(&mut Core) + Send + 'static) {
        let me = self.me.clone();
        self.handle.spawn(async move {
            tokio::time::sleep(Duration::from_millis(delay_ms)).await;
            if let Some(core) = me.upgrade() {
                f(&mut core.lock());
            }
        });
    }

    // ------------------------------------------------------------------
    // Motor de rotação (Carrossel Contínuo + Fila Prioritária do Público)
    // ------------------------------------------------------------------

    fn set_idle(&mut self) {
        self.rt.current_phrase_id = Value::Null;
        self.rt.current_phrase = Value::Null;
        self.rt.phase = "idle";
        self.rt.phase_started_at = now_ms();
        self.rt.phase_duration_ms = 0.0;
    }

    fn go_idle_and_broadcast(&mut self) {
        self.set_idle();
        self.broadcast_state();
    }

    /// Exibe imediatamente uma frase específica no overlay e agenda seu término.
    fn show_phrase_now(&mut self, phrase: Value, source: Source, update_carousel_index: bool) {
        self.clear_rotation_timer();

        let mut phrase = phrase;
        let id = phrase["id"].clone();

        match source {
            Source::System if update_carousel_index => {
                let idx = self.enabled_system_phrases().iter().position(|p| p["id"] == id);
                if let Some(idx) = idx {
                    self.rt.queue_index = idx as i64;
                }
            }
            Source::Audience => {
                let item = self.queue().iter_mut().find(|a| a["id"] == id).map(|item| {
                    om(item).insert("status".into(), "showing".into());
                    item.clone()
                });
                if let Some(item) = item {
                    phrase = item;
                    self.save();
                }
            }
            _ => {}
        }

        let default_duration = num_or(self.setting("defaultDurationSeconds"), 10.0);
        let duration_sec = num_or(&phrase["duration"], default_duration).max(2.0);
        let duration_ms = duration_sec * 1000.0;

        om(&mut phrase).insert("source".into(), source.as_str().into());
        self.rt.current_phrase_id = id;
        self.rt.current_phrase = phrase;
        self.rt.phase = "showing";
        self.rt.phase_started_at = now_ms();
        self.rt.phase_duration_ms = duration_ms;

        self.broadcast_state();
        self.schedule_rotation(duration_ms, AfterDelay::ShowComplete);
    }

    /// Marca o recado atual do público como 'played' para nunca repetir sozinho.
    fn mark_current_audience_as_played(&mut self) {
        if self.rt.current_phrase["source"] != "audience" {
            return;
        }
        let id = self.rt.current_phrase["id"].clone();
        let marked = self
            .queue()
            .iter_mut()
            .find(|a| a["id"] == id && a["status"] == "showing")
            .map(|item| {
                let o = om(item);
                o.insert("status".into(), "played".into());
                o.insert("playedAt".into(), iso_now().into());
            })
            .is_some();
        if marked {
            if self.pending_count() == 0 && self.flag("audienceHoldMode") {
                self.set_setting("audienceBatchPlaying", false.into());
            }
            self.save();
        }
    }

    /// Disparado quando o tempo de tela da frase atual chega ao fim.
    fn on_phrase_show_complete(&mut self) {
        self.clear_rotation_timer();
        self.mark_current_audience_as_played();

        if !self.flag("visible") {
            return self.go_idle_and_broadcast();
        }
        if !self.audience_allowed_to_play() && !self.flag("autoRotate") {
            return self.go_idle_and_broadcast();
        }

        let interval_ms = num(self.setting("intervalSeconds")).unwrap_or(0.0).max(0.0) * 1000.0;
        if interval_ms > 0.0 {
            self.rt.current_phrase_id = Value::Null;
            self.rt.current_phrase = Value::Null;
            self.rt.phase = "interval";
            self.rt.phase_started_at = now_ms();
            self.rt.phase_duration_ms = interval_ms;
            self.broadcast_state();
            self.schedule_rotation(interval_ms, AfterDelay::Advance);
        } else {
            self.advance_next_in_priority();
        }
    }

    /// Seleciona a próxima frase: 1º Fila do Público (se liberada) -> 2º Carrossel do Sistema.
    fn advance_next_in_priority(&mut self) {
        self.clear_rotation_timer();

        if !self.flag("visible") {
            return self.go_idle_and_broadcast();
        }

        if self.audience_allowed_to_play() {
            if let Some(next) = self.pending_audience().into_iter().next() {
                return self.show_phrase_now(next, Source::Audience, false);
            }
        }

        if self.pending_count() == 0 && self.flag("audienceBatchPlaying") {
            self.set_setting("audienceBatchPlaying", false.into());
            self.save();
        }

        if !self.flag("autoRotate") {
            return self.go_idle_and_broadcast();
        }

        let enabled = self.enabled_system_phrases();
        if enabled.is_empty() {
            return self.go_idle_and_broadcast();
        }

        self.rt.queue_index = (self.rt.queue_index + 1).rem_euclid(enabled.len() as i64);
        let next = enabled[self.rt.queue_index as usize].clone();
        self.show_phrase_now(next, Source::System, false);
    }

    /// Interrompe o carrossel do sistema quando a fila do público é liberada.
    fn interrupt_carousel_for_audience(&mut self) {
        if !self.flag("visible") || !self.audience_allowed_to_play() || self.showing(Source::Audience) {
            return self.broadcast_state();
        }
        if self.showing(Source::System) {
            self.rt.queue_index = (self.rt.queue_index - 1).max(-1);
        }
        self.advance_next_in_priority();
    }

    pub fn sync_engine_with_settings(&mut self, force_restart: bool) {
        for item in self.queue().iter_mut() {
            if item["status"] == "showing" {
                om(item).insert("status".into(), "pending".into());
            }
        }

        if !self.flag("visible") {
            self.clear_rotation_timer();
            return self.go_idle_and_broadcast();
        }

        if force_restart || self.rt.phase == "idle" {
            self.advance_next_in_priority();
        } else {
            self.broadcast_state();
        }
    }

    /// Alterna a visibilidade do overlay (usado pela bandeja do sistema).
    pub fn toggle_overlay_visibility(&mut self) -> bool {
        let visible = !self.flag("visible");
        self.set_setting("visible", visible.into());
        self.save();
        if visible {
            self.advance_next_in_priority();
        } else {
            self.hide_overlay();
        }
        self.broadcast_state();
        self.notify_settings_changed();
        visible
    }

    fn hide_overlay(&mut self) {
        self.mark_current_audience_as_played();
        self.clear_rotation_timer();
        self.set_idle();
    }

    fn ensure_visible(&mut self) {
        if !self.flag("visible") {
            self.set_setting("visible", true.into());
            self.save();
        }
    }

    /// Após trocar a lista de frases ativa: reinicia o carrossel se fizer sentido.
    fn restart_carousel_or_broadcast(&mut self, also_when_idle: bool) {
        let should_restart = self.flag("visible")
            && self.flag("autoRotate")
            && (self.showing(Source::System) || (also_when_idle && self.rt.phase == "idle"));
        if should_restart {
            self.advance_next_in_priority();
        } else {
            self.broadcast_state();
        }
    }

    // ------------------------------------------------------------------
    // Placar: cronômetro sincronizado pelo servidor (chamado a cada 1s)
    // ------------------------------------------------------------------

    pub fn tick_scoreboard(&mut self) {
        if !truthy(&self.state["scoreboard"]["timer"]["running"]) {
            return;
        }
        let now = now_ms();
        let timer = self.timer();
        if !truthy(timer.get("startedAtMs").unwrap_or(&Value::Null)) {
            let seconds = num_or(timer.get("seconds").unwrap_or(&Value::Null), 0.0);
            timer.insert("startedAtMs".into(), now.into());
            timer.insert("baseSeconds".into(), jnum(seconds));
        }
        let started = num_or(timer.get("startedAtMs").unwrap_or(&Value::Null), now as f64);
        let base = num_or(timer.get("baseSeconds").unwrap_or(&Value::Null), 0.0);
        let elapsed = ((now as f64 - started) / 1000.0).floor();

        let mut expired_now = false;
        if timer.get("direction").is_some_and(|d| d == "down") {
            let next = (base - elapsed).max(0.0);
            timer.insert("seconds".into(), jnum(next));
            if next == 0.0 {
                timer.insert("running".into(), false.into());
                timer.insert("startedAtMs".into(), Value::Null);
                timer.insert("isExpired".into(), true.into());
                expired_now = true;
            }
        } else {
            timer.insert("seconds".into(), jnum(base + elapsed));
        }

        let tick = json!({
            "seconds": timer.get("seconds"),
            "running": timer.get("running"),
            "isExpired": truthy(timer.get("isExpired").unwrap_or(&Value::Null)),
        });
        if expired_now {
            self.emit("scoreboard:timeExpired", Value::Null);
        }
        self.emit("scoreboard:tick", tick);
    }

    fn schedule_celebration_clear(&self, timestamp: i64, delay_ms: u64) {
        self.after(delay_ms, move |core| {
            if core.state["scoreboard"]["celebration"]["timestamp"] == timestamp {
                om(core.scoreboard()).insert("celebration".into(), Value::Null);
                core.broadcast_scoreboard();
            }
        });
    }

    // ------------------------------------------------------------------
    // Segurança por PIN
    // ------------------------------------------------------------------

    fn is_ip_locked(&mut self, ip: &str) -> bool {
        match self.pin_attempts.get(ip) {
            Some(&(_, locked_until)) if locked_until > 0 => {
                if now_ms() < locked_until {
                    true
                } else {
                    self.pin_attempts.remove(ip);
                    false
                }
            }
            _ => false,
        }
    }

    fn record_failed_pin(&mut self, ip: &str) -> u32 {
        let entry = self.pin_attempts.entry(ip.to_string()).or_insert((0, 0));
        entry.0 += 1;
        if entry.0 >= MAX_PIN_ATTEMPTS {
            entry.1 = now_ms() + PIN_LOCKOUT_MS;
        }
        entry.0
    }

    fn is_authorized(&self, client: &Client) -> bool {
        client.is_local || client.token.as_ref().is_some_and(|t| self.tokens.contains(t))
    }

    // ------------------------------------------------------------------
    // Eventos Socket.IO
    // ------------------------------------------------------------------

    /// Trata um evento vindo de um cliente. Devolve as respostas destinadas
    /// apenas ao socket de origem; difusões gerais saem pelo `Outbox`.
    pub fn handle(&mut self, client: &Client, event: &str, p: &Value) -> Replies {
        let mut replies = Replies::new();
        match event {
            // --- Segurança e Autenticação PIN ---
            "auth:verify-pin" => self.auth_verify_pin(client, p, &mut replies),
            "auth:set-pin" => {
                if !self.is_authorized(client) {
                    replies.push(("auth:error", json!({ "message": "Ação não autorizada. Apenas o Host Principal pode alterar o PIN." })));
                    return replies;
                }
                let pin = text(&p["pin"], usize::MAX);
                let enable = p.get("enablePin");
                if !pin.is_empty() {
                    let hash = hash_pin(&pin);
                    let enabled = enable.map_or(true, truthy);
                    let sec = self.security_mut();
                    sec.insert("pinHash".into(), hash.into());
                    sec.insert("pinEnabled".into(), enabled.into());
                } else if enable == Some(&Value::Bool(false)) {
                    self.security_mut().insert("pinEnabled".into(), false.into());
                }
                self.security_mut().insert("pinConfigured".into(), true.into());
                self.save();
                self.broadcast_state();
                replies.push(("auth:configured", json!({ "pinEnabled": self.pin_enabled() })));
            }
            "auth:disable-pin" => {
                if !self.is_authorized(client) {
                    replies.push(("auth:error", json!({ "message": "Ação não autorizada. Apenas o Host Principal pode desativar o PIN." })));
                    return replies;
                }
                let sec = self.security_mut();
                sec.insert("pinEnabled".into(), false.into());
                sec.insert("pinConfigured".into(), true.into());
                self.save();
                self.broadcast_state();
                replies.push(("auth:configured", json!({ "pinEnabled": false })));
            }
            "auth:skip-onboarding" => {
                if client.is_local {
                    let sec = self.security_mut();
                    sec.insert("pinConfigured".into(), true.into());
                    sec.insert("pinEnabled".into(), false.into());
                    self.save();
                    self.broadcast_state();
                }
            }

            // --- Configurações ---
            "settings:update" => self.settings_update(p),
            "settings:resetDefaults" => {
                let resets = json!({
                    "theme": "christmas",
                    "fontSizePercent": 100,
                    "overlayScalePercent": 100,
                    "cardMaxWidthPx": 1020,
                    "resolutionWidth": 1920,
                    "resolutionHeight": 1080,
                    "position": "bottom-left",
                    "animationStyle": "slide-up",
                    "intervalSeconds": 4,
                    "defaultDurationSeconds": 10,
                    "showProgress": true,
                    "showKicker": true,
                    "displayMode": "card",
                    "tickerSpeedSeconds": 32,
                    "logoPosition": "left",
                    "logoSizePx": 56,
                    "compactLists": false
                });
                let merged_settings = merged(&self.state["settings"], &resets);
                om(&mut self.state).insert("settings".into(), merged_settings);
                self.save();
                self.broadcast_state();
                self.notify_settings_changed();
            }

            // --- Fila do Público / Ouvintes ---
            "audience:add" => {
                let Some(mut item) = self.new_phrase_from(p, "aud-") else { return replies };
                let o = om(&mut item);
                o.insert("status".into(), "pending".into());
                o.insert("createdAt".into(), iso_now().into());
                self.queue().push(item.clone());
                self.save();

                if truthy(&p["showImmediately"]) {
                    self.mark_current_audience_as_played();
                    self.set_setting("visible", true.into());
                    self.save();
                    self.show_phrase_now(item, Source::Audience, false);
                } else {
                    self.interrupt_carousel_for_audience();
                }
            }
            "audience:update" => {
                let id = p["id"].clone();
                let Some(item) = self.queue().iter_mut().find(|a| a["id"] == id) else { return replies };
                apply_phrase_edit(item, p, false);
                let updated = item.clone();
                self.save();
                if self.rt.current_phrase_id == updated["id"] {
                    self.rt.current_phrase = with_source(updated, Source::Audience);
                }
                self.broadcast_state();
            }
            "audience:move" => {
                if move_item(self.queue(), &p["id"], &p["direction"]) {
                    self.save();
                    self.broadcast_state();
                }
            }
            "audience:trigger" => {
                let Some(item) = self.queue().iter().find(|a| a["id"] == *p).cloned() else { return replies };
                self.mark_current_audience_as_played();
                self.set_setting("visible", true.into());
                self.save();
                self.show_phrase_now(item, Source::Audience, false);
            }
            "audience:requeue" => {
                let Some(item) = self.queue().iter_mut().find(|a| a["id"] == *p) else { return replies };
                om(item).insert("status".into(), "pending".into());
                self.save();
                self.interrupt_carousel_for_audience();
            }
            "audience:delete" => {
                let was_showing = !p.is_null() && self.rt.current_phrase_id == *p;
                self.queue().retain(|a| a["id"] != *p);
                self.save();
                if was_showing {
                    self.on_phrase_show_complete();
                } else {
                    self.broadcast_state();
                }
            }
            "audience:clearPlayed" => {
                self.queue().retain(|a| a["status"] != "played");
                self.save();
                self.broadcast_state();
            }
            "audience:startBatch" => {
                if self.pending_count() == 0 {
                    return replies;
                }
                self.set_setting("audienceBatchPlaying", true.into());
                self.set_setting("visible", true.into());
                self.save();
                self.interrupt_carousel_for_audience();
            }
            "audience:pauseBatch" => {
                self.set_setting("audienceBatchPlaying", false.into());
                self.save();
                if self.showing(Source::Audience) {
                    let id = self.rt.current_phrase["id"].clone();
                    if let Some(item) = self
                        .queue()
                        .iter_mut()
                        .find(|a| a["id"] == id && a["status"] == "showing")
                    {
                        om(item).insert("status".into(), "pending".into());
                        self.save();
                    }
                    self.advance_next_in_priority();
                } else {
                    self.broadcast_state();
                }
            }

            // --- Carrossel do Sistema ---
            "phrase:add" => {
                let Some(mut phrase) = self.new_phrase_from(p, "p-") else { return replies };
                let enabled = p.get("enabled").map_or(true, truthy);
                om(&mut phrase).insert("enabled".into(), enabled.into());
                self.phrases().push(phrase.clone());
                self.save();

                if truthy(&p["showImmediately"]) {
                    self.mark_current_audience_as_played();
                    self.set_setting("visible", true.into());
                    self.save();
                    self.show_phrase_now(phrase, Source::System, true);
                } else if self.flag("visible") && self.flag("autoRotate") && self.rt.phase == "idle" {
                    self.advance_next_in_priority();
                } else {
                    self.broadcast_state();
                }
            }
            "phrase:update" => {
                let id = p["id"].clone();
                let Some(item) = self.phrases().iter_mut().find(|a| a["id"] == id) else { return replies };
                apply_phrase_edit(item, p, true);
                let updated = item.clone();
                self.save();

                if self.rt.current_phrase_id == updated["id"] {
                    if !truthy(&updated["enabled"]) && self.flag("autoRotate") {
                        self.on_phrase_show_complete();
                        return replies;
                    }
                    self.rt.current_phrase = with_source(updated, Source::System);
                }

                if self.flag("visible")
                    && self.flag("autoRotate")
                    && self.rt.phase == "idle"
                    && !self.enabled_system_phrases().is_empty()
                {
                    self.advance_next_in_priority();
                } else {
                    self.broadcast_state();
                }
            }
            "phrase:bulkToggle" => {
                let target = truthy(&p["enabled"]);
                for phrase in self.phrases().iter_mut() {
                    if let Some(o) = phrase.as_object_mut() {
                        o.insert("enabled".into(), target.into());
                    }
                }
                self.save();

                if !target && self.showing(Source::System) && self.flag("autoRotate") {
                    self.on_phrase_show_complete();
                } else if target && self.flag("visible") && self.flag("autoRotate") && self.rt.phase == "idle" {
                    self.advance_next_in_priority();
                } else {
                    self.broadcast_state();
                }
            }
            "phrase:delete" => {
                let was_showing = !p.is_null() && self.rt.current_phrase_id == *p;
                self.phrases().retain(|a| a["id"] != *p);
                self.save();
                if was_showing {
                    self.on_phrase_show_complete();
                } else {
                    self.broadcast_state();
                }
            }
            "phrase:trigger" => {
                let Some(phrase) = self.phrases().iter().find(|a| a["id"] == *p).cloned() else { return replies };
                self.mark_current_audience_as_played();
                self.ensure_visible();
                self.show_phrase_now(phrase, Source::System, true);
            }
            "phrase:move" => {
                if move_item(self.phrases(), &p["id"], &p["direction"]) {
                    self.save();
                    self.broadcast_state();
                }
            }
            "rotation:next" => {
                self.mark_current_audience_as_played();
                self.ensure_visible();
                self.advance_next_in_priority();
            }
            "rotation:clearCurrent" => self.on_phrase_show_complete(),

            // --- Múltiplas Playlists (Eventos) & Backup JSON ---
            "playlist:select" => {
                self.sync_active_playlist();
                let Some(target) = self.playlists().iter().find(|pl| pl["id"] == *p).cloned() else { return replies };
                self.activate_playlist(&target);
                self.save();
                self.restart_carousel_or_broadcast(true);
            }
            "playlist:create" => {
                let name = text(&p["name"], usize::MAX);
                if name.is_empty() {
                    return replies;
                }
                self.sync_active_playlist();
                let playlist = json!({
                    "id": format!("pl-{}-{}", now_ms(), rand36(3)),
                    "name": name,
                    "phrases": [],
                });
                self.playlists().push(playlist.clone());
                self.activate_playlist(&playlist);
                self.save();
                self.restart_carousel_or_broadcast(false);
            }
            "playlist:rename" => {
                let name = text(&p["name"], usize::MAX);
                if name.is_empty() {
                    return replies;
                }
                let id = p["id"].clone();
                let Some(target) = self.playlists().iter_mut().find(|pl| pl["id"] == id) else { return replies };
                om(target).insert("name".into(), name.into());
                self.save();
                self.broadcast_state();
            }
            "playlist:delete" => {
                self.sync_active_playlist();
                if self.playlists().len() <= 1 {
                    return replies;
                }
                let Some(idx) = self.playlists().iter().position(|pl| pl["id"] == *p) else { return replies };
                self.playlists().remove(idx);
                if self.state["activePlaylistId"] == *p {
                    let fallback = self.playlists()[0].clone();
                    self.activate_playlist(&fallback);
                }
                self.save();
                self.restart_carousel_or_broadcast(true);
            }
            "state:import" => self.import_state(p),

            // --- Tarja de Identificação Rápida (Lower Third) ---
            "lowerThird:show" => {
                let title = text(&p["title"], 80);
                if title.is_empty() {
                    return replies;
                }
                let auto_hide = p
                    .get("autoHideSeconds")
                    .and_then(num)
                    .unwrap_or(0.0)
                    .max(0.0);
                self.lower_third_gen += 1;
                let gen = self.lower_third_gen;

                om(&mut self.state).insert(
                    "lowerThird".into(),
                    json!({
                        "active": true,
                        "badge": text(&p["badge"], 50),
                        "title": title,
                        "subtitle": text(&p["subtitle"], 100),
                        "autoHideSeconds": jnum(auto_hide),
                    }),
                );
                self.save();
                self.broadcast_state();

                if auto_hide > 0.0 {
                    self.after((auto_hide * 1000.0) as u64, move |core| {
                        if core.lower_third_gen == gen {
                            core.hide_lower_third();
                        }
                    });
                }
            }
            "lowerThird:hide" => {
                self.lower_third_gen += 1;
                self.hide_lower_third();
            }

            // --- Placar Esportivo (Futebol, Vôlei, Basquete, Futsal) ---
            "scoreboard:update" => {
                if !p.is_object() {
                    return replies;
                }
                let current = self.scoreboard_json();
                let mut next = merged(&current, p);
                for key in ["teamA", "teamB", "timer"] {
                    om(&mut next).insert(key.into(), merged(&current[key], &p[key]));
                }
                om(&mut self.state).insert("scoreboard".into(), next);
                self.save();
                self.broadcast_scoreboard();
            }
            "scoreboard:toggle-visible" => {
                let visible = !truthy(&self.state["scoreboard"]["visible"]);
                om(self.scoreboard()).insert("visible".into(), visible.into());
                self.save();
                self.broadcast_scoreboard();
            }
            "scoreboard:score-change" => {
                let Some(team) = p["team"].as_str().filter(|t| matches!(*t, "teamA" | "teamB")) else { return replies };
                let delta = num(&p["delta"]).unwrap_or(0.0);
                let current = num_or(&self.state["scoreboard"][team]["score"], 0.0);
                self.team(team).insert("score".into(), jnum((current + delta).max(0.0)));

                if delta > 0.0 && truthy(&p["triggerCelebration"]) {
                    let label = match self.state["scoreboard"]["sport"].as_str() {
                        Some("volleyball") => "PONTO!",
                        Some("basketball") => "CESTA!",
                        _ => "GOL!",
                    };
                    let timestamp = now_ms();
                    let celebration = json!({
                        "type": "score",
                        "team": team,
                        "teamName": self.state["scoreboard"][team]["name"],
                        "text": label,
                        "timestamp": timestamp,
                    });
                    om(self.scoreboard()).insert("celebration".into(), celebration);
                    self.schedule_celebration_clear(timestamp, 5500);
                }
                self.save();
                self.broadcast_scoreboard();
            }
            "scoreboard:timer-control" => {
                let now = now_ms();
                let timer = self.timer();
                let seconds_now = num_or(timer.get("seconds").unwrap_or(&Value::Null), 0.0);
                match p["action"].as_str() {
                    Some("start") => {
                        timer.insert("running".into(), true.into());
                        timer.insert("startedAtMs".into(), now.into());
                        timer.insert("baseSeconds".into(), jnum(seconds_now));
                    }
                    Some("pause") => {
                        timer.insert("running".into(), false.into());
                        timer.insert("startedAtMs".into(), Value::Null);
                        timer.insert("baseSeconds".into(), jnum(seconds_now));
                    }
                    Some("reset") => {
                        timer.insert("running".into(), false.into());
                        timer.insert("seconds".into(), 0.into());
                        timer.insert("extraMinutes".into(), 0.into());
                        timer.insert("startedAtMs".into(), Value::Null);
                        timer.insert("baseSeconds".into(), 0.into());
                    }
                    Some("set") => {
                        if let Some(seconds) = p["seconds"].as_f64() {
                            let seconds = jnum(seconds.max(0.0));
                            timer.insert("seconds".into(), seconds.clone());
                            timer.insert("baseSeconds".into(), seconds);
                            if truthy(timer.get("running").unwrap_or(&Value::Null)) {
                                timer.insert("startedAtMs".into(), now.into());
                            }
                        }
                        if let Some(extra) = p["extraMinutes"].as_f64() {
                            timer.insert("extraMinutes".into(), jnum(extra.max(0.0)));
                        }
                        if truthy(&p["direction"]) {
                            timer.insert("direction".into(), p["direction"].clone());
                        }
                    }
                    _ => {}
                }
                let tick = json!({ "seconds": timer.get("seconds"), "running": timer.get("running") });
                self.save();
                self.broadcast_scoreboard();
                self.emit("scoreboard:tick", tick);
            }
            "scoreboard:set-direction" => {
                let timer = self.timer();
                let down = p["direction"] == "down";
                timer.insert("direction".into(), if down { "down" } else { "up" }.into());
                if let Some(minutes) = p["initialMinutes"].as_f64() {
                    let minutes = minutes.max(1.0);
                    timer.insert("initialMinutes".into(), jnum(minutes));
                    if down && !truthy(timer.get("running").unwrap_or(&Value::Null)) {
                        let seconds = jnum(minutes * 60.0);
                        timer.insert("seconds".into(), seconds.clone());
                        timer.insert("baseSeconds".into(), seconds);
                    }
                }
                timer.insert("isExpired".into(), false.into());
                self.save();
                self.broadcast_scoreboard();
            }
            "scoreboard:set-extra-time" => {
                let extra = text(&p["extraTime"], usize::MAX);
                om(self.scoreboard()).insert("extraTime".into(), extra.into());
                self.save();
                self.broadcast_scoreboard();
            }
            "scoreboard:adjust-points" => self.adjust_team_stat(p, "score"),
            "scoreboard:adjust-fouls" => self.adjust_team_stat(p, "fouls"),
            "scoreboard:adjust-sets" => self.adjust_team_stat(p, "setsWon"),
            "scoreboard:switch-sides" => {
                let sb = om(self.scoreboard());
                let team_a = sb.get("teamA").cloned().unwrap_or(Value::Null);
                let team_b = sb.get("teamB").cloned().unwrap_or(Value::Null);
                sb.insert("teamA".into(), team_b);
                sb.insert("teamB".into(), team_a);
                let serving = match sb.get("servingTeam").and_then(Value::as_str) {
                    Some("teamA") => Some("teamB"),
                    Some("teamB") => Some("teamA"),
                    _ => None,
                };
                if let Some(serving) = serving {
                    sb.insert("servingTeam".into(), serving.into());
                }
                self.save();
                self.broadcast_scoreboard();
            }
            "scoreboard:trigger-celebration" => {
                let timestamp = now_ms();
                let pick = |v: &Value, default: &str| if truthy(v) { v.clone() } else { default.into() };
                let celebration = json!({
                    "type": pick(&p["type"], "custom"),
                    "text": pick(&p["text"], "GOL!"),
                    "subtext": pick(&p["subtext"], ""),
                    "timestamp": timestamp,
                });
                om(self.scoreboard()).insert("celebration".into(), celebration);
                self.save();
                self.broadcast_scoreboard();
                self.schedule_celebration_clear(timestamp, 6000);
            }
            "scoreboard:reset-match" => {
                for team in ["teamA", "teamB"] {
                    let t = self.team(team);
                    for stat in ["score", "yellowCards", "redCards", "fouls", "setsWon"] {
                        t.insert(stat.into(), 0.into());
                    }
                    t.insert("setHistory".into(), json!([]));
                }
                let timer = self.timer();
                timer.insert("seconds".into(), 0.into());
                timer.insert("running".into(), false.into());
                timer.insert("extraMinutes".into(), 0.into());
                let sb = om(self.scoreboard());
                sb.insert("period".into(), "1T".into());
                sb.insert("periodLabel".into(), "1º Tempo".into());
                sb.insert("currentSet".into(), 1.into());
                sb.insert("celebration".into(), Value::Null);
                self.save();
                self.broadcast_scoreboard();
            }
            _ => {}
        }
        replies
    }

    fn auth_verify_pin(&mut self, client: &Client, p: &Value, replies: &mut Replies) {
        if client.is_local {
            replies.push(("auth:success", json!({ "isLocalHost": true, "token": "local-host-token" })));
            return;
        }
        if !self.pin_enabled() {
            replies.push(("auth:success", json!({ "isLocalHost": false, "token": "open-access-token" })));
            return;
        }
        if self.is_ip_locked(&client.ip) {
            replies.push(("auth:error", json!({
                "message": "Muitas tentativas incorretas. Aguarde 5 minutos antes de tentar novamente."
            })));
            return;
        }

        let provided = hash_pin(&text(&p["pin"], usize::MAX));
        let expected = self.state["settings"]["security"]["pinHash"].as_str().unwrap_or("");

        if !expected.is_empty() && provided == expected {
            self.pin_attempts.remove(&client.ip);
            let token = hex(&rand::random::<[u8; 24]>());
            self.tokens.insert(token.clone());
            replies.push(("auth:success", json!({ "token": token, "isLocalHost": false })));
        } else {
            let attempts = self.record_failed_pin(&client.ip);
            let remaining = MAX_PIN_ATTEMPTS.saturating_sub(attempts);
            let message = if remaining == 0 {
                "PIN incorreto. Limite de tentativas atingido. Bloqueado por 5 minutos.".to_string()
            } else {
                format!("PIN incorreto. Restam {remaining} tentativa(s).")
            };
            replies.push(("auth:error", json!({ "message": message })));
        }
    }

    fn settings_update(&mut self, partial: &Value) {
        if !partial.is_object() {
            return;
        }
        let prev_visible = self.flag("visible");
        let prev_auto_rotate = self.flag("autoRotate");

        let current = self.state["settings"].clone();
        let mut next = merged(&current, partial);
        for key in ["overlayStyle", "security"] {
            let value = if truthy(&partial[key]) {
                merged(&current[key], &partial[key])
            } else {
                current[key].clone()
            };
            om(&mut next).insert(key.into(), value);
        }
        om(&mut self.state).insert("settings".into(), next);
        self.save();
        self.notify_settings_changed();

        let visible = self.flag("visible");
        if !visible {
            self.hide_overlay();
            self.broadcast_state();
        } else if !prev_visible || (!prev_auto_rotate && self.flag("autoRotate") && self.rt.phase == "idle") {
            self.advance_next_in_priority();
        } else {
            self.broadcast_state();
        }
    }

    /// Monta uma nova frase/recado a partir do payload do painel.
    fn new_phrase_from(&self, p: &Value, id_prefix: &str) -> Option<Value> {
        let body = text(&p["text"], 350);
        if body.is_empty() {
            return None;
        }
        let kicker = p.get("kicker").map_or(String::new(), |k| clip(&js_str(k), 40));
        let default_duration = num_or(self.setting("defaultDurationSeconds"), 10.0);
        Some(json!({
            "id": format!("{id_prefix}{}-{}", now_ms(), rand36(4)),
            "text": body,
            "author": text(&p["author"], 60),
            "kicker": kicker,
            "duration": jnum(num_or(&p["duration"], default_duration).max(2.0)),
        }))
    }

    fn activate_playlist(&mut self, playlist: &Value) {
        let phrases = match playlist.get("phrases") {
            Some(Value::Array(a)) => Value::Array(a.clone()),
            _ => json!([]),
        };
        let o = om(&mut self.state);
        o.insert("activePlaylistId".into(), playlist["id"].clone());
        o.insert("phrases".into(), phrases);
        self.rt.queue_index = -1;
    }

    fn import_state(&mut self, imported: &Value) {
        if !imported.is_object() {
            return;
        }

        if imported["settings"].is_object() {
            let base = merged(&state::DEFAULT["settings"], &self.state["settings"]);
            let next = merged(&base, &imported["settings"]);
            om(&mut self.state).insert("settings".into(), next);
        }

        match imported["playlists"].as_array() {
            Some(playlists) if !playlists.is_empty() => {
                let o = om(&mut self.state);
                o.insert("playlists".into(), imported["playlists"].clone());
                if truthy(&imported["activePlaylistId"]) {
                    o.insert("activePlaylistId".into(), imported["activePlaylistId"].clone());
                }
            }
            _ => {
                if imported["phrases"].is_array() {
                    om(&mut self.state).insert("phrases".into(), imported["phrases"].clone());
                    self.sync_active_playlist();
                }
            }
        }

        if imported["audienceQueue"].is_array() {
            om(&mut self.state).insert("audienceQueue".into(), imported["audienceQueue"].clone());
        }

        if imported["scoreboard"].is_object() {
            let scoreboard = state::hydrate_scoreboard(&imported["scoreboard"]);
            om(&mut self.state).insert("scoreboard".into(), scoreboard);
            self.broadcast_scoreboard();
        }

        state::finalize(&mut self.state);
        self.rt.queue_index = -1;
        // `finalize` já redefiniu `phrases` a partir da playlist ativa; grava sem reespelhar.
        self.save_signal.notify_one();
        self.notify_settings_changed();
        self.sync_engine_with_settings(true);
    }

    fn hide_lower_third(&mut self) {
        om(field(&mut self.state, "lowerThird")).insert("active".into(), false.into());
        self.save();
        self.broadcast_state();
    }

    fn adjust_team_stat(&mut self, p: &Value, stat: &str) {
        let team = if p["team"] == "teamB" { "teamB" } else { "teamA" };
        let amount = num(&p["amount"]).unwrap_or(0.0);
        let current = num_or(&self.state["scoreboard"][team][stat], 0.0);
        self.team(team).insert(stat.into(), jnum((current + amount).max(0.0)));
        self.save();
        self.broadcast_scoreboard();
    }
}

/// SHA-256 do PIN (mesmo formato de `pinHash` da versão Node).
pub fn hash_pin(pin: &str) -> String {
    hex(&Sha256::digest(pin.trim().as_bytes()))
}

fn with_source(mut phrase: Value, source: Source) -> Value {
    om(&mut phrase).insert("source".into(), source.as_str().into());
    phrase
}

/// Aplica a edição parcial de uma frase/recado (somente os campos presentes no payload).
fn apply_phrase_edit(item: &mut Value, p: &Value, with_enabled: bool) {
    let o = om(item);
    for (key, max) in [("text", 350), ("author", 60), ("kicker", 40)] {
        if let Some(v) = p.get(key) {
            o.insert(key.into(), clip(&js_str(v), max).into());
        }
    }
    o.entry("kicker").or_insert_with(|| "".into());
    if let Some(v) = p.get("duration") {
        o.insert("duration".into(), jnum(num_or(v, 10.0).max(2.0)));
    }
    if with_enabled {
        if let Some(v) = p.get("enabled") {
            o.insert("enabled".into(), truthy(v).into());
        }
    }
}

/// Move um item uma posição para cima ou para baixo. Devolve `true` se houve troca.
fn move_item(list: &mut [Value], id: &Value, direction: &Value) -> bool {
    let Some(idx) = list.iter().position(|a| a["id"] == *id) else { return false };
    let target = if direction == "up" { idx.checked_sub(1) } else { Some(idx + 1) };
    match target {
        Some(target) if target < list.len() => {
            list.swap(idx, target);
            true
        }
        _ => false,
    }
}
