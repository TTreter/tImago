//! Pequenos utilitários que reproduzem a semântica frouxa do JavaScript
//! (truthiness, Number(), String()) sobre `serde_json::Value`.
//!
//! O estado do tImago é um documento JSON de formato livre: o painel envia
//! atualizações parciais e backups antigos podem trazer chaves extras. Manter
//! o estado como `Value` garante compatibilidade total com o `state.json`
//! gerado pela versão Node/Electron.

use serde_json::{Map, Value};

pub fn truthy(v: &Value) -> bool {
    match v {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().is_some_and(|f| f != 0.0 && !f.is_nan()),
        Value::String(s) => !s.is_empty(),
        _ => true,
    }
}

/// `Number(v)` — `None` representa NaN.
pub fn num(v: &Value) -> Option<f64> {
    let n = match v {
        Value::Number(n) => n.as_f64()?,
        Value::String(s) => {
            let t = s.trim();
            if t.is_empty() {
                0.0
            } else {
                t.parse::<f64>().ok()?
            }
        }
        Value::Bool(b) => f64::from(u8::from(*b)),
        Value::Null => 0.0,
        _ => return None,
    };
    (!n.is_nan()).then_some(n)
}

/// `Number(v) || default`
pub fn num_or(v: &Value, default: f64) -> f64 {
    match num(v) {
        Some(n) if n != 0.0 => n,
        _ => default,
    }
}

/// Converte f64 em número JSON, preferindo inteiros quando o valor é exato.
pub fn jnum(f: f64) -> Value {
    if f.is_finite() && f.fract() == 0.0 && f.abs() < 9.0e15 {
        Value::from(f as i64)
    } else {
        serde_json::Number::from_f64(f).map_or(Value::Null, Value::Number)
    }
}

/// `String(v)`
pub fn js_str(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => "null".into(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        other => other.to_string(),
    }
}

/// `String(v || '').trim().slice(0, max)`
pub fn text(v: &Value, max: usize) -> String {
    if truthy(v) {
        clip(&js_str(v), max)
    } else {
        String::new()
    }
}

/// `String(v).trim().slice(0, max)`
pub fn clip(s: &str, max: usize) -> String {
    s.trim().chars().take(max).collect()
}

/// Garante que `v` seja um objeto e devolve acesso mutável a ele.
pub fn om(v: &mut Value) -> &mut Map<String, Value> {
    if !v.is_object() {
        *v = Value::Object(Map::new());
    }
    v.as_object_mut().expect("objeto")
}

/// Garante que `v` seja um array e devolve acesso mutável a ele.
pub fn am(v: &mut Value) -> &mut Vec<Value> {
    if !v.is_array() {
        *v = Value::Array(Vec::new());
    }
    v.as_array_mut().expect("array")
}

/// Acesso mutável a `v[key]`, criando o objeto/chave se necessário.
pub fn field<'a>(v: &'a mut Value, key: &str) -> &'a mut Value {
    om(v).entry(key.to_string()).or_insert(Value::Null)
}

/// `{ ...base, ...over }` (mescla rasa; `over` é ignorado se não for objeto)
pub fn merged(base: &Value, over: &Value) -> Value {
    let mut out = base.as_object().cloned().unwrap_or_default();
    if let Some(o) = over.as_object() {
        for (k, v) in o {
            out.insert(k.clone(), v.clone());
        }
    }
    Value::Object(out)
}

pub fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

pub fn iso_now() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

/// Sufixo aleatório em base 36 (equivalente a `Math.random().toString(36).substring(2, 2 + len)`).
pub fn rand36(len: usize) -> String {
    const DIGITS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    (0..len)
        .map(|_| DIGITS[(rand::random::<u32>() % 36) as usize] as char)
        .collect()
}

pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}
