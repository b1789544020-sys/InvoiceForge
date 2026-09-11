/**
 * InvoiceForge — 模板编辑器（Template Style Editor）
 *
 * 用户可自定义单据的视觉外观：
 *   - 主题色（primary color）
 *   - 强调色（accent color）
 *   - 字体（font family）
 *   - Logo URL（可选）
 *
 * 数据结构：
 *   doc.templateStyle = {
 *     primary: '#1e40af',
 *     accent:  '#dc2626',
 *     font:    'system|serif|mono|comic',
 *     logo:    'https://...'   // 可选
 *   }
 *
 * API：
 *   TemplateEditor.open(documentId)        打开编辑器弹窗
 *   TemplateEditor.applyTo(doc)            把样式应用到 doc 对象（写入 dataURL 渲染）
 *   TemplateEditor.injectCSS(doc)          把样式注入到打印 / 预览容器
 *   TemplateEditor.getForDocument(docId)   读取 doc 的样式
 *   TemplateEditor.clear(docId)            清除样式
 */
(function (global) {
  'use strict';

  const DEFAULTS = {
    primary: '#1e40af',
    accent:  '#dc2626',
    font:    'system',
    logo:    ''
  };

  const FONTS = {
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    serif:  'Georgia, "Times New Roman", serif',
    mono:   '"SF Mono", Consolas, monospace',
    comic:  '"Comic Sans MS", "Marker Felt", cursive'
  };

  function getDocs() {
    try { return JSON.parse(localStorage.getItem('invoiceforge_documents') || '[]'); }
    catch (e) { return []; }
  }
  function saveDocs(docs) {
    try { localStorage.setItem('invoiceforge_documents', JSON.stringify(docs)); } catch (e) {}
  }
  function findDoc(id) {
    return getDocs().find(function (d) { return d.id === id; }) || null;
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

  function getForDocument(documentId) {
    const d = findDoc(documentId);
    if (!d) return null;
    return d.templateStyle || null;
  }

  function clear(documentId) {
    updateDoc(documentId, function (d) {
      delete d.templateStyle;
      d.updatedAt = new Date().toISOString();
      return d;
    });
    try { window.dispatchEvent(new CustomEvent('document:template-updated', { detail: { id: documentId, style: null } })); } catch (e) {}
  }

  function toCSSVars(style) {
    const s = Object.assign({}, DEFAULTS, style || {});
    const font = FONTS[s.font] || FONTS.system;
    return [
      '--tmpl-primary: ' + s.primary + ';',
      '--tmpl-accent: ' + s.accent + ';',
      '--tmpl-font: ' + font + ';'
    ].join(' ');
  }

  /**
   * 把样式注入到 doc 的渲染 HTML 容器。
   * 用法：在 app.js 生成 document HTML 之后调用
   *   const css = TemplateEditor.injectCSS(doc);
   *   const html = `<div style="${css}"> ... </div>`;
   */
  function injectCSS(doc) {
    const style = (doc && doc.templateStyle) || null;
    return toCSSVars(style);
  }

  function applyTo(doc) {
    if (!doc) return null;
    return Object.assign({}, DEFAULTS, doc.templateStyle || {});
  }

  // ===== Modal =====
  function ensureModal() {
    let m = document.getElementById('template-editor-modal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'template-editor-modal';
    m.className = 'modal';
    m.innerHTML = [
      '<div class="modal-content max-w-2xl">',
      '  <div class="modal-header">',
      '    <h2 class="text-xl font-bold">模板样式编辑器 <span class="ml-2 text-xs px-2 py-0.5 rounded-full" style="background:linear-gradient(90deg,#f59e0b,#ef4444);color:#fff;">PRO</span></h2>',
      '    <span class="modal-close close-template-editor">&times;</span>',
      '  </div>',
      '  <div class="modal-body">',
      '    <p class="text-sm text-gray-600 mb-3">自定义单据外观，导出 PDF / 打印时会自动应用。</p>',
      '    <div class="grid grid-cols-2 gap-4">',
      '      <div>',
      '        <label class="block text-sm font-medium mb-1">主题色</label>',
      '        <input type="color" id="tpl-primary" class="w-full h-10 cursor-pointer" />',
      '      </div>',
      '      <div>',
      '        <label class="block text-sm font-medium mb-1">强调色</label>',
      '        <input type="color" id="tpl-accent" class="w-full h-10 cursor-pointer" />',
      '      </div>',
      '      <div>',
      '        <label class="block text-sm font-medium mb-1">字体</label>',
      '        <select id="tpl-font" class="shadow border rounded w-full py-2 px-3">',
      '          <option value="system">系统默认（无衬线）</option>',
      '          <option value="serif">衬线（正式）</option>',
      '          <option value="mono">等宽（技术风）</option>',
      '          <option value="comic">手写（轻松）</option>',
      '        </select>',
      '      </div>',
      '      <div>',
      '        <label class="block text-sm font-medium mb-1">Logo URL（可选）</label>',
      '        <input type="text" id="tpl-logo" placeholder="https://..." class="shadow border rounded w-full py-2 px-3 text-sm" />',
      '      </div>',
      '    </div>',
      '    <div class="mt-4 p-3 rounded" style="background:#f9fafb;border:1px solid #e5e7eb;">',
      '      <div class="text-xs text-gray-500 mb-1">预览</div>',
      '      <div id="tpl-preview" class="p-3 rounded" style="background:#fff;border:1px solid #ddd;">',
      '        <div style="color:var(--tmpl-primary);font-family:var(--tmpl-font);font-size:18px;font-weight:bold;">单据标题样例</div>',
      '        <div style="color:var(--tmpl-accent);font-size:14px;margin-top:4px;">¥ 1,234.56</div>',
      '        <div style="font-size:12px;color:#666;margin-top:6px;">客户：示例客户公司</div>',
      '      </div>',
      '    </div>',
      '  </div>',
      '  <div class="modal-footer flex justify-between">',
      '    <button type="button" id="tpl-clear-btn" class="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded">恢复默认</button>',
      '    <div>',
      '      <button type="button" class="close-template-editor bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded-lg">取消</button>',
      '      <button type="button" id="tpl-save-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">保存</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
    document.body.appendChild(m);
    bindModal(m);
    return m;
  }

  function bindModal(m) {
    m.querySelectorAll('.close-template-editor').forEach(function (el) {
      el.addEventListener('click', function () { close(); });
    });
    m.addEventListener('click', function (e) {
      if (e.target === m) close();
    });
    // Live preview
    ['tpl-primary', 'tpl-accent', 'tpl-font', 'tpl-logo'].forEach(function (id) {
      const el = m.querySelector('#' + id);
      if (el) el.addEventListener('input', updatePreview);
      if (el && el.tagName === 'SELECT') el.addEventListener('change', updatePreview);
    });
  }

  function updatePreview() {
    const m = document.getElementById('template-editor-modal');
    if (!m) return;
    const primary = m.querySelector('#tpl-primary').value || DEFAULTS.primary;
    const accent  = m.querySelector('#tpl-accent').value || DEFAULTS.accent;
    const fontKey = m.querySelector('#tpl-font').value || 'system';
    const logo    = (m.querySelector('#tpl-logo').value || '').trim();
    const preview = m.querySelector('#tpl-preview');
    if (!preview) return;
    preview.style.setProperty('--tmpl-primary', primary);
    preview.style.setProperty('--tmpl-accent', accent);
    preview.style.setProperty('--tmpl-font', FONTS[fontKey] || FONTS.system);
    if (logo) {
      preview.insertAdjacentHTML('afterbegin', '<img id="tpl-preview-logo" src="' + logo + '" style="max-height:30px;float:right;" onerror="this.remove()" />');
    } else {
      const old = preview.querySelector('#tpl-preview-logo');
      if (old) old.remove();
    }
  }

  let _currentDocId = null;

  function open(documentId) {
    _currentDocId = documentId;
    const m = ensureModal();
    const cur = getForDocument(documentId) || DEFAULTS;
    m.querySelector('#tpl-primary').value = cur.primary || DEFAULTS.primary;
    m.querySelector('#tpl-accent').value  = cur.accent  || DEFAULTS.accent;
    m.querySelector('#tpl-font').value    = cur.font    || DEFAULTS.font;
    m.querySelector('#tpl-logo').value     = cur.logo    || '';
    // Wire save / clear
    m.querySelector('#tpl-save-btn').onclick = save;
    m.querySelector('#tpl-clear-btn').onclick = function () {
      if (!confirm('确定要恢复默认样式吗？')) return;
      m.querySelector('#tpl-primary').value = DEFAULTS.primary;
      m.querySelector('#tpl-accent').value  = DEFAULTS.accent;
      m.querySelector('#tpl-font').value    = DEFAULTS.font;
      m.querySelector('#tpl-logo').value     = '';
      updatePreview();
    };
    updatePreview();
    try { openModal('template-editor-modal'); } catch (e) { m.style.display = 'flex'; }
  }

  function save() {
    if (!_currentDocId) return;
    const m = document.getElementById('template-editor-modal');
    const style = {
      primary: m.querySelector('#tpl-primary').value || DEFAULTS.primary,
      accent:  m.querySelector('#tpl-accent').value  || DEFAULTS.accent,
      font:    m.querySelector('#tpl-font').value    || DEFAULTS.font,
      logo:    (m.querySelector('#tpl-logo').value   || '').trim()
    };
    updateDoc(_currentDocId, function (d) {
      d.templateStyle = style;
      d.updatedAt = new Date().toISOString();
      return d;
    });
    if (typeof showToast === 'function') showToast('样式已保存', 'success');
    close();
    try { window.dispatchEvent(new CustomEvent('document:template-updated', { detail: { id: _currentDocId, style: style } })); } catch (e) {}
    try { if (typeof renderDocuments === 'function') renderDocuments(); } catch (e) {}
  }

  function close() {
    try { closeModal('template-editor-modal'); } catch (e) {
      const m = document.getElementById('template-editor-modal');
      if (m) m.style.display = 'none';
    }
    _currentDocId = null;
  }

  global.TemplateEditor = {
    open: open,
    close: close,
    applyTo: applyTo,
    injectCSS: injectCSS,
    getForDocument: getForDocument,
    clear: clear

  };
})(window);