/**
 * InvoiceForge — 加密存储（Encryption Module）
 *
 * 使用 Web Crypto API（SubtleCrypto）做 AES-GCM 加密：
 *   - 用户可设置一个密码（passphrase）
 *   - 用 PBKDF2 派生 AES 密钥
 *   - 加密存储敏感单据 / 客户信息到 localStorage
 *
 * 警告：这是客户端加密，无法替代真正的服务端安全。
 *       仅用于防止同设备其他用户直接读 localStorage 明文。
 *
 * API：
 *   Encryption.setPassphrase(pwd)        用户设置 / 修改密码
 *   Encryption.isEnabled()              是否已启用加密
 *   Encryption.encrypt(obj)             加密对象 → base64 字符串
 *   Encryption.decrypt(b64)             base64 → 解密对象
 *   Encryption.encryptDocs(docs)        加密整个 docs 数组 → 写入 secure store
 *   Encryption.loadDocs()               读取并解密 docs（如果启用）
 *   Encryption.migrate()                把明文数据迁移到加密
 *   Encryption.disable()                关闭加密（把加密数据还原为明文）
 */
(function (global) {
  'use strict';

  const STORE_KEY = 'invoiceforge.encryption';   // {salt, iv, verifier, enabled}
  const ENC_DOCS_KEY = 'invoiceforge.encrypted_documents';  // base64 ciphertext
  const PLAIN_DOCS_KEY = 'invoiceforge_documents';
  const ITERATIONS = 100000;

  function bufToB64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64ToBuf(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  function strToBuf(s) {
    return new TextEncoder().encode(s);
  }
  function bufToStr(buf) {
    return new TextDecoder().decode(buf);
  }

  async function deriveKey(passphrase, salt) {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      strToBuf(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: ITERATIONS, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  function getMeta() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function setMeta(meta) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(meta)); } catch (e) {}
  }
  function clearMeta() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  function isEnabled() {
    const m = getMeta();
    return !!(m && m.enabled);
  }

  async function setPassphrase(passphrase) {
    if (!passphrase || passphrase.length < 6) {
      throw new Error('密码至少 6 位');
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(passphrase, salt);
    // Verifier: encrypt a known string
    const verifier = 'invoiceforge-verifier-v1';
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      strToBuf(verifier)
    );
    setMeta({
      enabled: true,
      salt: bufToB64(salt.buffer),
      verifierIv: bufToB64(iv.buffer),
      verifierCt: bufToB64(ct)
    });
  }

  async function verifyPassphrase(passphrase) {
    const meta = getMeta();
    if (!meta) return false;
    try {
      const salt = new Uint8Array(b64ToBuf(meta.salt));
      const key = await deriveKey(passphrase, salt);
      const iv = new Uint8Array(b64ToBuf(meta.verifierIv));
      const ct = b64ToBuf(meta.verifierCt);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
      return bufToStr(pt) === 'invoiceforge-verifier-v1';
    } catch (e) {
      return false;
    }
  }

  async function encrypt(obj) {
    const meta = getMeta();
    if (!meta) throw new Error('加密未启用');
    // Need current passphrase — we use a session-stored hash
    const pwd = sessionStorage.getItem('invoiceforge.session_pwd');
    if (!pwd) throw new Error('会话已过期，请重新输入密码');
    const salt = new Uint8Array(b64ToBuf(meta.salt));
    const key = await deriveKey(pwd, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      strToBuf(JSON.stringify(obj))
    );
    return JSON.stringify({
      v: 1,
      iv: bufToB64(iv.buffer),
      ct: bufToB64(ct)
    });
  }

  async function decrypt(b64Envelope) {
    const meta = getMeta();
    if (!meta) throw new Error('加密未启用');
    const pwd = sessionStorage.getItem('invoiceforge.session_pwd');
    if (!pwd) throw new Error('会话已过期，请重新输入密码');
    const env = JSON.parse(b64Envelope);
    const salt = new Uint8Array(b64ToBuf(meta.salt));
    const key = await deriveKey(pwd, salt);
    const iv = new Uint8Array(b64ToBuf(env.iv));
    const ct = b64ToBuf(env.ct);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
    return JSON.parse(bufToStr(pt));
  }

  async function encryptDocs(docs) {
    const envelope = await encrypt(docs);
    localStorage.setItem(ENC_DOCS_KEY, envelope);
  }

  async function loadDocs() {
    if (!isEnabled()) {
      try { return JSON.parse(localStorage.getItem(PLAIN_DOCS_KEY) || '[]'); }
      catch (e) { return []; }
    }
    const enc = localStorage.getItem(ENC_DOCS_KEY);
    if (!enc) {
      // Try to migrate from plain
      let plainDocs = [];
      try { plainDocs = JSON.parse(localStorage.getItem(PLAIN_DOCS_KEY) || '[]'); } catch (e) {}
      if (plainDocs.length) {
        await encryptDocs(plainDocs);
        localStorage.removeItem(PLAIN_DOCS_KEY);
        return plainDocs;
      }
      return [];
    }
    return decrypt(enc);
  }

  async function migrate() {
    // Convert plain-text docs to encrypted
    let plain = [];
    try { plain = JSON.parse(localStorage.getItem(PLAIN_DOCS_KEY) || '[]'); } catch (e) {}
    if (!plain.length) return { migrated: 0 };
    await encryptDocs(plain);
    localStorage.removeItem(PLAIN_DOCS_KEY);
    return { migrated: plain.length };
  }

  async function disable(passphrase) {
    if (!isEnabled()) return;
    if (!await verifyPassphrase(passphrase)) {
      throw new Error('密码错误');
    }
    // Decrypt and write back to plain
    const docs = await loadDocs();
    localStorage.setItem(PLAIN_DOCS_KEY, JSON.stringify(docs));
    localStorage.removeItem(ENC_DOCS_KEY);
    clearMeta();
    sessionStorage.removeItem('invoiceforge.session_pwd');
  }

  function unlock(passphrase) {
    // store in session only
    sessionStorage.setItem('invoiceforge.session_pwd', passphrase);
  }

  function lock() {
    sessionStorage.removeItem('invoiceforge.session_pwd');
  }

  function isUnlocked() {
    if (!isEnabled()) return true;
    return !!sessionStorage.getItem('invoiceforge.session_pwd');
  }

  global.Encryption = {
    isEnabled: isEnabled,
    isUnlocked: isUnlocked,
    setPassphrase: setPassphrase,
    verifyPassphrase: verifyPassphrase,
    unlock: unlock,
    lock: lock,
    encrypt: encrypt,
    decrypt: decrypt,
    encryptDocs: encryptDocs,
    loadDocs: loadDocs,
    migrate: migrate,
    disable: disable
  };
})(window);