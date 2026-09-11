/**
 * InvoiceForge — Pro 高级报表（Advanced Reports）
 *
 * 业务分析仪表板：
 *   - 收入概览（本月/本季/本年/全部）
 *   - 按月趋势折线（用 CSS/SVG 绘制）
 *   - 按客户排行 TOP N
 *   - 按状态分布（已付/待付/逾期）
 *   - 按类型（发票/报价单/收据）
 *   - 平均回款天数
 *   - 导出 CSV
 *
 * API：
 *   Reports.open()             打开报表面板
 *   Reports.compute()          计算并返回所有指标
 *   Reports.exportCSV()        导出当前数据为 CSV
 */
(function (global) {
  'use strict';

  function loadDocs() {
    try { return JSON.parse(localStorage.getItem('invoiceforge_documents') || '[]'); }
    catch (e) { return []; }
  }

  function inRange(dateStr, start, end) {
    if (!dateStr) return false;
    const t = new Date(dateStr).getTime();
    if (isNaN(t)) return false;
    if (start && t < start.getTime()) return false;
    if (end && t > end.getTime()) return false;
    return true;
  }

  function rangeOf(period) {
    const now = new Date();
    if (period === 'month') {
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    } else if (period === 'quarter') {
      const q = Math.floor(now.getMonth() / 3) * 3;
      return { start: new Date(now.getFullYear(), q, 1), end: now };
    } else if (period === 'year') {
      return { start: new Date(now.getFullYear(), 0, 1), end: now };
    } else if (period === 'last12') {
      return { start: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()), end: now };
    }
    return { start: null, end: null };
  }

  function docTotal(doc) {
    if (typeof doc.total !== 'undefined') return Number(doc.total) || 0;
    if (Array.isArray(doc.items)) {
      return doc.items.reduce(function (s, it) {
        return s + (Number(it.amount) || (Number(it.quantity) || 0) * (Number(it.price) || 0));
      }, 0);
    }
    return Number(doc.amount) || 0;
  }

  function compute(period) {
    period = period || 'all';
    const r = rangeOf(period);
    const docs = loadDocs().filter(function (d) {
      if (period === 'all') return true;
      return inRange(d.createdAt || d.date || d.issueDate, r.start, r.end);
    });

    const byStatus = { paid: 0, pending: 0, overdue: 0, draft: 0, other: 0 };
    const byType = { invoice: 0, quote: 0, receipt: 0, other: 0 };
    const byClient = {};          // clientName -> { count, total, paid }
    const byMonth = {};            // 'YYYY-MM' -> total
    let totalRevenue = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let paidCount = 0;
    let paidDocCount = 0;
    let daysToPaySum = 0;
    let daysToPayN = 0;

    const now = Date.now();

    docs.forEach(function (d) {
      const total = docTotal(d);
      // status
      let s = d.status || 'pending';
      if (s === 'paid' && d.dueDate && new Date(d.paidAt || d.updatedAt || d.createdAt).getTime() > new Date(d.dueDate).getTime()) {
        // still counts as paid (paid late), not overdue
      }
      if (s !== 'paid' && s !== 'pending' && s !== 'overdue' && s !== 'draft') s = 'other';
      if (s === 'pending' && d.dueDate && new Date(d.dueDate).getTime() < now) s = 'overdue';
      byStatus[s] = (byStatus[s] || 0) + total;

      // type
      const t = d.type || 'invoice';
      if (byType[t] === undefined) byType.other = (byType.other || 0) + total;
      else byType[t] += total;

      // client
      const cName = d.clientName || (d.client && d.client.name) || '未指定客户';
      if (!byClient[cName]) byClient[cName] = { count: 0, total: 0, paid: 0 };
      byClient[cName].count += 1;
      byClient[cName].total += total;
      if (s === 'paid') {
        byClient[cName].paid += total;
        totalPaid += total;
        paidCount += total;
        paidDocCount += 1;
        // days to pay
        if (d.paidAt && d.createdAt) {
          const days = (new Date(d.paidAt).getTime() - new Date(d.createdAt).getTime()) / (24 * 3600 * 1000);
          if (isFinite(days) && days >= 0) {
            daysToPaySum += days;
            daysToPayN += 1;
          }
        }
      } else {
        totalOutstanding += total;
      }
      totalRevenue += total;

      // month bucket
      const dt = d.createdAt || d.date || d.issueDate;
      if (dt) {
        const dd = new Date(dt);
        const key = dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0');
        byMonth[key] = (byMonth[key] || 0) + total;
      }
    });

    // sort clients
    const topClients = Object.keys(byClient)
      .map(function (k) { return Object.assign({ name: k }, byClient[k]); })
      .sort(function (a, b) { return b.total - a.total; })
      .slice(0, 10);

    // sort months
    const months = Object.keys(byMonth).sort();
    const monthSeries = months.map(function (m) { return { month: m, total: byMonth[m] }; });

    const avgDaysToPay = daysToPayN > 0 ? (daysToPaySum / daysToPayN) : 0;

    return {
      period: period,
      docCount: docs.length,
      totalRevenue: totalRevenue,
      totalPaid: totalPaid,
      totalOutstanding: totalOutstanding,
      avgDaysToPay: avgDaysToPay,
      paidRate: docs.length > 0 ? (paidDocCount / docs.length) : 0,
      byStatus: byStatus,
      byType: byType,
      topClients: topClients,
      monthSeries: monthSeries
    };
  }

  function fmt(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '0';
    return n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  }

  function renderBars(series, valueKey, max) {
    max = max || series.reduce(function (m, x) { return Math.max(m, x[valueKey]); }, 1) || 1;
    return series.map(function (s) {
      const w = Math.max(2, (s[valueKey] / max) * 100);
      const label = s.month || s.name;
      return [
        '<div class="text-xs text-gray-600" style="width:60px;">' + label + '</div>',
        '<div class="flex-1 bg-gray-200 rounded h-4 relative">',
        '  <div class="rounded h-4" style="width:' + w + '%;background:linear-gradient(90deg,#3b82f6,#8b5cf6);"></div>',
        '  <span class="absolute right-1 top-0 text-[10px] leading-4 text-gray-700">' + fmt(s[valueKey]) + '</span>',
        '</div>'
      ].join('');
    }).join('<div class="flex items-center gap-2 mb-1"></div>');
  }

  function renderModal(data) {
    let m = document.getElementById('reports-modal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'reports-modal';
      m.className = 'modal';
      document.body.appendChild(m);
    }
    const maxByMonth = data.monthSeries.reduce(function (m, x) { return Math.max(m, x.total); }, 1) || 1;
    m.innerHTML = [
      '<div class="modal-content max-w-4xl">',
      '  <div class="modal-header">',
      '    <h2 class="text-xl font-bold" data-i18n="reports">高级报表 <span class="ml-2 text-xs px-2 py-0.5 rounded-full" style="background:linear-gradient(90deg,#f59e0b,#ef4444);color:#fff;">PRO</span></h2>',
      '    <span class="modal-close close-reports-modal">&times;</span>',
      '  </div>',
      '  <div class="modal-body">',
      '    <div class="flex gap-2 mb-4">',
      '      <button type="button" data-period="month" class="text-sm px-3 py-1 rounded bg-blue-600 text-white" data-i18n="periodMonth">本月</button>',
      '      <button type="button" data-period="quarter" class="text-sm px-3 py-1 rounded bg-gray-200" data-i18n="periodQuarter">本季</button>',
      '      <button type="button" data-period="year" class="text-sm px-3 py-1 rounded bg-gray-200" data-i18n="periodYear">本年</button>',
      '      <button type="button" data-period="last12" class="text-sm px-3 py-1 rounded bg-gray-200" data-i18n="periodLast12">近12月</button>',
      '      <button type="button" data-period="all" class="text-sm px-3 py-1 rounded bg-gray-200" data-i18n="periodAll">全部</button>',
      '      <button type="button" id="reports-csv" class="ml-auto text-sm px-3 py-1 rounded bg-green-600 text-white" data-i18n="exportCSV">导出 CSV</button>',
      '    </div>',
      '    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">',
      '      <div class="p-3 rounded border" style="background:#f0f9ff;">',
      '        <div class="text-xs text-gray-500" data-i18n="reportTotalRevenue">总收入</div>',
      '        <div class="text-2xl font-bold text-blue-700">' + fmt(data.totalRevenue) + '</div>',
      '      </div>',
      '      <div class="p-3 rounded border" style="background:#f0fdf4;">',
      '        <div class="text-xs text-gray-500" data-i18n="reportTotalPaid">已收</div>',
      '        <div class="text-2xl font-bold text-green-700">' + fmt(data.totalPaid) + '</div>',
      '      </div>',
      '      <div class="p-3 rounded border" style="background:#fef3c7;">',
      '        <div class="text-xs text-gray-500" data-i18n="reportOutstanding">未收</div>',
      '        <div class="text-2xl font-bold text-amber-700">' + fmt(data.totalOutstanding) + '</div>',
      '      </div>',
      '      <div class="p-3 rounded border" style="background:#fce7f3;">',
      '        <div class="text-xs text-gray-500" data-i18n="reportAvgDaysToPay">平均回款天数</div>',
      '        <div class="text-2xl font-bold text-pink-700">' + fmt(data.avgDaysToPay) + '</div>',
      '      </div>',
      '    </div>',
      '    <div class="mb-4">',
      '      <h3 class="text-sm font-bold mb-2" data-i18n="reportMonthlyTrend">月度收入趋势</h3>',
      '      ' + (data.monthSeries.length
        ? '<div class="space-y-1">' + renderBars(data.monthSeries, 'total', maxByMonth) + '</div>'
        : '<p class="text-sm text-gray-500" data-i18n="reportNoData">暂无数据</p>'),
      '    </div>',
      '    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">',
      '      <div>',
      '        <h3 class="text-sm font-bold mb-2" data-i18n="reportByStatus">按状态分布</h3>',
      '        <table class="w-full text-sm">',
      '          <tbody>',
      '            <tr><td data-i18n="paid">已付</td><td class="text-right font-mono">' + fmt(data.byStatus.paid) + '</td></tr>',
      '            <tr><td data-i18n="pending">待付</td><td class="text-right font-mono">' + fmt(data.byStatus.pending) + '</td></tr>',
      '            <tr><td data-i18n="overdueStatus">逾期</td><td class="text-right font-mono text-red-600">' + fmt(data.byStatus.overdue) + '</td></tr>',
      '            <tr><td data-i18n="draft">草稿</td><td class="text-right font-mono">' + fmt(data.byStatus.draft) + '</td></tr>',
      '            <tr><td data-i18n="reportStatusOther">其他</td><td class="text-right font-mono">' + fmt(data.byStatus.other || 0) + '</td></tr>',
      '          </tbody>',
      '        </table>',
      '      </div>',
      '      <div>',
      '        <h3 class="text-sm font-bold mb-2" data-i18n="reportTopClients">TOP 客户</h3>',
      '        ' + (data.topClients.length
        ? '<table class="w-full text-sm"><thead><tr><th class="text-left" data-i18n="client">客户</th><th class="text-right" data-i18n="qty">数量</th><th class="text-right" data-i18n="amount">总额</th></tr></thead><tbody>' +
            data.topClients.map(function (c) {
              return '<tr><td>' + (c.name || '') + '</td><td class="text-right">' + c.count + '</td><td class="text-right font-mono">' + fmt(c.total) + '</td></tr>';
            }).join('') +
          '</tbody></table>'
        : '<p class="text-sm text-gray-500" data-i18n="reportNoClientData">暂无客户数据</p>'),
      '      </div>',
      '    </div>',
      '  </div>',
      '  <div class="modal-footer">',
      '    <button type="button" class="close-reports-modal bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded-lg" data-i18n="close">关闭</button>',
      '  </div>',
      '</div>'
    ].join('\n');
    // Translate every data-i18n node we just inserted (modal is new DOM).
    if (typeof updateTranslations === 'function') updateTranslations();

    m.querySelectorAll('[data-period]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const p = btn.getAttribute('data-period');
        m.querySelectorAll('[data-period]').forEach(function (b) {
          b.classList.remove('bg-blue-600', 'text-white');
          b.classList.add('bg-gray-200');
        });
        btn.classList.remove('bg-gray-200');
        btn.classList.add('bg-blue-600', 'text-white');
        renderModal(compute(p));
      });
    });
    m.querySelector('#reports-csv').addEventListener('click', function () {
      exportCSV();
    });
    m.querySelectorAll('.close-reports-modal').forEach(function (el) {
      el.addEventListener('click', close);
    });
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
  }

  function open() {
    const data = compute('month');
    renderModal(data);
    const m = document.getElementById('reports-modal');
    if (typeof window.openModal === 'function') {
      try { window.openModal('reports-modal'); } catch (e) { m.style.display = 'flex'; }
    } else {
      m.style.display = 'flex';
    }
  }

  function close() {
    try { closeModal('reports-modal'); } catch (e) {
      const m = document.getElementById('reports-modal');
      if (m) m.style.display = 'none';
    }
  }

  function csvEscape(s) {
    s = (s === null || s === undefined) ? '' : String(s);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function exportCSV() {
    const docs = loadDocs();
    const header = ['编号', '日期', '客户', '类型', '状态', '金额', '到期日', '备注'];
    const lines = [header.join(',')];
    docs.forEach(function (d) {
      lines.push([
        csvEscape(d.number || d.id || ''),
        csvEscape(d.createdAt || d.date || ''),
        csvEscape(d.clientName || ''),
        csvEscape(d.type || ''),
        csvEscape(d.status || ''),
        csvEscape(docTotal(d)),
        csvEscape(d.dueDate || ''),
        csvEscape(d.notes || '')
      ].join(','));
    });
    const csv = lines.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoiceforge_export_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 100);
    if (typeof showToast === 'function') showToast('已导出 CSV', 'success');
  }

  global.Reports = {
    open: open,
    close: close,
    compute: compute,
    exportCSV: exportCSV

  };
})(window);