/* ================================================================
 *  reminders.js  ——  Stage 1.3 逾期提醒
 *  浏览器通知（Notification API） + 站内 toast 双重降级
 *  三桶分桶：overdue / upcoming / lowStock
 *  依赖：localStorage 数据结构 (invoice_documents / inventory_items)
 *        t()    i18n.js   函数（与 app.js 同源）
 *        showToast()    app.js 全局函数（如未暴露则降级 alert）
 *  注册时机：app.js 的 DOMContentLoaded 调 startReminderScheduler()
 * ================================================================ */
(function (global) {
  'use strict';

  // ---------- 内部工具 ----------
  const NS = 'invoiceforge.reminders.';

  const LS = {
    get settings()  { return JSON.parse(localStorage.getItem(NS + 'settings')  || '{}'); },
    set settings(v) { localStorage.setItem(NS + 'settings',  JSON.stringify(v)); },
    get snoozed()   { return JSON.parse(localStorage.getItem(NS + 'snoozed')   || '{}'); },
    set snoozed(v)  { localStorage.setItem(NS + 'snoozed',   JSON.stringify(v)); },
    get lastFired() { return JSON.parse(localStorage.getItem(NS + 'lastFired') || '{}'); },
    set lastFired(v){ localStorage.setItem(NS + 'lastFired', JSON.stringify(v)); },
  };

  const todayISO = () => new Date().toISOString().slice(0, 10);

  const dueIn = (dueStr) => {
    if (!dueStr) return null;
    const d = new Date(dueStr);
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.round((d - today) / 86400000);
  };

  // ---------- 数据源 ----------
  function getDocuments() {
    try { return JSON.parse(localStorage.getItem('invoice_documents') || '[]'); }
    catch (e) { return []; }
  }
  function getInventory() {
    try { return JSON.parse(localStorage.getItem('invoice_inventory') || '[]'); }
    catch (e) { return []; }
  }

  // ---------- 通知呈现（Notification + toast 降级） ----------
  function canNotify() {
    return 'Notification' in global && Notification.permission === 'granted';
  }
  function showToast(title, body) {
    // 优先用 app.js 暴露的全局 showToast
    if (typeof global.showToast === 'function') {
      global.showToast({ title: title, body: body, type: 'reminder' });
      return;
    }
    // 否则降级到页面顶部 banner
    let bar = document.getElementById('reminder-toast-fallback');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'reminder-toast-fallback';
      bar.style.cssText =
        'position:fixed;top:12px;right:12px;z-index:9999;max-width:360px;' +
        'background:#fff8e1;border:1px solid #f0b400;border-radius:6px;' +
        'padding:10px 14px;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.15);';
      document.body.appendChild(bar);
    }
    const item = document.createElement('div');
    item.style.cssText = 'margin:4px 0;line-height:1.4;';
    item.innerHTML = '<strong></strong> <span></span>';
    item.querySelector('strong').textContent = title;
    item.querySelector('span').textContent   = body;
    bar.appendChild(item);
    setTimeout(() => { if (item.parentNode) item.parentNode.removeChild(item); }, 8000);
  }

  function showReminder(bucket, count, extra) {
    const t = (k) => (typeof t_i18n === 'function' ? t_i18n(k) : k);
    const titleMap = {
      overdue:  t('reminderOverdueTitle'),
      upcoming: t('reminderUpcomingTitle'),
      lowStock: t('reminderLowStockTitle'),
    };
    const bodyMap = {
      overdue:  t('reminderOverdueBody')(count),
      upcoming: t('reminderUpcomingBody')(count, extra || 3),
      lowStock: t('reminderLowStockBody')(count),
    };
    const title = titleMap[bucket];
    const body  = bodyMap[bucket];

    if (canNotify()) {
      try {
        const n = new Notification(title, { body: body, tag: 'if-reminder-' + bucket });
        n.onclick = () => { global.focus(); window.close(); };
        return;
      } catch (e) { /* fall through */ }
    }
    showToast(title, body);
  }

  // ---------- 分桶 ----------
  function computeBuckets() {
    const docs = getDocuments();
    const inv  = getInventory();
    const snoozed = LS.snoozed;
    const today = todayISO();

    const overdue  = [];
    const upcoming = [];
    const lowStock = [];

    for (const d of docs) {
      if (d.status === 'paid') continue;
      if (!d.dueDate) continue;
      if (snoozed[d.id] === today) continue;
      const days = dueIn(d.dueDate);
      if (days === null) continue;
      if (days < 0)        overdue.push(d);
      else if (days <= 7)  upcoming.push(d);
    }
    for (const it of inv) {
      const stock = Number(it.stock || 0);
      const thr   = Number(it.lowStockThreshold ?? it.threshold ?? 0);
      if (thr > 0 && stock <= thr) lowStock.push(it);
    }
    return { overdue, upcoming, lowStock };
  }

  // ---------- 单桶检测（防重复：每天每桶最多弹一次） ----------
  function checkBucket(name, items, extra) {
    if (!items.length) return;
    const last = LS.lastFired;
    const today = todayISO();
    if (last[name] === today) return; // 今天已弹过
    showReminder(name, items.length, extra);
    last[name] = today;
    LS.lastFired = last;
  }

  // ---------- snooze ----------
  function snoozeToday(docId) {
    const s = LS.snoozed;
    s[docId] = todayISO();
    LS.snoozed = s;
  }

  // ---------- 调度器 ----------
  let _timer = null;
  const TICK_MS = 60 * 60 * 1000; // 1 小时一查

  function checkNow() {
    if (!_enabled()) return;
    const { overdue, upcoming, lowStock } = computeBuckets();
    checkBucket('overdue',  overdue);
    checkBucket('upcoming', upcoming, 3);
    checkBucket('lowStock', lowStock);
  }

  function _enabled() {
    const s = LS.settings;
    return s.enabled !== false; // 默认开启
  }

  function startReminderScheduler() {
    // 请求权限一次（用户未拒绝时静默请求）
    if ('Notification' in global && Notification.permission === 'default') {
      try { Notification.requestPermission().catch(() => {}); } catch (e) { /* noop */ }
    }
    // 立即跑一次
    setTimeout(checkNow, 2500);
    if (_timer) clearInterval(_timer);
    _timer = setInterval(checkNow, TICK_MS);
  }
  function stopReminderScheduler() {
    if (_timer) { clearInterval(_timer); _timer = null; }
  }

  // ---------- 暴露 ----------
  const ReminderEngine = {
    computeBuckets, checkNow, snoozeToday,
    startReminderScheduler,
    stopReminderScheduler,
    start: startReminderScheduler,
    stop:  stopReminderScheduler,
    _showReminder: showReminder,   // 测试入口
  };
  global.ReminderEngine = ReminderEngine;
  global.startReminderScheduler = startReminderScheduler;
  global.stopReminderScheduler  = stopReminderScheduler;

})(window);