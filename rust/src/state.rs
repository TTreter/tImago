//! Carga, saneamento e persistência do `state.json`.

use crate::js::{am, merged, om, truthy};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

/// Estado padrão de fábrica (idêntico ao `defaultState` da versão Node).
pub static DEFAULT: LazyLock<Value> = LazyLock::new(|| {
    serde_json::from_str(include_str!("default_state.json")).expect("default_state.json válido")
});

/// Seed copiado na primeira execução (mesmo arquivo distribuído com a versão Electron).
const SEED: &str = include_str!("../../data/state.json");

pub fn state_file(data_dir: &Path) -> PathBuf {
    data_dir.join("state.json")
}

/// Remove emojis de uma string para garantir sobriedade institucional.
pub fn strip_emojis(s: &str) -> String {
    s.chars()
        .filter(|c| {
            !matches!(*c as u32,
                0x1F300..=0x1F9FF
                | 0x2600..=0x26FF
                | 0x2700..=0x27BF
                | 0x1F1E6..=0x1F1FF
                | 0x1FA00..=0x1FAFF
                | 0xFE0F)
        })
        .collect::<String>()
        .trim()
        .to_string()
}

fn strip_in_place(v: &mut Value) {
    if let Value::String(s) = v {
        if !s.is_empty() {
            *s = strip_emojis(s);
        }
    }
}

/// Sanitiza valores textuais do estado removendo emojis legados.
pub fn sanitize_strings(st: &mut Value) {
    if let Some(v) = st.pointer_mut("/settings/defaultKickerText") {
        strip_in_place(v);
    }
    if let Some(v) = st.pointer_mut("/lowerThird/badge") {
        strip_in_place(v);
    }
    if let Some(pls) = st.get_mut("playlists").and_then(Value::as_array_mut) {
        for pl in pls {
            if let Some(name) = pl.get_mut("name") {
                strip_in_place(name);
            }
        }
    }
}

/// Garante que a estrutura de playlists exista e esteja sincronizada com `state.phrases`.
pub fn ensure_playlists(st: &mut Value) {
    let defaults = || (DEFAULT["playlists"].clone(), Value::from("pl-inst"));

    let pls = am(crate::js::field(st, "playlists"));
    // Filtra silenciosamente qualquer resquício legado sem resetar as playlists do usuário
    pls.retain(|p| p["id"] != "pl-worship");
    if pls.is_empty() {
        let (playlists, active) = defaults();
        let o = om(st);
        o.insert("playlists".into(), playlists);
        o.insert("activePlaylistId".into(), active);
    }

    let active_id = st["activePlaylistId"].clone();
    let pls = st["playlists"].as_array().expect("playlists");
    let active = pls
        .iter()
        .find(|p| p["id"] == active_id)
        .unwrap_or(&pls[0]);
    let id = active["id"].clone();
    let phrases = match active.get("phrases") {
        Some(Value::Array(a)) => Value::Array(a.clone()),
        _ => Value::Array(Vec::new()),
    };
    let o = om(st);
    o.insert("activePlaylistId".into(), id);
    o.insert("phrases".into(), phrases);
}

/// Garante os tipos estruturais que o motor assume (objetos e arrays nos lugares certos).
pub fn normalize_shape(st: &mut Value) {
    om(st);
    for key in ["settings", "lowerThird", "scoreboard"] {
        om(crate::js::field(st, key));
    }
    for key in ["phrases", "audienceQueue", "playlists"] {
        am(crate::js::field(st, key));
    }
    let sb = &mut st["scoreboard"];
    for key in ["teamA", "teamB", "timer"] {
        om(crate::js::field(sb, key));
    }
}

fn array_or(v: &Value, fallback: Value) -> Value {
    if v.is_array() {
        v.clone()
    } else {
        fallback
    }
}

/// Mescla um estado lido do disco com os padrões de fábrica.
pub fn hydrate(parsed: &Value) -> Value {
    let d = &*DEFAULT;

    let mut settings = merged(&d["settings"], &parsed["settings"]);
    let security = merged(&d["settings"]["security"], &parsed["settings"]["security"]);
    let overlay_style = merged(&d["settings"]["overlayStyle"], &parsed["settings"]["overlayStyle"]);
    om(&mut settings).insert("security".into(), security);
    om(&mut settings).insert("overlayStyle".into(), overlay_style);

    let mut lower_third = merged(&d["lowerThird"], &parsed["lowerThird"]);
    om(&mut lower_third).insert("active".into(), Value::Bool(false));

    let scoreboard = hydrate_scoreboard(&parsed["scoreboard"]);

    let active_playlist = if truthy(&parsed["activePlaylistId"]) {
        parsed["activePlaylistId"].clone()
    } else {
        Value::from("pl-inst")
    };

    let mut st = serde_json::json!({
        "settings": settings,
        "lowerThird": lower_third,
        "activePlaylistId": active_playlist,
        "playlists": array_or(&parsed["playlists"], Value::Array(Vec::new())),
        "phrases": array_or(&parsed["phrases"], d["phrases"].clone()),
        "audienceQueue": array_or(&parsed["audienceQueue"], Value::Array(Vec::new())),
        "scoreboard": scoreboard,
    });
    finalize(&mut st);
    st
}

/// Mescla um placar (do disco ou de um backup importado) com os padrões.
pub fn hydrate_scoreboard(src: &Value) -> Value {
    let d = &DEFAULT["scoreboard"];
    let mut sb = merged(d, src);
    let team_a = merged(&d["teamA"], &src["teamA"]);
    let team_b = merged(&d["teamB"], &src["teamB"]);
    let mut timer = merged(&d["timer"], &src["timer"]);
    om(&mut timer).insert("running".into(), Value::Bool(false));
    let o = om(&mut sb);
    o.insert("teamA".into(), team_a);
    o.insert("teamB".into(), team_b);
    o.insert("timer".into(), timer);
    o.insert("celebration".into(), Value::Null);
    sb
}

pub fn finalize(st: &mut Value) {
    normalize_shape(st);
    sanitize_strings(st);
    ensure_playlists(st);
}

/// Carrega o estado persistido no disco (ou o seed inicial na primeira execução).
pub fn load(data_dir: &Path) -> Value {
    let file = state_file(data_dir);
    if !file.exists() {
        // Primeira execução: grava o seed para que o usuário já tenha um arquivo editável
        let _ = std::fs::create_dir_all(data_dir);
        let _ = std::fs::write(&file, SEED);
    }

    if let Ok(raw) = std::fs::read_to_string(&file) {
        match serde_json::from_str::<Value>(raw.trim_start_matches('\u{feff}')) {
            Ok(parsed) if parsed.is_object() => return hydrate(&parsed),
            Ok(_) => eprintln!("Erro ao carregar state.json: conteúdo não é um objeto"),
            Err(e) => eprintln!("Erro ao carregar state.json: {e}"),
        }
    }

    let mut st = DEFAULT.clone();
    finalize(&mut st);
    st
}

/// Escrita atômica: grava em arquivo temporário e renomeia por cima do definitivo.
pub fn write_atomic(data_dir: &Path, json: &str) -> std::io::Result<()> {
    std::fs::create_dir_all(data_dir)?;
    let file = state_file(data_dir);
    let tmp = file.with_extension("json.tmp");
    std::fs::write(&tmp, json)?;
    std::fs::rename(&tmp, &file)
}

pub fn to_pretty(st: &Value) -> String {
    serde_json::to_string_pretty(st).unwrap_or_else(|_| "{}".into())
}
