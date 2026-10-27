/**
 * ============================================================================
 * tImago — Broadcast Overlay Controller for OBS Studio
 * Arquivo: mdns-service.js (Resolução de Domínio Local mDNS Zeroconf)
 * ============================================================================
 * Permite que dispositivos na rede Wi-Fi / LAN acessem o servidor via:
 * http://timago.local:3000 (ou http://timago.local)
 * Suportado nativamente em iOS, iPadOS, macOS, Android 12+ e Windows 10/11.
 * ============================================================================
 */

const multicastDns = require('multicast-dns');

let mdnsInstance = null;
let broadcastInterval = null;

/**
 * Inicia o serviço mDNS para responder por timago.local
 * @param {string} hostname Nome base (padrão: 'timago')
 * @param {Function} getLocalIpsFn Função que retorna array de IPs IPv4 locais
 */
function startMdns(hostname = 'timago', getLocalIpsFn) {
  if (mdnsInstance) return;

  const targetName = `${hostname.toLowerCase()}.local`;
  const plainName = hostname.toLowerCase();

  try {
    mdnsInstance = multicastDns();

    mdnsInstance.on('error', (err) => {
      console.warn('[mDNS] Aviso no socket multicast:', err.message);
    });

    mdnsInstance.on('query', (query) => {
      if (!query || !Array.isArray(query.questions)) return;

      const ips = typeof getLocalIpsFn === 'function' ? getLocalIpsFn() : [];
      if (!ips.length) return;
      const primaryIp = ips[0];

      for (const question of query.questions) {
        const qName = (question.name || '').toLowerCase();
        if ((qName === targetName || qName === plainName) && (question.type === 'A' || question.type === 'ANY')) {
          try {
            mdnsInstance.respond({
              answers: [
                {
                  name: qName,
                  type: 'A',
                  ttl: 120,
                  data: primaryIp
                }
              ]
            });
          } catch (e) {
            // Ignora erro de envio pontual
          }
        }
      }
    });

    console.log(`[mDNS] Anunciando serviço na rede local: http://${targetName}:3000`);
  } catch (err) {
    console.warn('[mDNS] Não foi possível vincular porta 5353 (mDNS). O acesso continuará funcionando via IP:', err.message);
  }
}

/**
 * Encerra o serviço mDNS
 */
function stopMdns() {
  if (broadcastInterval) {
    clearInterval(broadcastInterval);
    broadcastInterval = null;
  }
  if (mdnsInstance) {
    try {
      mdnsInstance.destroy();
    } catch (e) {}
    mdnsInstance = null;
  }
}

module.exports = {
  startMdns,
  stopMdns
};
