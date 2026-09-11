/**
 * InvoiceForge — 版本快照（Version Snapshots）
 *
 * 每次保存单据时自动创建一个版本快照（最多保留 50 个）。
 * 用户可查看、恢复、对比任意历史版本。
 *
 * 数据结构：
 *   invoiceforge.snapshots = {
 *     [docId]: [
 *       { id, timestamp, label, snapshot: { full doc clone } },
 *       ...
 *     ]
 *   }
 *
 * API：
 *   Snapshots.record(doc, label)        创建快照，返回 snapshot id
 *   Snapshots.listFor(docId)            获取某单据所有快照（按时间倒序）
 *   Snapshots.get(snapshotId)           获取某个快照
 *   Snapshots.restore(snapshotId)       恢复某个快照（写入 docs 数组）
 *   Snapshots.remove(snapshotId)        删除某个快照
 *   Snapshots.clearFor(docId)           清空某个单据的所有快照
 *   Snapshots.compare(snapA, snapB)     对比两个快照，返回差异（字段级）
 */
(function (global) {
  'use strict';

  const STORE_KEY = 'invoiceforge.snapshots';
  const MAX_PER_DOC = 50;

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function save(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function uid() {
    return 'snap_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function record(doc, label) {
    if (!doc || !doc.id) return null;
    const all = load();
    if (!all[doc.id]) all[doc.id] = [];
    const snap = {
      id: uid(),
      timestamp: new Date().toISOString(),
      label: label || 'auto',
      snapshot: JSON.parse(JSON.stringify(doc))   // deep clone
    };
    all[doc.id].unshift(snap);
    // Trim
    if (all[doc.id].length > MAX_PER_DOC) {
      all[doc.id] = all[doc.id].slice(0, MAX_PER_DOC);
    }
    save(all);
    try { window.dispatchEvent(new CustomEvent('document:snapshot-created', { detail: { docId: doc.id, snapshot: snap } })); } catch (e) {}
    return snap.id;
  }

  function listFor(docId) {
    const all = load();
    return (all[docId] || []).slice();
  }

  function get(snapshotId) {
    const all = load();
    for (const docId in all) {
      const found = all[docId].find(function (s) { return s.id === snapshotId; });
      if (found) return Object.assign({ docId: docId }, found);
    }
    return null;
  }

  function restore(snapshotId) {
    const found = get(snapshotId);
    if (!found) return false;
    const docs = JSON.parse(localStorage.getItem('invoiceforge_documents') || '[]');
    const idx = docs.findIndex(function (d) { return d.id === found.docId; });
    if (idx < 0) return false;
    // Restore — but keep id, set updatedAt
    const snap = Object.assign({}, found.snapshot);
    snap.id = found.docId;
    snap.updatedAt = new Date().toISOString();
    snap.restoredFrom = snapshotId;
    docs[idx] = snap;
    localStorage.setItem('invoiceforge_documents', JSON.stringify(docs));
    // record a new snapshot for the restore itself
    record(snap, 'restored from ' + snapshotId);
    try { window.dispatchEvent(new CustomEvent('document:restored', { detail: { docId: found.docId, snapshotId: snapshotId } })); } catch (e) {}
    return true;
  }

  function remove(snapshotId) {
    const all = load();
    for (const docId in all) {
      const idx = all[docId].findIndex(function (s) { return s.id === snapshotId; });
      if (idx >= 0) {
        all[docId].splice(idx, 1);
        save(all);
        return true;
      }
    }
    return false;
  }

  function clearFor(docId) {
    const all = load();
    if (all[docId]) {
      delete all[docId];
      save(all);
    }
  }

  // Simple field-level diff
  function compare(snapA, snapB) {
    if (!snapA || !snapB) return [];
    const a = snapA.snapshot || {};
    const b = snapB.snapshot || {};
    const keys = new Set();
    Object.keys(a).forEach(function (k) { keys.add(k); });
    Object.keys(b).forEach(function (k) { keys.add(k); });
    const diffs = [];
    keys.forEach(function (k) {
      const va = JSON.stringify(a[k]);
      const vb = JSON.stringify(b[k]);
      if (va !== vb) {
        diffs.push({ key: k, before: a[k], after: b[k] });
      }
    });
    return diffs;
  }

  // ===== UI: Snapshots Panel =====
  let _currentDocId = null;

  function ensureModal() {
    let m = document.getElementById('snapshots-modal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'snapshots-modal';
    m.className = 'modal';
    m.innerHTML = [
      '<div class="modal-content max-w-3xl">',
      '  <div class="modal-header">',
      '    <h2 class="text-xl font-bold">版本快照 <span class="ml-2 text-xs px-2 py-0.5 rounded-full" style="background:linear-gradient(90deg,#f59e0b,#ef4444);color:#fff;">PRO</span></h2>',
      '    <span class="modal-close close-snapshots-modal">&times;</span>',
      '  </div>',
      '  <div class="modal-body">',
      '    <div class="flex justify-between items-center mb-3">',
      '      <p class="text-sm text-gray-600">每次保存单据都会自动创建快照。最多保留 50 个。</p>',
      '      <button type="button" id="snap-create-btn" class="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded">立即创建快照</button>',
      '    </div>',
      '    <div id="snap-list" class="space-y-2"></div>',
      '  </div>',
      '  <div class="modal-footer">',
      '    <button type="button" class="close-snapshots-modal bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded-lg">关闭</button>',
      '  </div>',
      '</div>'
    ].join('\n');
    document.body.appendChild(m);
    m.querySelector('.close-snapshots-modal').addEventListener('click', close);
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    m.querySelector('#snap-create-btn').addEventListener('click', function () {
      const docs = JSON.parse(localStorage.getItem('invoiceforge_documents') || '[]');
      const doc = docs.find(function (d) { return d.id === _currentDocId; });
      if (doc) {
        record(doc, 'manual');
        if (typeof showToast === 'function') showToast('快照已创建', 'success');
        renderList();
      }
    });
    return m;
  }

  function renderList() {
    const m = document.getElementById('snapshots-modal');
    const list = m.querySelector('#snap-list');
    const items = listFor(_currentDocId);
    if (!items.length) {
      list.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">暂无快照</p>';
      return;
    }
    list.innerHTML = items.map(function (s) {
      const date = new Date(s.timestamp).toLocaleString();
      const labelEsc = (s.label || '').replace(/[<>&"']/g, function (c) { return { '<':'<','>':'>','&':'&','"':'"',"'":'&#39;' }[c]; });
      return [
        '<div class="flex justify-between items-center p-3 border rounded" style="background:#fafafa;">',
        '  <div>',
        '    <div class="text-sm font-medium">' + date + '</div>',
        '    <div class="text-xs text-gray-500">' + labelEsc + '</div>',
        '  </div>',
        '  <div class="flex gap-2">',
        '    <button type="button" class="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded" data-snap-restore="' + s.id + '">恢复</button>',
        '    <button type="button" class="text-sm bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded" data-snap-delete="' + s.id + '">删除</button>',
        '  </div>',
        '</div>'
      ].join('');
    }).join('');
    list.querySelectorAll('[data-snap-restore]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('确定恢复到这个版本吗？当前状态会自动创建为快照。')) return;
        const id = btn.getAttribute('data-snap-restore');
        if (restore(id)) {
          if (typeof showToast === 'function') showToast('已恢复', 'success');
          try { if (typeof renderDocuments === 'function') renderDocuments(); } catch (e) {}
          close();
        }
      });
    });
    list.querySelectorAll('[data-snap-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('确定删除这个快照吗？')) return;
        const id = btn.getAttribute('data-snap-delete');
        if (remove(id)) renderList();
      });
    });
  }

  function open(documentId) {
    _currentDocId = documentId;
    const m = ensureModal();
    renderList();
    try { openModal('snapshots-modal'); } catch (e) { m.style.display = 'flex'; }
  }

  function close() {
    try { closeModal('snapshots-modal'); } catch (e) {
      const m = document.getElementById('snapshots-modal');
      if (m) m.style.display = 'none';
    }
    _currentDocId = null;
  }

  // Auto-record on save
  if (typeof window !== 'undefined') {
    window.addEventListener('document:saved', function (e) {
      const doc = (e && e.detail && e.detail.doc) || null;
      if (doc) record(doc, 'auto');
    });
  }

  global.Snapshots = {
    record: record,
    listFor: listFor,
    get: get,
    restore: restore,
    remove: remove,
    clearFor: clearFor,
    compare: compare,
    open: open,
    close: close

  };
})(window);