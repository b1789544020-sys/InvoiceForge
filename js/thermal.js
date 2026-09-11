/**
 * InvoiceForge - Stage 2.1 Thermal Printer Module
 * Copyright (c) 2026 InvoiceForge. Licensed under the MIT License.
 */
(function (global) {
  'use strict';

  const PAPER = {
    a4:        { label_zh: 'A4 (210 mm)',  label_en: 'A4 (210 mm)',  width: '210mm', font: '11pt' },
    letter:    { label_zh: 'Letter',       label_en: 'Letter',       width: '216mm', font: '11pt' },
    thermal80: { label_zh: '80mm 热敏小票', label_en: '80mm Thermal', width: '80mm',  font: '9pt'  },
    thermal58: { label_zh: '58mm 热敏小票', label_en: '58mm Thermal', width: '58mm',  font: '8pt'  }
  };

  const AMP = String.fromCharCode(38) + 'amp;';
  const LT  = String.fromCharCode(38) + 'lt;';
  const GT  = String.fromCharCode(38) + 'gt;';
  const QUOT= String.fromCharCode(38) + 'quot;';
  const APOS= String.fromCharCode(38) + '#39;';

  function t(key, fallback) {
    try {
      if (typeof i18n !== 'undefined' && i18n && i18n.t) return i18n.t(key) || fallback;
    } catch (e) {}
    return fallback;
  }

  function effectiveOptions(opts) {
    // All paper sizes and copy counts are available.
    return Object.assign({ paper: 'a4', copies: 1 }, opts || {});
  }

  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s)
      .replace(/&/g, AMP)
      .replace(/</g, LT)
      .replace(/>/g, GT)
      .replace(/"/g, QUOT)
      .replace(/'/g, APOS);
  }

  function buildThermalHTML(doc, client, currency, settings) {
    if (!doc) return '';
    const items = (doc.items || []).map(function (it) {
      const sub = (Number(it.price) || 0) * (Number(it.quantity) || 0);
      return '<tr>' +
        '<td class="th-r-name">' + escapeHtml(it.name || '') + '</td>' +
        '<td class="th-r-num">' + (Number(it.quantity) || 0) + ' x ' + (Number(it.price) || 0).toFixed(2) + '</td>' +
        '<td class="th-r-sub">' + sub.toFixed(2) + '</td>' +
      '</tr>';
    }).join('');

    const total   = (doc.total   || 0).toFixed(2);
    const subtotal= (doc.subtotal|| 0).toFixed(2);
    const taxTot  = (doc.tax     || 0).toFixed(2);
    const cur     = currency || (settings && settings.currency) || '\u00A5';
    const dateStr = doc.date || '';
    const num     = doc.number || '';

    return '' +
      '<div class="th-header">' +
        '<div class="th-company">' + escapeHtml((settings && settings.companyName) || 'InvoiceForge') + '</div>' +
        (settings && settings.companyAddress ? '<div class="th-addr">' + escapeHtml(settings.companyAddress) + '</div>' : '') +
        (settings && settings.companyPhone ? '<div class="th-phone">' + escapeHtml(settings.companyPhone) + '</div>' : '') +
      '</div>' +
      '<div class="th-sep">--------------------------------</div>' +
      '<div class="th-row"><span>' + t('thermalInvoice', '\u53D1\u7968') + ' #' + escapeHtml(num) + '</span><span>' + escapeHtml(dateStr) + '</span></div>' +
      '<div class="th-row"><span>' + t('thermalClient', '\u5BA2\u6237') + ': ' + escapeHtml((client && client.name) || '') + '</span></div>' +
      '<div class="th-sep">--------------------------------</div>' +
      '<table class="th-table">' + items + '</table>' +
      '<div class="th-sep">--------------------------------</div>' +
      '<div class="th-row"><span>' + t('thermalSubtotal', '\u5C0F\u8BA1') + '</span><span>' + cur + ' ' + subtotal + '</span></div>' +
      '<div class="th-row"><span>' + t('thermalTax', '\u7A0E') + '</span><span>' + cur + ' ' + taxTot + '</span></div>' +
      '<div class="th-row th-total"><span>' + t('thermalTotal', '\u5408\u8BA1') + '</span><span>' + cur + ' ' + total + '</span></div>' +
      '<div class="th-sep">--------------------------------</div>' +
      '<div class="th-footer">' + t('thermalThanks', '\u611F\u8C22\u60E0\u987E\uFF01') + '</div>';
  }

  function applyPaperClass(paper, copies) {
    const b = document.body;
    Object.keys(PAPER).forEach(function (k) { b.classList.remove('paper-' + k); });
    b.classList.add('paper-' + paper);
    b.dataset.printPaper = paper;
    b.dataset.printCopies = String(Math.max(1, Math.min(99, Number(copies || 1))));
  }

  function clearPaperClass() {
    const b = document.body;
    Object.keys(PAPER).forEach(function (k) { b.classList.remove('paper-' + k); });
    delete b.dataset.printPaper;
    delete b.dataset.printCopies;
  }

  function doPrint(opts) {
    const o = effectiveOptions(opts);
    applyPaperClass(o.paper, o.copies);
    try {
      const before = window.onafterprint;
      window.onafterprint = function () { clearPaperClass(); window.onafterprint = before; };
      setTimeout(function () { window.print(); }, 50);
    } catch (e) {
      clearPaperClass();
      throw e;
    }
  }

  function openPrintDialog() {
    const modalId = 'print-options-modal';
    if (document.getElementById(modalId)) {
      openModal(modalId);
      return;
    }
    const wrap = document.createElement('div');
    wrap.innerHTML = renderPrintModal();
    document.body.appendChild(wrap.firstChild);

    document.querySelectorAll('.close-print-options-modal').forEach(function (el) {
      el.addEventListener('click', function () { closeModal(modalId); });
    });

    const sel = document.getElementById('thermal-paper');
    const cpy = document.getElementById('thermal-copies');
    document.getElementById('thermal-print-btn').addEventListener('click', function () {
      doPrint({ paper: sel.value, copies: Number(cpy.value || 1) });
      closeModal(modalId);
    });
    openModal(modalId);
  }

  function getCurrentLang() {
    try {
      if (typeof i18n !== 'undefined' && i18n && i18n.getLang) return i18n.getLang();
    } catch (e) {}
    try { return localStorage.getItem('if_lang') || 'zh'; } catch (e) {}
    return 'zh';
  }

  function renderPrintModal() {
    const opts = ['a4', 'letter', 'thermal80', 'thermal58'].map(function (k) {
      const p = PAPER[k];
      const label = (getCurrentLang() === 'en') ? p.label_en : p.label_zh;
      return '<option value="' + k + '">' + label + '</option>';
    }).join('');
    const cancel = t('cancel', '\u53D6\u6D88');
    const title  = t('thermalTitle', '\u6253\u5370\u8BBE\u7F6E');
    const lblPaper = t('thermalPaperSize', '\u7EB8\u5F20\u5C3A\u5BF8');
    const lblCopies = t('thermalCopies', '\u6253\u5370\u4EFD\u6570');
    const lblBtn  = t('thermalPrintBtn', '\u5F00\u59CB\u6253\u5370');
    const lblHint = t('thermalHint', '\u70ED\u654F\u6A21\u5F0F\u9002\u914D 80mm / 58mm \u6536\u94F6\u5C0F\u7968\uFF1BA4 / Letter \u4E3A\u6807\u51C6\u6253\u5370\u3002');

    return '' +
      '<div id="print-options-modal" class="modal">' +
        '<div class="modal-content max-w-md">' +
          '<div class="modal-header">' +
            '<h2 class="text-xl font-semibold">' + title + '</h2>' +
            '<span class="modal-close close-print-options-modal">&times;</span>' +
          '</div>' +
          '<div class="modal-body">' +
            '<div class="mb-4">' +
              '<label class="block text-gray-700 text-sm font-bold mb-2">' + lblPaper + '</label>' +
              '<select id="thermal-paper" class="shadow border rounded w-full py-2 px-3 text-gray-700">' + opts + '</select>' +
            '</div>' +
            '<div class="mb-4">' +
              '<label class="block text-gray-700 text-sm font-bold mb-2">' + lblCopies + '</label>' +
              '<input id="thermal-copies" type="number" min="1" max="99" value="1" class="shadow border rounded w-full py-2 px-3 text-gray-700">' +
            '</div>' +
            '<p class="text-sm text-gray-500">' + lblHint + '</p>' +
          '</div>' +
          '<div class="modal-footer">' +
            '<button class="close-print-options-modal bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded-lg">' + cancel + '</button>' +
            '<button id="thermal-print-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">' +
              '<i class="fa fa-print mr-1"></i> ' + lblBtn +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  global.ThermalPrint = {
    PAPER: PAPER,
    effectiveOptions: effectiveOptions,
    doPrint: doPrint,
    openPrintDialog: openPrintDialog,
    buildThermalHTML: buildThermalHTML,
    applyPaperClass: applyPaperClass,
    clearPaperClass: clearPaperClass
  };
})(window);