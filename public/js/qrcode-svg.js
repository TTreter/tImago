/* ==========================================================================
   tImago — GERADOR DE QR CODE SVG 100% OFFLINE (ISO/IEC 18004 - Versões 1 a 5, Nível L)
   Permite escanear o IP da rede local pelo celular sem depender de internet externa.
   ========================================================================== */

(function (global) {
  // Tabelas das Versões 1 a 5 (ECC Nível L - Bloco Único)
  const VERSIONS = [
    null,
    { size: 21, dataBytes: 19, ecBytes: 7, align: [] },
    { size: 25, dataBytes: 34, ecBytes: 10, align: [6, 18] },
    { size: 29, dataBytes: 55, ecBytes: 15, align: [6, 22] },
    { size: 33, dataBytes: 80, ecBytes: 20, align: [6, 26] },
    { size: 37, dataBytes: 108, ecBytes: 26, align: [6, 30] }
  ];

  // Campo de Galois GF(256) com polinômio primitivo 0x11d
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) {
      EXP[i] = EXP[i - 255];
    }
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  function rsGeneratorPoly(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      const root = EXP[i];
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], root);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecLen) {
    const gen = rsGeneratorPoly(ecLen);
    const msg = new Uint8Array(data.length + ecLen);
    msg.set(data, 0);
    for (let i = 0; i < data.length; i++) {
      const coef = msg[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) {
          msg[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return msg.slice(data.length);
  }

  function encodeDataBytes(text) {
    const utf8 = new TextEncoder().encode(String(text || ''));
    let ver = 1;
    while (ver <= 5 && utf8.length + 2 > VERSIONS[ver].dataBytes) {
      ver++;
    }
    if (ver > 5) ver = 5;
    const spec = VERSIONS[ver];
    const maxPayload = Math.min(utf8.length, spec.dataBytes - 2);

    const bits = [];
    function pushBits(val, len) {
      for (let i = len - 1; i >= 0; i--) {
        bits.push((val >>> i) & 1);
      }
    }

    // Modo Byte (0100) + Tamanho (8 bits para versões 1-9)
    pushBits(0b0100, 4);
    pushBits(maxPayload, 8);
    for (let i = 0; i < maxPayload; i++) {
      pushBits(utf8[i], 8);
    }

    // Terminador (até 4 zeros)
    const maxBits = spec.dataBytes * 8;
    const term = Math.min(4, maxBits - bits.length);
    pushBits(0, term);
    while (bits.length % 8 !== 0) bits.push(0);

    const data = new Uint8Array(spec.dataBytes);
    for (let i = 0; i < bits.length / 8; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | bits[i * 8 + j];
      }
      data[i] = b;
    }

    // Bytes de preenchimento alternados (0xEC, 0x11)
    let padIdx = bits.length / 8;
    let toggle = true;
    while (padIdx < spec.dataBytes) {
      data[padIdx++] = toggle ? 0xec : 0x11;
      toggle = !toggle;
    }

    const ec = rsEncode(data, spec.ecBytes);
    const full = new Uint8Array(data.length + ec.length);
    full.set(data, 0);
    full.set(ec, data.length);
    return { ver, spec, codewords: full };
  }

  function buildMatrix(text) {
    const { spec, codewords } = encodeDataBytes(text);
    const size = spec.size;
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const isFunc = Array.from({ length: size }, () => new Array(size).fill(false));

    function setFuncModule(r, c, dark) {
      if (r < 0 || r >= size || c < 0 || c >= size) return;
      modules[r][c] = Boolean(dark);
      isFunc[r][c] = true;
    }

    function drawFinder(r, c) {
      for (let dy = -1; dy <= 7; dy++) {
        for (let dx = -1; dx <= 7; dx++) {
          const xx = c + dx;
          const yy = r + dy;
          if (xx < 0 || xx >= size || yy < 0 || yy >= size) continue;
          const inOuter = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 && (dx === 0 || dx === 6 || dy === 0 || dy === 6);
          const inInner = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
          setFuncModule(yy, xx, inOuter || inInner);
        }
      }
    }

    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    // Padrões de Timing
    for (let i = 8; i < size - 8; i++) {
      setFuncModule(6, i, i % 2 === 0);
      setFuncModule(i, 6, i % 2 === 0);
    }

    // Padrão de Alinhamento (Versões >= 2)
    if (spec.align.length > 0) {
      const [a0, a1] = spec.align;
      const centers = [
        [a0, a0],
        [a0, a1],
        [a1, a0],
        [a1, a1]
      ];
      for (const [cy, cx] of centers) {
        if (isFunc[cy][cx]) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const dist = Math.max(Math.abs(dx), Math.abs(dy));
            setFuncModule(cy + dy, cx + dx, dist !== 1);
          }
        }
      }
    }

    // Módulo escuro fixo e reserva de área de formato
    setFuncModule(size - 8, 8, true);
    for (let i = 0; i < 9; i++) {
      if (!isFunc[8][i]) setFuncModule(8, i, false);
      if (!isFunc[i][8]) setFuncModule(i, 8, false);
    }
    for (let i = 0; i < 8; i++) {
      if (!isFunc[8][size - 1 - i]) setFuncModule(8, size - 1 - i, false);
      if (!isFunc[size - 1 - i][8]) setFuncModule(size - 1 - i, 8, false);
    }

    // Inserção dos bits de dados em zigue-zague
    let bitIdx = 0;
    const totalBits = codewords.length * 8;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const c = right - j;
          const upward = ((right + 1) & 2) === 0;
          const r = upward ? size - 1 - vert : vert;
          if (!isFunc[r][c]) {
            let dark = false;
            if (bitIdx < totalBits) {
              dark = ((codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) !== 0;
              bitIdx++;
            }
            // Máscara 0: (r + c) % 2 === 0
            if ((r + c) % 2 === 0) dark = !dark;
            modules[r][c] = dark;
          }
        }
      }
    }

    // Bits de formato para Nível L (01) + Máscara 0 (000) -> 0x77c4
    const formatBits = 0x77c4;
    for (let i = 0; i <= 5; i++) setFuncModule(8, i, ((formatBits >>> i) & 1) !== 0);
    setFuncModule(8, 7, ((formatBits >>> 6) & 1) !== 0);
    setFuncModule(8, 8, ((formatBits >>> 7) & 1) !== 0);
    setFuncModule(7, 8, ((formatBits >>> 8) & 1) !== 0);
    for (let i = 9; i < 15; i++) setFuncModule(14 - i, 8, ((formatBits >>> i) & 1) !== 0);

    for (let i = 0; i < 8; i++) setFuncModule(8, size - 1 - i, ((formatBits >>> i) & 1) !== 0);
    for (let i = 8; i < 15; i++) setFuncModule(size - 15 + i, 8, ((formatBits >>> i) & 1) !== 0);

    return { size, modules };
  }

  function renderQrSvg(text, padding = 3) {
    const { size, modules } = buildMatrix(text);
    const total = size + padding * 2;
    let paths = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (modules[r][c]) {
          paths += `M${c + padding},${r + padding}h1v1h-1z`;
        }
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" class="qr-svg-code"><rect width="${total}" height="${total}" fill="#ffffff" rx="1.5"/><path d="${paths}" fill="#0f172a"/></svg>`;
  }

  global.tImagoQR = { renderQrSvg };
})(window);
