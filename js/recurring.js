/**
 * InvoiceForge - 定期账单
 *
 * 允许用户定义自动生成单据的规则。
 *
 * Storage:
 *   invoiceforge.recurring = [
 *     {
 *       id, name, clientId, template, items: [...], amount,
 *       schedule: { freq: 'monthly'|'weekly'|'yearly', day: 1 },
 *       nextRun: ISO date string,
 *       lastRun: ISO date string | null,
 *       active: true
 *     }
 *   ]
 *
 * API:
 *   Recurring.list()                    - list all
 *   Recurring.get(id)                   - get one
 *   Recurring.add(rule)                 - add
 *   Recurring.update(id, patch)         - update
 *   Recurring.remove(id)                - delete
 *   Recurring.runDue()                  - generate any documents whose nextRun has passed
 *   Recurring.openModal()               - open UI
 */
(function (global) {
  'use strict';

  const STORE_KEY = 'invoiceforge.recurring';

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
    catch (e) { return []; }
  }
  // NOTE: do NOT name this `save` — it would shadow the public `save()`
  // function declared further down (line ~395) inside the same IIFE scope,
  // causing `add()`/`update()` to recursively invoke the public entry.
  function saveList(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function uid() {
    return 'rec_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  function list() { return load(); }
  function get(id) { return load().find(function (r) { return r.id === id; }) || null; }
  function add(rule) {
    const list = load();
    const item = Object.assign({
      id: uid(),
      name: (typeof getTranslation === 'function' ? getTranslation('newRecurringInvoice') : '新定期单据'),
      clientId: null,
      template: 'classic',
      items: [],
      amount: 0,
      schedule: { freq: 'monthly', day: 1 },
      nextRun: computeNextRun(new Date(), { freq: 'monthly', day: 1 }),
      lastRun: null,
      active: true
    }, rule);
    list.push(item);
    saveList(list);
    return item;
  }
  function update(id, patch) {
    const list = load();
    const idx = list.findIndex(function (r) { return r.id === id; });
    if (idx < 0) return null;
    list[idx] = Object.assign({}, list[idx], patch);
    saveList(list);
    return list[idx];
  }
  function remove(id) {
    const list = load();
    const idx = list.findIndex(function (r) { return r.id === id; });
    if (idx < 0) return false;
    list.splice(idx, 1);
    saveList(list);
    return true;
  }

  function computeNextRun(fromDate, schedule) {
    const d = new Date(fromDate);
    const day = Math.max(1, Math.min(28, parseInt(schedule.day || 1, 10)));
    if (schedule.freq === 'yearly') {
      d.setMonth(d.getMonth() + 12);
    } else if (schedule.freq === 'weekly') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    d.setDate(day);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }

  function isDue(rule) {
    if (!rule || !rule.active) return false;
    if (!rule.nextRun) return true;
    return new Date(rule.nextRun).getTime() <= Date.now();
  }

  /**
   * Fallback copy of app.js's computeDocumentTotals(), used only when this
   * module runs without app.js loaded. Keep the two in sync.
   */
  function localTotals(items) {
    var subtotal = 0;
    var totalTax = 0;
    (items || []).forEach(function (it) {
      var line = (Number(it.price) || 0) * (Number(it.quantity) || 0);
      subtotal += line;
      totalTax += line * ((Number(it.tax) || 0) / 100);
    });
    return { subtotal: subtotal, totalTax: totalTax, total: subtotal + totalTax };
  }

  function generateDocument(rule) {
    var id;
    if (typeof generateDocumentId !== 'function') {
      var d = new Date();
      id = 'doc_' + d.getFullYear() +
        String(d.getMonth() + 1).padStart(2, '0') +
        String(d.getDate()).padStart(2, '0') + '_' +
        Math.random().toString(36).slice(2, 8);
    } else {
      id = generateDocumentId();
    }
    var docItems = (rule.items || []).map(function (i) { return Object.assign({}, i); });
    // Money fields must match saveDocument() exactly, otherwise the generated
    // document renders as "NaN" in the preview and dashboard. app.js loads
    // after this module, so resolve the shared helper at call time and keep a
    // local fallback for standalone use (unit tests, smoke tests).
    var totals = (typeof computeDocumentTotals === 'function')
      ? computeDocumentTotals(docItems)
      : localTotals(docItems);
    var doc = {
      id: id,
      type: rule.documentType || 'invoice',
      number: rule.name + ' ' + new Date().toLocaleDateString(),
      date: new Date().toISOString().slice(0, 10),
      clientId: rule.clientId,
      clientName: rule.clientName || '',
      items: docItems,
      subtotal: totals.subtotal,
      totalTax: totals.totalTax,
      total: totals.total,
      notes: rule.notes || '',
      template: rule.template || 'classic',
      currency: rule.currency || 'CNY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      status: 'pending',
      fromRecurring: rule.id,
      recurringName: rule.name
    };
    var docs = [];
    try { docs = JSON.parse(localStorage.getItem('invoiceforge_documents') || '[]'); } catch (e) {}
    docs.push(doc);
    try { localStorage.setItem('invoiceforge_documents', JSON.stringify(docs)); } catch (e) {}
    return doc;
  }

  function runDue() {
    const list = load();
    const generated = [];
    const now = Date.now();
    list.forEach(function (rule) {
      if (!rule.active) return;
      if (!rule.nextRun || new Date(rule.nextRun).getTime() <= now) {
        const doc = generateDocument(rule);
        generated.push({ rule: rule, doc: doc });
        rule.lastRun = new Date().toISOString();
        rule.nextRun = computeNextRun(new Date(), rule.schedule);
        saveList(list);
        try { window.dispatchEvent(new CustomEvent('recurring:generated', { detail: { rule: rule, doc: doc } })); } catch (e) {}
      }
    });
    if (generated.length) {
      try { var _gc = (typeof generatedCount === 'function') ? generatedCount : ((typeof getTranslation === 'function' && typeof getTranslation('generatedCount') === 'function') ? getTranslation('generatedCount') : null); if (typeof showToast === 'function') showToast(_gc ? _gc(generated.length) : ('已生成 ' + generated.length + ' 张定期单据'), 'success'); } catch (e) {}
      try { if (typeof renderDocuments === 'function') renderDocuments(); } catch (e) {}
    }
    return generated;
  }

  // ===== UI: Modal =====
  let _editingId = null;

  function ensureModal() {
    let m = document.getElementById('recurring-modal');
    if (m) {
      // Static modal already in DOM (e.g. from index.html). Make sure the
      // delegate handlers exist. Use a sentinel data-attr to avoid double-bind.
      wireModalHandlers(m);
      return m;
    }
    m = document.createElement('div');
    m.id = 'recurring-modal';
    m.className = 'modal';
    m.innerHTML = [
      '<div class="modal-content max-w-2xl">',
      '  <div class="modal-header">',
      '    <h2 class="text-xl font-bold" data-i18n="recurring">定期账单 <span class="ml-2 text-xs px-2 py-0.5 rounded-full" style="background:linear-gradient(90deg,#f59e0b,#ef4444);color:#fff;">PRO</span></h2>',
      '    <span class="modal-close close-recurring-modal">&times;</span>',
      '  </div>',
      '  <div class="modal-body">',
      '    <div class="flex justify-between items-center mb-3">',
      '      <p class="text-sm text-gray-600" data-i18n="recurringDesc">按计划自动生成单据，到期自动开票，省时省力。</p>',
      '      <button type="button" id="rec-add-btn" class="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded" data-i18n="addRule">+ 添加规则</button>',
      '    </div>',
      '    <div id="rec-list" class="space-y-2"></div>',
      '  </div>',
      '  <div class="modal-footer">',
      '    <button type="button" class="close-recurring-modal bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded-lg" data-i18n="close">关闭</button>',
      '  </div>',
      '</div>'
    ].join('\n');
    document.body.appendChild(m);
    wireModalHandlers(m);
    return m;
  }

  // Idempotent wiring of all modal-level events so the same handler works
  // whether the modal was injected by us or already existed in the HTML.
  function wireModalHandlers(m) {
    if (m.__recurring_wired) return;
    m.__recurring_wired = true;
    var closeBtns = m.querySelectorAll('.close-recurring-modal');
    for (var i = 0; i < closeBtns.length; i++) {
      closeBtns[i].addEventListener('click', function (e) {
        e.preventDefault();
        close();
      });
    }
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    var addBtn = m.querySelector('#rec-add-btn');
    if (addBtn && !addBtn.__recurring_wired) {
      addBtn.__recurring_wired = true;
      addBtn.addEventListener('click', function () {
        const newRule = add({ name: (typeof getTranslation === 'function' ? getTranslation('newRecurringInvoice') : '新定期单据') });
        _editingId = newRule.id;
        showForm(newRule);
      });
    }
  }

  function renderList() {
    const m = document.getElementById('recurring-modal');
    const listEl = m.querySelector('#rec-list');
    const items = list();
    if (!items.length) {
      listEl.innerHTML = '<p class="text-sm text-gray-500 text-center py-4" data-i18n="recNoRulesHint">还没有定期账单规则，点击"添加规则"创建一条。</p>';
      return;
    }
    listEl.innerHTML = items.map(function (r) {
      const next = r.nextRun ? new Date(r.nextRun).toLocaleDateString() : '-';
      var _f = r.schedule.freq;
      var freqLabel = _f === 'monthly' ? getTranslation('recFreqMonthly')
                    : _f === 'weekly'  ? getTranslation('recFreqWeekly')
                    : _f === 'yearly'  ? getTranslation('recFreqYearly')
                    : _f;
      var statusLabel = r.active ? '' : ' <span class="text-xs text-red-500">' + getTranslation('paused') + '</span>';
      return [
        '<div class="p-3 border rounded" style="background:#fafafa;">',
        '  <div class="flex justify-between items-start">',
        '    <div>',
        '      <div class="font-medium">' + escapeHtml(r.name || getTranslation('unnamedRule')) + statusLabel + '</div>',
        '      <div class="text-xs text-gray-500">' + freqLabel + ' ' + (r.schedule.day || 1) + ' ' + getTranslation('daySuffix') + ' - ' + getTranslation('nextRunLabel') + '：' + next + '</div>',
        '    </div>',
        '    <div class="flex gap-2">',
        '      <button type="button" class="text-sm bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded" data-rec-edit="' + r.id + '">' + getTranslation('recEdit') + '</button>',
        '      <button type="button" class="text-sm bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded" data-rec-delete="' + r.id + '">' + getTranslation('recDelete') + '</button>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join('');
    }).join('');
    listEl.querySelectorAll('[data-rec-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-rec-edit');
        const rule = get(id);
        if (rule) {
          _editingId = id;
          showForm(rule);
        }
      });
    });
    listEl.querySelectorAll('[data-rec-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm(getTranslation('deleteRuleConfirm'))) return;
        const id = btn.getAttribute('data-rec-delete');
        if (remove(id)) renderList();
      });
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' })[c];
    });
  }

  function showForm(rule) {
    const m = document.getElementById('recurring-modal');
    const listEl = m.querySelector('#rec-list');
    const r = rule;
    listEl.innerHTML = [
      '<div class="p-3 border rounded" style="background:#fff;">',
      '  <div class="grid grid-cols-2 gap-3">',
      '    <div class="col-span-2">',
      '      <label class="block text-sm font-medium mb-1">名称</label>',
      '      <input id="rec-name" type="text" value="' + escapeHtml(r.name || '') + '" class="shadow border rounded w-full py-2 px-3 text-sm" />',
      '    </div>',
      '    <div>',
      '      <label class="block text-sm font-medium mb-1">客户</label>',
      '      <input id="rec-client" type="text" value="' + escapeHtml(r.clientName || '') + '" class="shadow border rounded w-full py-2 px-3 text-sm" />',
      '    </div>',
      '    <div>',
      '      <label class="block text-sm font-medium mb-1">金额</label>',
      '      <input id="rec-amount" type="number" step="0.01" value="' + (r.amount || 0) + '" class="shadow border rounded w-full py-2 px-3 text-sm" />',
      '    </div>',
      '    <div>',
      '      <label class="block text-sm font-medium mb-1">频率</label>',
      '      <select id="rec-freq" class="shadow border rounded w-full py-2 px-3 text-sm">',
      '        <option value="monthly"' + (r.schedule.freq === 'monthly' ? ' selected' : '') + '>每月</option>',
      '        <option value="weekly"' + (r.schedule.freq === 'weekly' ? ' selected' : '') + '>每周</option>',
      '        <option value="yearly"' + (r.schedule.freq === 'yearly' ? ' selected' : '') + '>每年</option>',
      '      </select>',
      '    </div>',
      '    <div>',
      '      <label class="block text-sm font-medium mb-1">日期 (1-28)</label>',
      '      <input id="rec-day" type="number" min="1" max="28" value="' + (r.schedule.day || 1) + '" class="shadow border rounded w-full py-2 px-3 text-sm" />',
      '    </div>',
      '    <div class="col-span-2">',
      '      <label class="inline-flex items-center">',
      '        <input id="rec-active" type="checkbox" ' + (r.active !== false ? 'checked' : '') + ' class="mr-2" />',
      '        <span class="text-sm">启用</span>',
      '      </label>',
      '    </div>',
      '  </div>',
      '  <div class="flex justify-end gap-2 mt-3">',
      '    <button type="button" id="rec-cancel" class="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded">取消</button>',
      '    <button type="button" id="rec-save" class="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded">保存</button>',
      '  </div>',
      '</div>'
    ].join('\n');
    m.querySelector('#rec-cancel').addEventListener('click', function () {
      _editingId = null;
      renderList();
    });
    m.querySelector('#rec-save').addEventListener('click', function () {
      const patch = {
        name: m.querySelector('#rec-name').value.trim() || '新定期单据',
        clientName: m.querySelector('#rec-client').value.trim(),
        amount: parseFloat(m.querySelector('#rec-amount').value) || 0,
        schedule: {
          freq: m.querySelector('#rec-freq').value,
          day: parseInt(m.querySelector('#rec-day').value, 10) || 1
        },
        active: m.querySelector('#rec-active').checked
      };
      patch.nextRun = computeNextRun(new Date(), patch.schedule);
      update(_editingId, patch);
      _editingId = null;
      if (typeof showToast === 'function') showToast((typeof getTranslation === 'function' ? getTranslation('saved') : '已保存'), 'success');
      renderList();
    });
  }

  function openRecurring() {
    if (typeof _editingId !== 'undefined') _editingId = null;
    const m = ensureModal();
    renderList();
    if (typeof window.openModal === 'function') {
      try { window.openModal('recurring-modal'); } catch (e) { m.style.display = 'flex'; }
    } else {
      m.style.display = 'flex';
    }
  }

  // Public "save" entry point. Triggered by the static #save-recurring-btn
  // inside index.html. If the edit form is on screen, commit it; otherwise
  // start a new draft and open the form.
  function save() {
    const m = document.getElementById('recurring-modal');
    if (!m) {
      openRecurring();
      return true;
    }
    // If the edit form is on screen, commit it directly.
    const saveBtn = m.querySelector('#rec-save');
    if (saveBtn) {
      saveBtn.click();
      return true;
    }
    // No edit form open — start a new draft and open the form.
    const newRule = add({ name: (typeof getTranslation === 'function' ? getTranslation('newRecurringInvoice') : '新定期单据') });
    _editingId = newRule.id;
    showForm(newRule);
    return true;
  }

  function close() {
    try { closeModal('recurring-modal'); } catch (e) {
      const m = document.getElementById('recurring-modal');
      if (m) m.style.display = 'none';
    }
    _editingId = null;
  }

  // Auto-run on app start
  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', function () { setTimeout(runDue, 1500); });
  }

  global.Recurring = {
    list: list,
    get: get,
    add: add,
    update: update,
    remove: remove,
    runDue: runDue,
    computeNextRun: computeNextRun,
    open: openRecurring,
    close: close,
    save: save

  };
})(window);