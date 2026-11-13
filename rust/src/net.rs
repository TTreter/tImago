//! Descoberta de IPs locais, detecção de Host Local e anúncio mDNS (`timago.local`).

use network_interface::{Addr, NetworkInterface, NetworkInterfaceConfig};
use parking_lot::Mutex;
use std::net::{IpAddr, Ipv4Addr};
use std::time::{Duration, Instant};

struct Candidate {
    ip: Ipv4Addr,
    score: u32,
}

fn candidates() -> Vec<Candidate> {
    let mut out = Vec::new();
    for iface in NetworkInterface::show().unwrap_or_default() {
        if iface.internal {
            continue;
        }
        let name = iface.name.to_lowercase();
        let is_virtual = ["vethernet", "wsl", "virtual", "vmware", "vbox", "vpn", "loopback"]
            .iter()
            .any(|needle| name.contains(needle));
        let has_physical_mac = iface
            .mac_addr
            .as_deref()
            .is_some_and(|mac| !mac.is_empty() && mac != "00:00:00:00:00:00");

        for addr in &iface.addr {
            let Addr::V4(v4) = addr else { continue };
            if v4.ip.is_loopback() {
                continue;
            }
            // Ignora túneis/VPNs sem MAC físico ou com máscara /32
            let is_point_to_point = v4.netmask == Some(Ipv4Addr::BROADCAST);
            let octets = v4.ip.octets();

            let mut score = 0;
            if has_physical_mac && !is_point_to_point && !is_virtual {
                score += 100;
            }
            if octets[0] == 192 && octets[1] == 168 {
                score += 50;
            } else if octets[0] == 10 {
                score += 30;
            }
            if name.contains("wi-fi") || name.contains("wifi") || name.contains("ethernet") {
                score += 20;
            }
            out.push(Candidate { ip: v4.ip, score });
        }
    }
    out
}

/// Todos os IPv4 não-loopback desta máquina.
pub fn all_local_ips() -> Vec<Ipv4Addr> {
    candidates().into_iter().map(|c| c.ip).collect()
}

/// Melhor IP da rede local para exibir no painel/QR Code (cache de 60s).
pub fn local_ip() -> String {
    static CACHE: Mutex<Option<(Instant, String)>> = Mutex::new(None);
    let mut cache = CACHE.lock();
    if let Some((at, ip)) = cache.as_ref() {
        if at.elapsed() < Duration::from_secs(60) {
            return ip.clone();
        }
    }
    let mut list = candidates();
    list.sort_by(|a, b| b.score.cmp(&a.score));
    let ip = list
        .first()
        .map_or_else(|| "localhost".to_string(), |c| c.ip.to_string());
    *cache = Some((Instant::now(), ip.clone()));
    ip
}

/// O cliente está na própria máquina que hospeda o tImago?
pub fn is_local_host(ip: IpAddr) -> bool {
    match ip.to_canonical() {
        ip if ip.is_loopback() => true,
        IpAddr::V4(v4) => all_local_ips().contains(&v4),
        IpAddr::V6(_) => false,
    }
}

/// Anúncio mDNS/Zeroconf: responde por `timago.local` na rede Wi-Fi / LAN.
pub struct Mdns(mdns_sd::ServiceDaemon);

impl Mdns {
    pub fn start(port: u16) -> Option<Mdns> {
        let daemon = mdns_sd::ServiceDaemon::new()
            .map_err(|e| eprintln!("[mDNS] Não foi possível iniciar o mDNS. O acesso continuará funcionando via IP: {e}"))
            .ok()?;
        let info = mdns_sd::ServiceInfo::new(
            "_http._tcp.local.",
            "tImago",
            "timago.local.",
            (),
            port,
            None::<std::collections::HashMap<String, String>>,
        )
        .map_err(|e| eprintln!("[mDNS] Serviço inválido: {e}"))
        .ok()?
        .enable_addr_auto();
        daemon
            .register(info)
            .map_err(|e| eprintln!("[mDNS] Falha ao anunciar timago.local: {e}"))
            .ok()?;
        Some(Mdns(daemon))
    }
}

impl Drop for Mdns {
    fn drop(&mut self) {
        let _ = self.0.shutdown();
    }
}
