/**
 * InvoiceForge — 电子签名模块
 *
 * 提供两种签名方式：
 *   1. 文字签名（typed）：输入姓名 / 职位，作为 base64 文本存储
 *   2. 手写签名（drawn）：canvas 绘图，作为 PNG dataURL 存储
 *
 * 签名数据存到对应 document 对象的 doc.signature 字段：
 *   {
 *     type: 'typed' | 'drawn',
 *     data: 'John Doe' | 'data:image/png;base64,...',
 *     role: 'Manager',                    // 可选，typed 才有
 *     signedAt: '2026-01-01T00:00:00.000Z',
 *     signedBy: 'John Doe'                // 输入的姓名（typed）或 "Customer"（drawn）
 *   }
 *
 * API：
 *   SignaturePad.open(documentId)         打开签名弹窗
 *   SignaturePad.getForDocument(documentId)  读取 doc 的签名
 *   SignaturePad.removeForDocument(documentId) 移除签名
 *   SignaturePad.renderHTML(sig)          渲染 HTML（用于打印 / 预览）
 */
(function (global) {
  'use strict';

  // ===== i18n =====
  function t(key, fallback) {
    try {
      if (typeof i18n !== 'undefined' && i18n && i18n.t) {
        const v = i18n.t(key);
        if (v && v !== key) return v;
      }
    } catch (e) {}
    return fallback;
  }

  function getDocs() {
    try { return JSON.parse(localStorage.getItem('invoiceforge_documents') || '[]'); }
    catch (e) { return []; }
  }
  function saveDocs(docs) {
    try { localStorage.setItem('invoiceforge_documents', JSON.stringify(docs)); } catch (e) {}
  }

  function findDoc(id) {
    const docs = getDocs();
    return docs.find(function (d) { return d.id === id; }) || null;
  }
  function updateDoc(id, mutator) {
    const docs = getDocs();
    const idx = docs.findIndex(function (d) { return d.id === id; });
    if (idx < 0) return null;
    const updated = mutator(Object.assign({}, docs[idx]));
    docs[idx] = updated;
    saveDocs(docs);
    return updated;
  }

  // ===== Modal =====
  function ensureModal() {
    let m = document.getElementById('signature-modal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'signature-modal';
    m.className = 'modal';
    m.innerHTML = [
      '<div class="modal-content max-w-lg">',
      '  <div class="modal-header">',
      '    <h2 class="text-xl font-bold" data-sig-title>' + t('signatureTitle', '电子签名') + '</h2>',
      '    <span class="modal-close close-signature-modal">&times;</span>',
      '  </div>',
      '  <div class="modal-body">',
      '    <p class="text-sm text-gray-600 mb-2" data-sig-hint></p>',
      // typed section
      '    <div id="sig-typed-section">',
      '      <label class="block text-sm font-medium mb-1">' + t('signatureName', '签名人姓名') + '</label>',
      '      <input id="sig-typed-name" type="text" class="shadow border rounded w-full py-2 px-3 text-gray-700 mb-2" />',
      '      <label class="block text-sm font-medium mb-1">' + t('signatureRole', '职位（可选）') + '</label>',
      '      <input id="sig-typed-role" type="text" placeholder="e.g. CEO, Manager" class="shadow border rounded w-full py-2 px-3 text-gray-700 mb-2" />',
      '    </div>',
      // drawn section
      '    <div id="sig-drawn-section" style="display:none">',
      '      <label class="block text-sm font-medium mb-1">' + t('signatureDraw', '请在下方手写签名') + '</label>',
      '      <canvas id="sig-canvas" width="520" height="180" ',
      '              style="border:1px dashed #999;background:#fff;width:100%;height:180px;touch-action:none;cursor:crosshair"></canvas>',
      '      <div class="flex gap-2 mt-2">',
      '        <button type="button" id="sig-clear-btn" class="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded">' + t('signatureClear', '清除') + '</button>',
      '      </div>',
      '    </div>',
      '  </div>',
      '  <div class="modal-footer">',
      '    <button type="button" class="close-signature-modal bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded-lg">' + t('cancel', '取消') + '</button>',
      '    <button type="button" id="sig-save-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">' + t('save', '保存') + '</button>',
      '  </div>',
      '</div>'
    ].join('\n');
    document.body.appendChild(m);
    bindModal(m);
    return m;
  }

  let _canvasCtx = null;
  let _drawing = false;

  function bindModal(m) {
    m.querySelectorAll('.close-signature-modal').forEach(function (el) {
      el.addEventListener('click', function () { close(); });
    });
    m.addEventListener('click', function (e) {
      if (e.target === m) close();
    });
  }

  function setupCanvas() {
    const canvas = document.getElementById('sig-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    _canvasCtx = ctx;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // HiDPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.scale(dpr, dpr);
    clearCanvas();
  }

  function clearCanvas() {
    if (!_canvasCtx) return;
    const canvas = document.getElementById('sig-canvas');
    if (!canvas) return;
    _canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function getPos(canvas, ev) {
    const rect = canvas.getBoundingClientRect();
    const src = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  function bindCanvasEvents() {
    const canvas = document.getElementById('sig-canvas');
    if (!canvas || canvas._sigBound) return;
    canvas._sigBound = true;
    function start(ev) { ev.preventDefault(); _drawing = true; const p = getPos(canvas, ev); _canvasCtx.beginPath(); _canvasCtx.moveTo(p.x, p.y); }
    function move(ev) { if (!_drawing) return; ev.preventDefault(); const p = getPos(canvas, ev); _canvasCtx.lineTo(p.x, p.y); _canvasCtx.stroke(); }
    function end(ev) { if (!_drawing) return; ev.preventDefault(); _drawing = false; }
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end, { passive: false });
  }

  // ===== Public: open signature dialog =====
  let _currentDocId = null;

  function open(documentId) {
    _currentDocId = documentId;
    const m = ensureModal();
    const doc = findDoc(documentId);

    // Hint
    const hint = m.querySelector('[data-sig-hint]');
    if (hint) {
      hint.textContent = t('signatureHintPro', '可手写或输入文字签名。');
    }

    // Both signature modes are always available
    m.querySelector('#sig-typed-section').style.display = '';
    m.querySelector('#sig-drawn-section').style.display = '';

    // Pre-fill from existing
    const sig = doc && doc.signature;
    if (sig) {
      if (sig.type === 'typed') {
        m.querySelector('#sig-typed-name').value = sig.signedBy || '';
        m.querySelector('#sig-typed-role').value = sig.role || '';
      } else if (sig.type === 'drawn') {
        // will render into canvas on next tick
        setTimeout(function () {
          setupCanvas();
          bindCanvasEvents();
          const img = new Image();
          img.onload = function () {
            const c = document.getElementById('sig-canvas');
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0, c.clientWidth, c.clientHeight);
          };
          img.src = sig.data;
        }, 0);
      }
    }

    // Wire save / clear
    const saveBtn = m.querySelector('#sig-save-btn');
    saveBtn.onclick = function () { save(); };
    const clearBtn = m.querySelector('#sig-clear-btn');
    if (clearBtn) clearBtn.onclick = function () { clearCanvas(); };

    // Setup canvas in case user switches to drawn
    setTimeout(function () { setupCanvas(); bindCanvasEvents(); }, 0);

    openModal('signature-modal');
  }

  function save() {
    if (!_currentDocId) return;
    const m = document.getElementById('signature-modal');
    const name = (m.querySelector('#sig-typed-name').value || '').trim();
    const role = (m.querySelector('#sig-typed-role').value || '').trim();

    let payload = null;
    // Prefer a hand-drawn signature when the canvas has ink on it.
    const canvas = document.getElementById('sig-canvas');
    const drawnData = canvas ? canvas.toDataURL('image/png') : null;
    const hasDrawn = drawnData && drawnData.length > 200; // empty png is ~150 bytes
    if (hasDrawn) {
      payload = {
        type: 'drawn',
        data: drawnData,
        signedBy: name || t('signatureCustomer', '客户'),
        signedAt: new Date().toISOString()
      };
    }
    if (!payload) {
      if (!name) {
        showToast(t('signatureNameRequired', '请输入签名人姓名'), 'error');
        return;
      }
      payload = {
        type: 'typed',
        data: name,
        role: role,
        signedBy: name,
        signedAt: new Date().toISOString()
      };
    }

    updateDoc(_currentDocId, function (d) {
      d.signature = payload;
      d.updatedAt = new Date().toISOString();
      return d;
    });
    showToast(t('signatureSaved', '签名已保存'), 'success');
    close();
    // notify others
    try { window.dispatchEvent(new CustomEvent('document:signature-updated', { detail: { id: _currentDocId, signature: payload } })); } catch (e) {}
    try { if (typeof renderDocuments === 'function') renderDocuments(); } catch (e) {}
    try { if (typeof updateDashboard === 'function') updateDashboard(); } catch (e) {}
  }

  function close() {
    try { closeModal('signature-modal'); } catch (e) {}
    _currentDocId = null;
  }

  function getForDocument(documentId) {
    const d = findDoc(documentId);
    return (d && d.signature) ? d.signature : null;
  }

  function removeForDocument(documentId) {
    updateDoc(documentId, function (d) {
      delete d.signature;
      d.updatedAt = new Date().toISOString();
      return d;
    });
    try { window.dispatchEvent(new CustomEvent('document:signature-updated', { detail: { id: documentId, signature: null } })); } catch (e) {}
  }

  // Render HTML for a signature (used by print / preview)
  function renderHTML(sig) {
    if (!sig) return '';
    var AMP = String.fromCharCode(38);
    var LT  = String.fromCharCode(60);
    var GT  = String.fromCharCode(62);
    var QUOT= String.fromCharCode(34);
    var APOS= String.fromCharCode(39);
    var esc = function (s) {
      return String(s)
        .split(AMP).join(AMP + 'amp;')
        .split(LT).join(AMP + 'lt;')
        .split(GT).join(AMP + 'gt;')
        .split(QUOT).join(AMP + 'quot;')
        .split(APOS).join(AMP + '#39;');
    };
    var safeName = esc(sig.signedBy || '');
    var safeRole = esc(sig.role || '');
    var date = sig.signedAt ? new Date(sig.signedAt).toLocaleString() : '';
    var inner = sig.type === 'drawn'
      ? LT + 'img src="' + sig.data + '" alt="signature" style="max-height:60px;max-width:240px;display:block;" /' + GT
      : LT + 'div style="font-family:Brush Script MT,cursive;font-size:28px;color:#111;line-height:1;border-bottom:1px solid #555;padding:6px 0 2px;"' + GT + safeName + LT + '/div' + GT;
    return [
      LT + 'div class="sig-block" style="margin-top:18px;border:1px solid #ddd;padding:10px 12px;background:#fafafa;"' + GT,
      '  ' + LT + 'div class="sig-title" style="font-size:11px;color:#666;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;"' + GT + t('signatureTitle', '电子签名') + LT + '/div' + GT,
      '  ' + LT + 'div class="sig-body"' + GT + inner + LT + '/div' + GT,
      '  ' + LT + 'div class="sig-meta" style="font-size:11px;color:#666;margin-top:6px;"' + GT,
      '    ' + LT + 'span' + GT + LT + 'strong' + GT + safeName + LT + '/strong' + GT + (safeRole ? ' · ' + safeRole : '') + LT + '/span' + GT,
      '    ' + LT + 'span style="float:right;"' + GT + date + LT + '/span' + GT,
      '  ' + LT + '/div' + GT,
      LT + '/div' + GT
    ].join('');
  }

  global.SignaturePad = {
    open: open,
    close: close,
    getForDocument: getForDocument,
    removeForDocument: removeForDocument,
    renderHTML: renderHTML

  };
})(window);