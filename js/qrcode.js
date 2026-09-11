/* ================================================================
 *  qrcode.js  ——  Stage 1.4 单据内二维码
 *  纯 JS QR 码生成器（无依赖、单文件）
 *  支持：1~10 字符版本自动选择 / 纠错等级 L / Byte mode
 *  输出：<canvas> 元素 + dataURL
 *  API:
 *      QRCode.toCanvas(text, size?)         -> HTMLCanvasElement
 *      QRCode.toDataURL(text, size?)        -> "data:image/png;base64,..."
 *      QRCode.build(text)                   -> { size, modules, isDark(r,c) }
 *  依赖：无
 *  协议：MIT (Inspired by Nayuki's QR-Code-generator, simplified)
 * ================================================================ */
(function (global) {
  'use strict';

  // ---------- Galois field GF(256) tables ----------
  const EXP = new Array(256), LOG = new Array(256);
  (function () {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;
    }
    EXP[255] = EXP[0];
  })();
  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[(LOG[a] + LOG[b]) % 255];
  }

  // ---------- RS error correction ----------
  function rsGenPoly(n) {
    let g = [1];
    for (let i = 0; i < n; i++) {
      const next = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) {
        next[j]   ^= g[j];
        next[j+1] ^= gfMul(g[j], EXP[i]);
      }
      g = next;
    }
    return g;
  }
  function rsEncode(data, eccLen) {
    const gen = rsGenPoly(eccLen);
    const result = data.concat(new Array(eccLen).fill(0));
    for (let i = 0; i < data.length; i++) {
      const coef = result[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) {
          result[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return result.slice(data.length);
  }

  // ---------- Capacity table (Byte mode, EC level L) ----------
  // version (1..10) -> [totalCodewords, dataCodewords, group1Blocks, group1DataPerBlock, group2Blocks, group2DataPerBlock]
  const CAP_L = {
    1:  [26,  19,  1,  19,  0,   0],
    2:  [44,  34,  1,  34,  0,   0],
    3:  [70,  55,  1,  55,  0,   0],
    4:  [100, 80,  1,  80,  0,   0],
    5:  [134,108,  1, 108,  0,   0],
    6:  [172,136,  2,  68,  0,   0],
    7:  [196,156,  2,  78,  0,   0],
    8:  [242,194,  2,  97,  0,   0],
    9:  [292,232,  2, 116,  0,   0],
    10: [346,274,  2,  68,  2,  69],
  };
  // EC level L → ECC codewords per block:
  const ECC_BLOCKS_L = { 1:7, 2:10, 3:15, 4:20, 5:26, 6:18, 7:20, 8:24, 9:30, 10:18 };

  // ---------- 16-bit CRC for UTF-8 byte stuffing test (we just rely on byte mode) ----------
  function utf8Bytes(s) {
    // Use TextEncoder if available
    if (typeof TextEncoder !== 'undefined') {
      return Array.from(new TextEncoder().encode(s));
    }
    const out = [];
    for (let i = 0; i < s.length; i++) {
      let c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xC0 | c>>6, 0x80 | (c&0x3F)); }
      else { out.push(0xE0 | c>>12, 0x80 | ((c>>6)&0x3F), 0x80 | (c&0x3F)); }
    }
    return out;
  }

  // Choose smallest version (1..10) that fits the data (byte mode, EC level L)
  function pickVersion(byteLen) {
    for (let v = 1; v <= 10; v++) {
      const cap = CAP_L[v];
      // Byte mode: 4-bit mode + 8/16-bit length + 4-bit terminator
      const lenBytes = byteLen < 10 ? 1 : 2;
      const overhead = 1 + lenBytes; // mode nibble + length
      const usable = cap[1] - overhead;
      if (usable >= byteLen) return v;
    }
    return null; // too big (>154 bytes for v10-L)
  }

  // ---------- Bit buffer ----------
  function BitBuffer() { this.bits = []; }
  BitBuffer.prototype.put = function (n, val) {
    for (let i = n - 1; i >= 0; i--) this.bits.push((val >> i) & 1);
  };
  BitBuffer.prototype.length = function () { return this.bits.length; };

  // ---------- Build codewords (data + ECC interleaved) ----------
  function buildCodewords(bytes) {
    const version = pickVersion(bytes.length);
    if (!version) throw new Error('QR data too large (>154 bytes at EC level L)');
    const cap = CAP_L[version];
    const totalCW = cap[0], dataCW = cap[1];
    const eccCW = ECC_BLOCKS_L[version];

    // 1) Build data bit stream
    const bb = new BitBuffer();
    bb.put(4, 0x4); // mode = byte (0100)
    const lenBytes = bytes.length < 10 ? 1 : 2;
    bb.put(lenBytes * 8, bytes.length);
    for (const b of bytes) bb.put(8, b);
    // terminator + padding to data codewords
    const rem = dataCW * 8 - bb.length();
    bb.put(Math.min(4, Math.max(0, rem)), 0);
    while (bb.bits.length % 8 !== 0) bb.bits.push(0);
    // Pad to dataCW
    const pad = [0xEC, 0x11];
    let pi = 0;
    while (bb.bits.length < dataCW * 8) {
      bb.put(8, pad[pi]); pi ^= 1;
    }

    // 2) Split into codewords
    const dataCWs = [];
    for (let i = 0; i < bb.bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bb.bits[i + j];
      dataCWs.push(b);
    }

    // 3) Split into blocks, compute ECC per block
    const g1n = cap[2], g1d = cap[3], g2n = cap[4], g2d = cap[5];
    const blocks = [];
    for (let i = 0; i < g1n; i++) blocks.push(dataCWs.splice(0, g1d));
    for (let i = 0; i < g2n; i++) blocks.push(dataCWs.splice(0, g2d));
    const eccBlocks = blocks.map(b => rsEncode(b, eccCW));

    // 4) Interleave
    const maxData = Math.max(g1d, g2d);
    const out = [];
    for (let i = 0; i < maxData; i++) {
      for (const b of blocks) if (i < b.length) out.push(b[i]);
    }
    for (let i = 0; i < eccCW; i++) {
      for (const e of eccBlocks) out.push(e[i]);
    }
    return { codewords: out, version: version, totalCW: totalCW };
  }

  // ---------- Module matrix ----------
  function makeMatrix(version) {
    const size = version * 4 + 17;
    const m = [];
    const r = [];
    for (let i = 0; i < size; i++) { m.push(new Array(size).fill(null)); r.push(false); }
    return { m, reserved: r, size };
  }

  function placeFinder(m, r, row, col) {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const rr = row + dr, cc = col + dc;
        if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) continue;
        const isDark = (
          (dr >= 0 && dr <= 6 && (dc === 0 || dc === 6)) ||
          (dc >= 0 && dc <= 6 && (dr === 0 || dr === 6)) ||
          (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)
        );
        m[rr][cc] = isDark;
        r[rr] = r[rr] || (cc >= 0);
      }
    }
  }

  function placeAlignment(m, r, row, col) {
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const isDark = (Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        m[row + dr][col + dc] = isDark;
        r[row + dr] = true;
      }
    }
  }

  function placeTiming(m, r) {
    const size = m.length;
    for (let i = 8; i < size - 8; i++) {
      m[6][i] = (i % 2 === 0);
      m[i][6] = (i % 2 === 0);
      r[6] = true; r[i] = true;
    }
  }

  function placeFormatBits(m, r, ecLevel, mask) {
    const size = m.length;
    // ecLevel: 0=L,1=M,2=Q,3=H
    function setAndReserve(rr, cc, dark) { m[rr][cc] = dark; r[rr] = true; }
    // Vertical strip near top-left finder
    const data = (ecLevel << 3) | mask;
    for (let i = 0; i < 15; i++) {
      const bit = ((data >> i) & 1) === 1;
      // Top-left
      if (i < 6)         setAndReserve(8, i, bit);
      else if (i < 8)    setAndReserve(8, i + 1, bit);
      else if (i < 9)    setAndReserve(7, 8, bit);
      else if (i < 12)   setAndReserve(5 - (i - 8), 8, bit);
      else               setAndReserve(0, 14 - i, bit);
      // Bottom-left + top-right
      if (i < 8)         setAndReserve(size - 1 - i, 8, bit);
      else               setAndReserve(8, size - 15 + i, bit);
    }
    setAndReserve(size - 8, 8, true); // always-dark module
  }

  function placeVersionInfo(m, r, version) {
    if (version < 7) return;
    const size = m.length;
    for (let i = 0; i < 18; i++) {
      const bit = ((version >> (i % 6)) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = i % 3 + size - 11;
      m[a][b] = bit; r[a] = true;
      m[b][a] = bit; r[b] = true;
    }
  }

  function maskFunc(idx, r, c) {
    switch (idx) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r/2) + Math.floor(c/3)) % 2 === 0;
      case 5: return (r*c)%2 + (r*c)%3 === 0;
      case 6: return ((r*c)%2 + (r*c)%3) % 2 === 0;
      case 7: return ((r + c) % 2 + (r*c)%3) % 2 === 0;
    }
    return false;
  }

  function buildMatrix(text) {
    const bytes = utf8Bytes(text);
    const { codewords, version } = buildCodewords(bytes);
    const { m, reserved, size } = makeMatrix(version);

    // Finder + separators
    placeFinder(m, reserved, 0, 0);
    placeFinder(m, reserved, 0, size - 7);
    placeFinder(m, reserved, size - 7, 0);
    // Timing
    placeTiming(m, reserved);
    // Alignment patterns (positions for versions 2..10)
    const alignPos = {
      2: [6,18], 3: [6,22], 4: [6,26], 5: [6,30],
      6: [6,34], 7: [6,22,38], 8: [6,24,42], 9: [6,26,46], 10: [6,28,50]
    };
    const ap = alignPos[version] || [];
    for (let i = 0; i < ap.length; i++) {
      for (let j = 0; j < ap.length; j++) {
        const rr = ap[i], cc = ap[j];
        if ((rr === 6 && cc === 6) ||
            (rr === 6 && cc === size - 7) ||
            (rr === size - 7 && cc === 6)) continue;
        placeAlignment(m, reserved, rr, cc);
      }
    }
    // Dark module (always)
    m[size - 8][8] = true;
    reserved[size - 8] = true;

    // Place data bits (LSB of codeword goes to first module)
    let bitIdx = 0;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--; // skip vertical timing
      for (let vert = 0; vert < size; vert++) {
        for (let dx = 0; dx < 2; dx++) {
          const c = col - dx;
          const upward = ((size - col) >> 1) % 2 === 0;
          const r = upward ? size - 1 - vert : vert;
          if (reserved[r]) continue;
          const cw = codewords[bitIdx >> 3];
          const bit = (cw >> (7 - (bitIdx & 7))) & 1;
          m[r][c] = bit === 1;
          bitIdx++;
        }
      }
    }

    // Try all 8 masks, pick the one with lowest penalty
    const EC_L = 0; // EC level L
    let best = null, bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const m2 = m.map(row => row.slice());
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (reserved[r]) continue;
          if (maskFunc(mask, r, c)) m2[r][c] = !m2[r][c];
        }
      }
      placeFormatBits(m2, reserved, EC_L, mask);
      placeVersionInfo(m2, reserved, version);
      const s = score(m2);
      if (s < bestScore) { bestScore = s; best = m2; }
    }
    return { size, modules: best };
  }

  function score(m) {
    const N = m.length;
    let s = 0;
    // Rule 1: runs of 5+ same color in row/col
    for (let r = 0; r < N; r++) {
      let run = 1;
      for (let c = 1; c < N; c++) {
        if (m[r][c] === m[r][c-1]) { run++; if (run === 5) s += 3; else if (run > 5) s++; }
        else run = 1;
      }
    }
    for (let c = 0; c < N; c++) {
      let run = 1;
      for (let r = 1; r < N; r++) {
        if (m[r][c] === m[r-1][c]) { run++; if (run === 5) s += 3; else if (run > 5) s++; }
        else run = 1;
      }
    }
    // Rule 2: 2x2 same color
    for (let r = 0; r < N - 1; r++) {
      for (let c = 0; c < N - 1; c++) {
        if (m[r][c] === m[r][c+1] && m[r][c] === m[r+1][c] && m[r][c] === m[r+1][c+1]) s += 3;
      }
    }
    // Rule 3: 1011101 patterns (approximate: finder-like)
    // (skipped for brevity — usually 0 in normal codes)
    // Rule 4: dark proportion
    let dark = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (m[r][c]) dark++;
    const ratio = (dark * 100) / (N * N);
    const dev = Math.floor(Math.abs(ratio - 50) / 5);
    s += dev * 10;
    return s;
  }

  // ---------- Public: toCanvas / toDataURL ----------
  function toCanvas(text, size) {
    size = size || 160;
    const { size: N, modules } = buildMatrix(text);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    // background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    // modules
    const cell = size / (N + 4); // 2-module quiet zone on each side
    ctx.fillStyle = '#000000';
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (modules[r][c]) ctx.fillRect((c + 2) * cell, (r + 2) * cell, Math.ceil(cell), Math.ceil(cell));
      }
    }
    return canvas;
  }

  function toDataURL(text, size) {
    const c = toCanvas(text, size);
    return c.toDataURL('image/png');
  }

  global.QRCode = {
    toCanvas: toCanvas,
    toDataURL: toDataURL,
    build:     buildMatrix,
    _version:  function (t) { return pickVersion(utf8Bytes(t).length); },
  };
})(window);