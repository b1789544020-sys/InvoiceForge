// Main application logic for InvoiceForge

// Utility functions
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      container.removeChild(toast);
    }, 300);
  }, 3000);
}

function formatCurrency(amount, currency) {
  if (!currency) {
    currency = getDefaultCurrency();
  }
  // Guard against undefined/null/non-numeric values so the UI never shows "NaN".
  const n = Number(amount);
  return currency + ' ' + (Number.isFinite(n) ? n : 0).toFixed(2);
}

function getDefaultCurrency() {
  const settings = getSettings();
  return settings.defaultCurrency || '¥';
}

function getSettings() {
  return JSON.parse(localStorage.getItem('invoiceforge_settings') || '{}');
}

function saveSettings(settings) {
  localStorage.setItem('invoiceforge_settings', JSON.stringify(settings));
}

function getDocuments() {
  return JSON.parse(localStorage.getItem('invoiceforge_documents') || '[]');
}

function saveDocuments(documents) {
  localStorage.setItem('invoiceforge_documents', JSON.stringify(documents));
}

function getClients() {
  return JSON.parse(localStorage.getItem('invoiceforge_clients') || '[]');
}

function saveClients(clients) {
  localStorage.setItem('invoiceforge_clients', JSON.stringify(clients));
}

function getProducts() {
  return JSON.parse(localStorage.getItem('invoiceforge_products') || '[]');
}

function saveProducts(products) {
  localStorage.setItem('invoiceforge_products', JSON.stringify(products));
}

function generateDocumentTypeTranslate(type) {
  const types = {
    invoice: getTranslation('invoice'),
    quote: getTranslation('quote'),
    receipt: getTranslation('receipt'),
    purchase: getTranslation('purchase'),
    proforma: getTranslation('proforma'),
    credit: getTranslation('credit')
  };
  return types[type] || type;
}

function getStatusName(status) {
  if (status === 'paid') return getTranslation('paid');
  if (status === 'pending') {
    return getTranslation('pending');
  }
  if (status === 'overdue') return getTranslation('overdueStatus');
  return getTranslation('draft');
}

function getStatusClass(status) {
  if (status === 'paid') return 'status-paid';
  if (status === 'pending') return 'status-pending';
  if (status === 'overdue') return 'status-overdue';
  return 'status-draft';
}

function checkDocumentStatus(document) {
  if (document.status === 'paid') return 'paid';
  if (!document.dueDate) return 'pending';
  
  const dueDate = new Date(document.dueDate);
  const today = new Date();
  if (dueDate < today && document.status !== 'paid') {
    return 'overdue';
  }
  return document.status || 'pending';
}

// Initialize everything when DOM loads
document.addEventListener('DOMContentLoaded', function() {
  // Set initial language
  try { setLanguage(getCurrentLanguage()); } catch(e) { console.error('setLanguage failed:', e); }
  try { document.getElementById('language-switcher').value = getCurrentLanguage(); } catch(e) {}
  
  // Load company settings
  try {
    const settings = getSettings();
    if (settings.companyName) {
      document.getElementById('company-name').value = settings.companyName || '';
      document.getElementById('company-email').value = settings.companyEmail || '';
      document.getElementById('company-phone').value = settings.companyPhone || '';
      document.getElementById('company-address').value = settings.companyAddress || '';
      document.getElementById('company-tax-id').value = settings.companyTaxId || '';
      document.getElementById('default-currency').value = settings.defaultCurrency || '¥';
      document.getElementById('default-tax-rate').value = settings.defaultTaxRate || 13;
      document.getElementById('payment-terms').value = settings.paymentTerms || 30;
      
      if (settings.companyLogo) {
        const preview = document.getElementById('logo-preview');
        const img = document.createElement('img');
        img.src = settings.companyLogo;
        img.style.maxHeight = '100px';
        preview.appendChild(img);
      }
    }
  } catch(e) { console.error('load company settings failed:', e); }
  
  // Initialize everything
  try { updateDashboard(); } catch(e) { console.error('updateDashboard failed:', e); }
  try { updateDocumentsTable(); } catch(e) { console.error('updateDocumentsTable failed:', e); }
  try { updateClientsTable(); } catch(e) { console.error('updateClientsTable failed:', e); }
  try { updateProductsTable(); } catch(e) { console.error('updateProductsTable failed:', e); }
  try { updateInventoryTable(); } catch(e) { console.error('updateInventoryTable failed:', e); }
  try { updateClientDropdown(); } catch(e) { console.error('updateClientDropdown failed:', e); }
  
  // Initial route: respect URL hash if present so #clients / #settings / #recurring etc. open the right section
  try { applyRouteFromHash(); } catch(e) { console.error('applyRouteFromHash failed:', e); }

  // Listen for hash changes (back/forward, manual edits)
  try {
    window.addEventListener('hashchange', function() {
      try { applyRouteFromHash(); } catch (e) { console.error('hashchange route failed:', e); }
    });
  } catch(e) {}

  // CRITICAL: Setup event listeners MUST run no matter what
  try { setupEventListeners(); } catch(e) { console.error('setupEventListeners failed:', e); }
  
  // If user clicked new-doc button before app fully loaded, run it now
  if (window.__pendingNewDocClick) {
    window.__pendingNewDocClick = false;
    try { openNewDocumentModal(); } catch(e) { console.error('pending click failed:', e); }
  }

  // Start reminder scheduler (Pro: overdue + upcoming + email templates)
  try {
    if (window.ReminderEngine && typeof window.ReminderEngine.startReminderScheduler === 'function') {
      window.ReminderEngine.startReminderScheduler();
    }
  } catch(e) { console.error('startReminderScheduler failed:', e); }
});

function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const section = this.getAttribute('data-section');
      navigateToSection(section);
      
      // Update active state
      document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
      this.classList.add('active');
      
      // Close mobile menu
      document.getElementById('sidebar').classList.remove('mobile-open');
    });
  });
  
  // Mobile menu toggle
  document.getElementById('mobile-menu-btn').addEventListener('click', function() {
    document.getElementById('sidebar').classList.toggle('mobile-open');
  });
  
  // Language switcher
  document.getElementById('language-switcher').addEventListener('change', function() {
    setLanguage(this.value);
  });
  
  // New document button
  document.getElementById('new-document-btn').addEventListener('click', openNewDocumentModal);
  
  // Client management
  document.getElementById('new-client-btn').addEventListener('click', openNewClientModal);
  
  // Product management
  document.getElementById('new-product-btn').addEventListener('click', openNewProductModal);

  // Recurring modal: open + close + save bindings.
  // The HTML provides #recurring-modal, .close-recurring-modal buttons
  // (corner X and 取消 button) and #save-recurring-btn. The list is rendered
  // by js/recurring.js.
  const newRecBtn = document.getElementById('new-recurring-btn');
  if (newRecBtn) {
    newRecBtn.addEventListener('click', function (e) {
      e.preventDefault();
      try {
        if (window.Recurring && typeof window.Recurring.open === 'function') {
          window.Recurring.open();
        } else {
          openModal('recurring-modal');
          showToast('Recurring module not loaded', 'error');
        }
      } catch (err) {
        console.error('Recurring.open failed:', err);
        try { openModal('recurring-modal'); } catch (_) {}
      }
    });
  }
  document.querySelectorAll('.close-recurring-modal').forEach(btn => {
    btn.addEventListener('click', function () {
      try { if (window.Recurring && window.Recurring.close) window.Recurring.close(); else closeModal('recurring-modal'); }
      catch (e) { closeModal('recurring-modal'); }
    });
  });
  const saveRecBtn = document.getElementById('save-recurring-btn');
  if (saveRecBtn) {
    saveRecBtn.addEventListener('click', function (e) {
      e.preventDefault();
      try {
        if (window.Recurring && typeof window.Recurring.save === 'function') {
          window.Recurring.save();
        } else {
          showToast('Recurring module not loaded', 'error');
        }
      } catch (err) { console.error('Recurring.save failed:', err); }
    });
  }
  
  // Modal close buttons
  document.querySelectorAll('.close-document-modal').forEach(btn => {
    btn.addEventListener('click', () => closeModal('document-modal'));
  });
  document.querySelectorAll('.close-client-modal').forEach(btn => {
    btn.addEventListener('click', () => closeModal('client-modal'));
  });
  document.querySelectorAll('.close-product-modal').forEach(btn => {
    btn.addEventListener('click', () => closeModal('product-modal'));
  });
  document.querySelectorAll('.close-preview-modal').forEach(btn => {
    btn.addEventListener('click', () => closeModal('preview-modal'));
  });
  
  // Click outside modal background
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        this.classList.remove('active');
        this.classList.add('hidden');
      }
    });
  });
  
  // Add item button in document
  document.getElementById('add-item-btn').addEventListener('click', addEmptyItemRow);
  
  // Save document
  document.getElementById('save-document-btn').addEventListener('click', saveDocument);
  
  // Save client
  document.getElementById('save-client-btn').addEventListener('click', saveClient);
  
  // Save product
  document.getElementById('save-product-btn').addEventListener('click', saveProduct);

  // Save inventory item
  const saveInventoryBtn = document.getElementById('save-inventory-btn');
  if (saveInventoryBtn) saveInventoryBtn.addEventListener('click', saveInventoryItem);
  const newInventoryBtn = document.getElementById('new-inventory-btn');
  if (newInventoryBtn) newInventoryBtn.addEventListener('click', function () { openInventoryModal(null); });
  document.querySelectorAll('.close-inventory-modal').forEach(btn => {
    btn.addEventListener('click', () => closeModal('inventory-modal'));
  });
  
  // Company settings form
  document.getElementById('company-settings-form').addEventListener('submit', saveCompanySettings);
  
  // Export backup
  document.getElementById('export-backup-btn').addEventListener('click', exportBackup);
  
  // Import backup
  document.getElementById('import-backup-btn').addEventListener('click', importBackup);
  
  // Print document
  if (document.getElementById('print-document-btn')) {
    document.getElementById('print-document-btn').addEventListener('click', printDocument);
  }
  
  // Export PDF
  if (document.getElementById('export-pdf-btn')) {
    document.getElementById('export-pdf-btn').addEventListener('click', exportDocumentPDF);
  }

  // Sign document
  if (document.getElementById('sign-document-btn')) {
    document.getElementById('sign-document-btn').addEventListener('click', function () {
      const container = document.getElementById('preview-content');
      const docId = container && container.dataset ? container.dataset.docId : null;
      if (!docId) { showToast('请先打开单据预览', 'error'); return; }
      if (typeof SignaturePad !== 'undefined' && SignaturePad.open) {
        SignaturePad.open(docId);
      } else {
        showToast('签名模块未加载', 'error');
      }
    });
  }
  
  // Document filter
  document.getElementById('document-filter').addEventListener('change', updateDocumentsTable);
  
  // Logo upload
  document.getElementById('company-logo').addEventListener('change', handleLogoUpload);
  
  // Recalculate totals when items change
  document.addEventListener('input', function(e) {
    if (e.target.closest('#document-items-body')) {
      calculateTotals();
    }
  });
}

// Map of supported section ids. Used to validate hash routes and to update
// the active nav-link highlight when a hash changes externally.
const SUPPORTED_SECTIONS = [
  'dashboard', 'documents', 'clients', 'products', 'inventory',
  'settings', 'recurring', 'reports'
];

function navigateToSection(section) {
  if (!section) return;
  // Sync the URL hash (replaceState so we don't spam history) so the user
  // can bookmark / share / refresh on a specific page.
  try {
    if (typeof history !== 'undefined' && history.replaceState &&
        (!window.location.hash || window.location.hash.replace('#', '') !== section)) {
      history.replaceState(null, '', '#' + section);
    }
  } catch (e) {}

  // Hide all sections
  document.querySelectorAll('.section-content').forEach(el => {
    el.classList.remove('active');
    el.classList.add('hidden');
  });

  // Show selected section
  const sectionEl = document.getElementById(section + '-section');
  if (sectionEl) {
    sectionEl.classList.add('active');
    sectionEl.classList.remove('hidden');
  }

  // Update page title
  const titleEl = document.getElementById('page-title');
  if (titleEl) {
    try { titleEl.textContent = getTranslation(section); }
    catch (e) { titleEl.textContent = section; }
  }

  // Sync nav-link active state. This handles the case where the user
  // landed on a hash route from a refresh — the nav-link still needs
  // to highlight the current section.
  try {
    document.querySelectorAll('.nav-link').forEach(el => {
      if (el.getAttribute('data-section') === section) el.classList.add('active');
      else el.classList.remove('active');
    });
  } catch (e) {}
}

// Initial route resolution: read window.location.hash and navigate to it
// if it's a known section. Falls back to dashboard when no hash is present
// (the default). Called on DOMContentLoaded and on every hashchange.
function applyRouteFromHash() {
  let raw = '';
  try { raw = (window.location.hash || '').replace(/^#/, '').trim(); } catch (e) {}
  if (!raw) raw = 'dashboard';
  if (SUPPORTED_SECTIONS.indexOf(raw) < 0) {
    // Unknown hash — stay on dashboard but don't break.
    raw = 'dashboard';
  }
  navigateToSection(raw);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hidden');
  el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('active');
  el.classList.add('hidden');
}

// Dashboard functions
function updateDashboard() {
  const documents = getDocuments();
  let totalReceived = 0;
  let pendingPayment = 0;
  let overdueAmount = 0;
  
  documents.forEach(doc => {
    const status = checkDocumentStatus(doc);
    const total = parseFloat(doc.total) || 0;
    
    if (status === 'paid') {
      totalReceived += total;
    } else if (status === 'overdue') {
      overdueAmount += total;
    } else if (status === 'pending') {
      pendingPayment += total;
    }
  });
  
  const currency = getDefaultCurrency();
  document.getElementById('total-received').textContent = formatCurrency(totalReceived, currency);
  document.getElementById('pending-payment').textContent = formatCurrency(pendingPayment, currency);
  document.getElementById('overdue-amount').textContent = formatCurrency(overdueAmount, currency);
  document.getElementById('total-documents').textContent = documents.length;
  
  // Update recent documents table
  const recentTable = document.getElementById('recent-documents-table');
  if (documents.length === 0) {
    recentTable.innerHTML = `<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500" data-i18n="noDocuments">${getTranslation('noDocuments')}</td></tr>`;
    return;
  }
  
  // Sort by date descending, take last 5
  const sorted = documents.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  recentTable.innerHTML = sorted.map(doc => {
    const status = checkDocumentStatus(doc);
    const currency = getDefaultCurrency();
    const client = getClients().find(c => c.id === doc.clientId);
    return `
      <tr>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${doc.number || '-'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${generateDocumentTypeTranslate(doc.type)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${client ? client.name : '-'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${doc.date}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatCurrency(doc.total, currency)}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="status-badge ${getStatusClass(status)}">${getStatusName(status)}</span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button onclick="previewDocument('${doc.id}')" class="text-blue-600 hover:text-blue-900 mr-3">${getTranslation('view')}</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Documents functions
function updateDocumentsTable() {
  const filter = document.getElementById('document-filter').value;
  let documents = getDocuments();
  
  if (filter !== 'all') {
    documents = documents.filter(d => d.type === filter);
  }
  
  const table = document.getElementById('documents-table');
  
  if (documents.length === 0) {
    table.innerHTML = `<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500" data-i18n="noDocuments">${getTranslation('noDocuments')}</td></tr>`;
    return;
  }
  
  const sorted = documents.sort((a, b) => new Date(b.date) - new Date(a.date));
  table.innerHTML = sorted.map(doc => {
    const status = checkDocumentStatus(doc);
    const currency = getDefaultCurrency();
    const client = getClients().find(c => c.id === doc.clientId);
    return `
      <tr>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${doc.number || '-'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${generateDocumentTypeTranslate(doc.type)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${client ? client.name : '-'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${doc.date}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatCurrency(doc.total, currency)}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="status-badge ${getStatusClass(status)}">${getStatusName(status)}</span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button onclick="previewDocument('${doc.id}')" class="text-blue-600 hover:text-blue-900 mr-3">${getTranslation('view')}</button>
          <button onclick="editDocument('${doc.id}')" class="text-yellow-600 hover:text-yellow-900 mr-3">${getTranslation('edit')}</button>
          ${doc.status === 'paid' ? `<button onclick="unmarkAsPaid('${doc.id}')" class="text-orange-600 hover:text-orange-900 mr-3">${getTranslation('unmarkAsPaid')}</button>` : `<button onclick="markAsPaid('${doc.id}')" class="text-green-600 hover:text-green-900 mr-3">${getTranslation('markAsPaid')}</button>`}
          <button onclick="deleteDocument('${doc.id}')" class="text-red-600 hover:text-red-900">${getTranslation('delete')}</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openNewDocumentModal() {
  // Set today's date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('document-date').value = today;
  
  // Calculate due date based on default payment terms
  const settings = getSettings();
  const terms = parseInt(settings.paymentTerms) || 30;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + terms);
  document.getElementById('document-due-date').value = dueDate.toISOString().split('T')[0];
  
  // Clear everything
  document.getElementById('document-modal-title').textContent = getTranslation('createNewDocument');
  document.getElementById('document-type').value = 'invoice';
  document.getElementById('document-template').value = 'classic';
  document.getElementById('document-client').value = '';
  document.getElementById('document-notes').value = '';
  document.getElementById('document-items-body').innerHTML = '';
  
  // Add an initial empty item row so the user can start typing immediately
  addEmptyItemRow();
  
  // Store editing id
  document.getElementById('document-modal').dataset.docId = '';
  
  calculateTotals();
  openModal('document-modal');
}

window.editDocument = function(id) {
  const documents = getDocuments();
  const doc = documents.find(d => d.id === id);
  if (!doc) return;
  
  document.getElementById('document-modal-title').textContent = getTranslation('editDocument');
  document.getElementById('document-modal').dataset.docId = id;
  document.getElementById('document-type').value = doc.type;
  document.getElementById('document-date').value = doc.date;
  document.getElementById('document-due-date').value = doc.dueDate || '';
  document.getElementById('document-template').value = doc.template || 'classic';
  document.getElementById('document-client').value = doc.clientId || '';
  document.getElementById('document-notes').value = doc.notes || '';
  
  // Populate items
  document.getElementById('document-items-body').innerHTML = '';
  (doc.items || []).forEach(item => {
    addItemRow(item.name, item.price, item.quantity, item.tax);
  });
  
  calculateTotals();
  openModal('document-modal');
};

function addEmptyItemRow() {
  addItemRow('', '', 1, getSettings().defaultTaxRate || 13);
}

function addItemRow(name, price, quantity, tax, sku) {
  const tbody = document.getElementById('document-items-body');
  const row = document.createElement('tr');
  const inventory = getInventory();
  const skuOptions = ['<option value="">—</option>'].concat(
    inventory.map(i => `<option value="${escapeHtml(i.sku || '')}" ${i.sku === sku ? 'selected' : ''}>${escapeHtml(i.name || '')}${i.sku ? ' [' + escapeHtml(i.sku) + ']' : ''}</option>`)
  ).join('');
  row.innerHTML = `
    <td class="px-2 py-2">
      <input type="text" class="item-name" value="${name || ''}" placeholder="${getTranslation('itemName')}">
    </td>
    <td class="px-2 py-2">
      <select class="item-sku">${skuOptions}</select>
    </td>
    <td class="px-2 py-2">
      <input type="number" step="0.01" class="item-price" value="${price || ''}" placeholder="${getTranslation('price')}">
    </td>
    <td class="px-2 py-2">
      <input type="number" class="item-quantity" value="${quantity || 1}" placeholder="${getTranslation('quantity')}">
    </td>
    <td class="px-2 py-2">
      <input type="number" class="item-tax" value="${tax || 0}" placeholder="${getTranslation('tax')}">
    </td>
    <td class="px-2 py-2">
      <button class="btn-danger remove-item-btn" data-i18n="remove">${getTranslation('remove')}</button>
    </td>
  `;
  tbody.appendChild(row);

  // Auto-fill price when user picks an inventory item
  const skuSelect = row.querySelector('.item-sku');
  skuSelect.addEventListener('change', function() {
    const sel = inventory.find(i => i.sku === skuSelect.value);
    if (sel) {
      row.querySelector('.item-name').value = sel.name;
      row.querySelector('.item-price').value = sel.price;
      calculateTotals();
    }
  });

  // Add event listener to remove button
  row.querySelector('.remove-item-btn').addEventListener('click', function() {
    row.remove();
    calculateTotals();
  });
}

/**
 * Single source of truth for line-item money math.
 *
 * Every caller used to inline this same loop (saveDocument, calculateTotals,
 * renderDocument, buildQRBlock and Recurring.generateDocument), which meant a
 * rounding or tax-rule change had to be made in five places.
 *
 * @param {Array} items - line items with price / quantity / tax (percent)
 * @returns {{subtotal:number, totalTax:number, total:number}}
 */
function computeDocumentTotals(items) {
  let subtotal = 0;
  let totalTax = 0;

  (items || []).forEach(item => {
    const line = (Number(item.price) || 0) * (Number(item.quantity) || 0);
    subtotal += line;
    totalTax += line * ((Number(item.tax) || 0) / 100);
  });

  return { subtotal, totalTax, total: subtotal + totalTax };
}

/**
 * Totals to display for a saved document.
 *
 * Prefers the persisted amounts so a stored document always renders exactly
 * what was saved, but falls back to recomputing from the line items: documents
 * written by older builds (and by the recurring module before it computed
 * totals) have no subtotal/totalTax/total and used to render as "NaN".
 *
 * @param {Object} doc
 * @returns {{subtotal:number, totalTax:number, total:number}}
 */
function resolveDocumentTotals(doc) {
  const computed = computeDocumentTotals(doc && doc.items);

  const subtotal = Number.isFinite(Number(doc && doc.subtotal))
    ? Number(doc.subtotal) : computed.subtotal;
  const totalTax = Number.isFinite(Number(doc && doc.totalTax))
    ? Number(doc.totalTax) : computed.totalTax;
  const total = Number.isFinite(Number(doc && doc.total))
    ? Number(doc.total) : (subtotal + totalTax);

  return { subtotal, totalTax, total };
}

function calculateTotals() {
  const rows = document.querySelectorAll('#document-items-body tr');

  // Read every row (including ones with no name yet) so the live preview
  // updates as soon as a price/quantity is typed.
  const items = Array.from(rows).map(row => ({
    price: parseFloat(row.querySelector('.item-price').value) || 0,
    quantity: parseInt(row.querySelector('.item-quantity').value) || 0,
    tax: parseFloat(row.querySelector('.item-tax').value) || 0
  }));

  const { subtotal, totalTax, total } = computeDocumentTotals(items);

  // Use the correct element IDs from index.html
  const subtotalEl = document.getElementById('document-subtotal');
  const taxEl = document.getElementById('document-tax');
  const totalEl = document.getElementById('document-total');
  if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
  if (taxEl) taxEl.textContent = formatCurrency(totalTax);
  if (totalEl) totalEl.textContent = formatCurrency(total);
}

function saveDocument() {
  // Gather data
  const editingId = document.getElementById('document-modal').dataset.docId;
  const type = document.getElementById('document-type').value;
  const date = document.getElementById('document-date').value;
  const dueDate = document.getElementById('document-due-date').value;
  const template = document.getElementById('document-template').value;
  const clientId = document.getElementById('document-client').value;
  const notes = document.getElementById('document-notes').value;
  
  const items = [];
  document.querySelectorAll('#document-items-body tr').forEach(row => {
    const name = row.querySelector('.item-name').value;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    const quantity = parseInt(row.querySelector('.item-quantity').value) || 0;
    const tax = parseFloat(row.querySelector('.item-tax').value) || 0;
    const skuEl = row.querySelector('.item-sku');
    const sku = skuEl ? skuEl.value : '';

    if (name && price && quantity) {
      items.push({ name, price, quantity, tax, sku });
    }
  });
  
  // Calculate totals
  const { subtotal, totalTax, total } = computeDocumentTotals(items);
  
  // Generate document number
  const number = generateDocumentNumber(type);
  
  // Get existing documents
  let documents = getDocuments();
  
  if (editingId) {
    // Update existing
    const index = documents.findIndex(d => d.id === editingId);
    const oldDoc = documents[index];
    documents[index] = {
      ...oldDoc,
      type,
      date,
      dueDate,
      template,
      clientId,
      notes,
      items,
      subtotal,
      totalTax,
      total,
      updatedAt: new Date().toISOString()
    };
    showToast(getTranslation('documentSaved'), 'success');
  } else {
    // Create new
    const newDoc = {
      id: generateId(),
      number,
      type,
      date,
      dueDate,
      template,
      clientId,
      notes,
      items,
      subtotal,
      totalTax,
      total,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    documents.push(newDoc);
    showToast(getTranslation('documentCreated'), 'success');
  }
  
  // Save
  saveDocuments(documents);

  // Deduct inventory for invoice / receipt
  const newDoc = editingId
    ? documents[documents.findIndex(d => d.id === editingId)]
    : documents[documents.length - 1];
  if (newDoc) deductInventoryFromDocument(newDoc);

  closeModal('document-modal');

  // Refresh everything
  updateDashboard();
  updateDocumentsTable();
  updateInventoryTable();
}

window.deleteDocument = function(id) {
  if (!confirm(getTranslation('confirmDelete'))) return;
  
  let documents = getDocuments();
  documents = documents.filter(d => d.id !== id);
  saveDocuments(documents);
  
  updateDashboard();
  updateDocumentsTable();
  showToast(getTranslation('documentDeleted'), 'success');
};

// Payment tracking
window.markAsPaid = function(id) {
  const method = prompt(
    getTranslation('selectPaymentMethod') + ':\n' +
    '1. ' + getTranslation('paymentCash') + '\n' +
    '2. ' + getTranslation('paymentBank') + '\n' +
    '3. ' + getTranslation('paymentPayPal') + '\n' +
    '4. ' + getTranslation('paymentWeChat') + '\n' +
    '5. ' + getTranslation('paymentAlipay') + '\n' +
    '6. ' + getTranslation('paymentStripe') + '\n' +
    '7. ' + getTranslation('paymentOther'),
    '1'
  );
  if (!method) return;
  const methods = [
    'cash', 'bank', 'paypal', 'wechat', 'alipay', 'stripe', 'other'
  ];
  const idx = parseInt(method, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= methods.length) {
    showToast(getTranslation('selectPaymentMethod'), 'error');
    return;
  }
  const documents = getDocuments();
  const idx2 = documents.findIndex(d => d.id === id);
  if (idx2 < 0) return;
  if (!confirm(getTranslation('markPaidConfirm'))) return;
  documents[idx2].status = 'paid';
  documents[idx2].paidAt = new Date().toISOString();
  documents[idx2].paymentMethod = methods[idx];
  documents[idx2].updatedAt = new Date().toISOString();
  saveDocuments(documents);
  updateDashboard();
  updateDocumentsTable();
  showToast(getTranslation('markPaidSuccess'), 'success');
};

window.unmarkAsPaid = function(id) {
  if (!confirm(getTranslation('unmarkPaidConfirm'))) return;
  const documents = getDocuments();
  const idx = documents.findIndex(d => d.id === id);
  if (idx < 0) return;
  documents[idx].status = 'pending';
  delete documents[idx].paidAt;
  delete documents[idx].paymentMethod;
  documents[idx].updatedAt = new Date().toISOString();
  saveDocuments(documents);
  updateDashboard();
  updateDocumentsTable();
  showToast(getTranslation('unmarkPaidSuccess'), 'success');
};

// Build a document number of the form PRE-YYYYMM-NNNN where NNNN is a
// per-prefix, per-month sequence. The previous implementation used a 4-digit
// random number with no uniqueness check, which collided with ~50% probability
// after only ~470 documents in the same month (birthday problem).
function generateDocumentNumber(type) {
  const prefix = String(type || 'doc').substring(0, 3).toUpperCase();
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const stem = `${prefix}-${year}${month}-`;

  let maxSeq = 0;
  getDocuments().forEach(d => {
    const num = d && d.number;
    if (typeof num !== 'string' || num.indexOf(stem) !== 0) return;
    const seq = parseInt(num.slice(stem.length), 10);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  });

  return stem + String(maxSeq + 1).padStart(4, '0');
}

function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Client functions
function updateClientsTable() {
  const clients = getClients();
  const table = document.getElementById('clients-table');
  
  if (clients.length === 0) {
    table.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500" data-i18n="noClients">${getTranslation('noClients')}</td></tr>`;
    return;
  }
  
  table.innerHTML = clients.map(client => `
    <tr>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${client.name}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${client.email || '-'}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${client.phone || '-'}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${client.address || '-'}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${client.taxId || '-'}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <button onclick="editClient('${client.id}')" class="text-yellow-600 hover:text-yellow-900 mr-3">${getTranslation('edit')}</button>
        <button onclick="deleteClient('${client.id}')" class="text-red-600 hover:text-red-900">${getTranslation('delete')}</button>
      </td>
    </tr>
  `).join('');
}

function updateClientDropdown() {
  const clients = getClients();
  const select = document.getElementById('document-client');
  const currentValue = select.value;
  select.innerHTML = `<option value="">${getTranslation('selectClient')}</option>`;
  clients.forEach(client => {
    const option = document.createElement('option');
    option.value = client.id;
    option.textContent = client.name;
    select.appendChild(option);
  });
  select.value = currentValue;
}

function openNewClientModal() {
  document.getElementById('client-modal-title').textContent = getTranslation('addClient');
  document.getElementById('client-modal').dataset.clientId = '';
  document.getElementById('client-name').value = '';
  document.getElementById('client-email').value = '';
  document.getElementById('client-phone').value = '';
  document.getElementById('client-address').value = '';
  document.getElementById('client-tax-id').value = '';
  openModal('client-modal');
}

window.editClient = function(id) {
  const clients = getClients();
  const client = clients.find(c => c.id === id);
  if (!client) return;
  
  document.getElementById('client-modal-title').textContent = getTranslation('editClient');
  document.getElementById('client-modal').dataset.clientId = id;
  document.getElementById('client-name').value = client.name || '';
  document.getElementById('client-email').value = client.email || '';
  document.getElementById('client-phone').value = client.phone || '';
  document.getElementById('client-address').value = client.address || '';
  document.getElementById('client-tax-id').value = client.taxId || '';
  openModal('client-modal');
};

function saveClient() {
  const editingId = document.getElementById('client-modal').dataset.clientId;
  const name = document.getElementById('client-name').value;
  const email = document.getElementById('client-email').value;
  const phone = document.getElementById('client-phone').value;
  const address = document.getElementById('client-address').value;
  const taxId = document.getElementById('client-tax-id').value;
  
  if (!name) {
    showToast(getTranslation('clientNameRequired'), 'error');
    return;
  }
  
  let clients = getClients();
  
  if (editingId) {
    const index = clients.findIndex(c => c.id === editingId);
    clients[index] = {
      ...clients[index],
      name,
      email,
      phone,
      address,
      taxId
    };
    showToast(getTranslation('clientUpdated'), 'success');
  } else {
    const newClient = {
      id: generateId(),
      name,
      email,
      phone,
      address,
      taxId,
      createdAt: new Date().toISOString()
    };
    clients.push(newClient);
    showToast(getTranslation('clientCreated'), 'success');
  }
  
  saveClients(clients);
  closeModal('client-modal');
  updateClientsTable();
  updateClientDropdown();
}

window.deleteClient = function(id) {
  if (!confirm(getTranslation('confirmDelete'))) return;
  
  let clients = getClients();
  clients = clients.filter(c => c.id !== id);
  saveClients(clients);
  
  updateClientsTable();
  updateClientDropdown();
  showToast(getTranslation('clientDeleted'), 'success');
};

// Products functions
function updateProductsTable() {
  const products = getProducts();
  const table = document.getElementById('products-table');
  
  if (products.length === 0) {
    table.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500" data-i18n="noProducts">${getTranslation('noProducts')}</td></tr>`;
    return;
  }
  
  table.innerHTML = products.map(product => `
    <tr>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${product.name}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatCurrency(product.price)}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${product.tax || 0}%</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${product.description || '-'}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <button onclick="editProduct('${product.id}')" class="text-yellow-600 hover:text-yellow-900 mr-3">${getTranslation('edit')}</button>
        <button onclick="deleteProduct('${product.id}')" class="text-red-600 hover:text-red-900">${getTranslation('delete')}</button>
      </td>
    </tr>
  `).join('');
}

function openNewProductModal() {
  document.getElementById('product-modal-title').textContent = getTranslation('addProduct');
  document.getElementById('product-modal').dataset.productId = '';
  document.getElementById('product-name').value = '';
  document.getElementById('product-price').value = '';
  document.getElementById('product-tax').value = getSettings().defaultTaxRate || 13;
  document.getElementById('product-description').value = '';
  openModal('product-modal');
}

window.editProduct = function(id) {
  const products = getProducts();
  const product = products.find(p => p.id === id);
  if (!product) return;
  
  document.getElementById('product-modal-title').textContent = getTranslation('editProduct');
  document.getElementById('product-modal').dataset.productId = id;
  document.getElementById('product-name').value = product.name || '';
  document.getElementById('product-price').value = product.price || '';
  document.getElementById('product-tax').value = product.tax || 0;
  document.getElementById('product-description').value = product.description || '';
  openModal('product-modal');
};

function saveProduct() {
  const editingId = document.getElementById('product-modal').dataset.productId;
  const name = document.getElementById('product-name').value;
  const price = parseFloat(document.getElementById('product-price').value);
  const tax = parseFloat(document.getElementById('product-tax').value) || 0;
  const description = document.getElementById('product-description').value;
  
  if (!name || !price) {
    showToast(getTranslation('productNamePriceRequired'), 'error');
    return;
  }
  
  let products = getProducts();
  
  if (editingId) {
    const index = products.findIndex(p => p.id === editingId);
    products[index] = {
      ...products[index],
      name,
      price,
      tax,
      description
    };
    showToast(getTranslation('productUpdated'), 'success');
  } else {
    const newProduct = {
      id: generateId(),
      name,
      price,
      tax,
      description,
      createdAt: new Date().toISOString()
    };
    products.push(newProduct);
    showToast(getTranslation('productCreated'), 'success');
  }
  
  saveProducts(products);
  closeModal('product-modal');
  updateProductsTable();
}

window.deleteProduct = function(id) {
  if (!confirm(getTranslation('confirmDelete'))) return;
  
  let products = getProducts();
  products = products.filter(p => p.id !== id);
  saveProducts(products);
  
  updateProductsTable();
  showToast(getTranslation('productDeleted'), 'success');
};

// Settings
function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('logo-preview');
    preview.innerHTML = '';
    const img = document.createElement('img');
    img.src = e.target.result;
    img.style.maxHeight = '100px';
    preview.appendChild(img);
  };
  reader.readAsDataURL(file);
}

function saveCompanySettings(e) {
  e.preventDefault();
  
  const logoPreview = document.getElementById('logo-preview').querySelector('img');
  const companyLogo = logoPreview ? logoPreview.src : null;
  
  const settings = {
    companyName: document.getElementById('company-name').value,
    companyEmail: document.getElementById('company-email').value,
    companyPhone: document.getElementById('company-phone').value,
    companyAddress: document.getElementById('company-address').value,
    companyTaxId: document.getElementById('company-tax-id').value,
    defaultCurrency: document.getElementById('default-currency').value,
    defaultTaxRate: parseFloat(document.getElementById('default-tax-rate').value) || 0,
    paymentTerms: parseInt(document.getElementById('payment-terms').value) || 30,
    companyLogo
  };
  
  saveSettings(settings);
  showToast(getTranslation('settingsSaved'), 'success');
}

// Inventory functions
function getInventory() {
  return JSON.parse(localStorage.getItem('invoiceforge_inventory') || '[]');
}

function saveInventory(items) {
  localStorage.setItem('invoiceforge_inventory', JSON.stringify(items));
}

function updateInventoryTable() {
  const items = getInventory();
  const tbody = document.getElementById('inventory-table');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">' + getTranslation('noInventory') + '</td></tr>';
  } else {
    const settings = getSettings();
    const currency = getDefaultCurrency();
    tbody.innerHTML = items.map(item => {
      const isLow = item.stock <= (item.threshold || 5);
      return `<tr>
        <td class="px-6 py-4">${item.name}${isLow ? ' <span class="text-red-500 text-xs">(' + getTranslation('inventoryLowWarning') + ')</span>' : ''}</td>
        <td class="px-6 py-4">${item.sku || '-'}</td>
        <td class="px-6 py-4">${formatCurrency(item.price, currency)}</td>
        <td class="px-6 py-4">${item.stock}</td>
        <td class="px-6 py-4 text-sm">
          <button onclick="editInventory('${item.id}')" class="text-blue-600 hover:text-blue-900 mr-2">${getTranslation('edit')}</button>
          <button onclick="deleteInventory('${item.id}')" class="text-red-600 hover:text-red-900">${getTranslation('delete')}</button>
        </td>
      </tr>`;
    }).join('');
  }
  const countEl = document.getElementById('inventory-count');
  if (countEl) countEl.textContent = items.length;
  const lowCount = items.filter(i => i.stock <= (i.threshold || 5)).length;
  const lowEl = document.getElementById('inventory-low-count');
  if (lowEl) lowEl.textContent = lowCount;
}

window.openInventoryModal = function(id = null) {
  const modal = document.getElementById('inventory-modal');
  const form = document.getElementById('inventory-form');
  form.reset();
  document.getElementById('inventory-id').value = '';
  if (id) {
    const items = getInventory();
    const item = items.find(i => i.id === id);
    if (item) {
      document.getElementById('inventory-id').value = item.id;
      document.getElementById('inventory-name').value = item.name;
      document.getElementById('inventory-sku').value = item.sku || '';
      document.getElementById('inventory-price').value = item.price;
      document.getElementById('inventory-stock').value = item.stock;
      document.getElementById('inventory-threshold').value = item.threshold || 5;
    }
  }
  openModal('inventory-modal');
}

window.editInventory = function(id) {
  openInventoryModal(id);
};

window.deleteInventory = function(id) {
  if (!confirm(getTranslation('confirmDelete'))) return;
  let items = getInventory();
  items = items.filter(i => i.id !== id);
  saveInventory(items);
  updateInventoryTable();
  showToast(getTranslation('deleteSuccess'), 'success');
};

function saveInventoryItem() {
  const id = document.getElementById('inventory-id').value;
  const items = getInventory();
  const data = {
    id: id || generateId(),
    name: document.getElementById('inventory-name').value.trim(),
    sku: document.getElementById('inventory-sku').value.trim(),
    price: parseFloat(document.getElementById('inventory-price').value) || 0,
    stock: parseInt(document.getElementById('inventory-stock').value) || 0,
    threshold: parseInt(document.getElementById('inventory-threshold').value) || 5,
    updatedAt: new Date().toISOString()
  };
  if (!data.name) {
    showToast(getTranslation('name') + ' ?', 'error');
    return;
  }
  if (id) {
    const idx = items.findIndex(i => i.id === id);
    if (idx >= 0) items[idx] = { ...items[idx], ...data };
  } else {
    items.push(data);
  }
  saveInventory(items);
  updateInventoryTable();
  closeModal('inventory-modal');
  showToast(getTranslation('saveSuccess'), 'success');
}

// Deduct inventory when an invoice is created/saved
function deductInventoryFromDocument(doc) {
  if (doc.type !== 'invoice' && doc.type !== 'receipt') return;
  if (!doc.items || doc.items.length === 0) return;
  const inventory = getInventory();
  let changed = false;
  doc.items.forEach(item => {
    if (!item.sku) return;
    const inv = inventory.find(i => i.sku && i.sku.toLowerCase() === item.sku.toLowerCase());
    if (inv) {
      inv.stock = Math.max(0, (inv.stock || 0) - (item.quantity || 0));
      inv.updatedAt = new Date().toISOString();
      changed = true;
    }
  });
  if (changed) saveInventory(inventory);
}

// Backup functions
function exportBackup() {
  const backup = {
    version: 2,
    documents: getDocuments(),
    clients: getClients(),
    products: getProducts(),
    settings: getSettings(),
    // Module data — previously omitted, so restoring a backup silently
    // wiped the user's stock levels and recurring rules.
    inventory: getInventory(),
    // Read through the Recurring module so we always use its own storage key
    // ('invoiceforge.recurring'), not a hardcoded guess.
    recurring: (typeof Recurring !== 'undefined' && Recurring.list) ? Recurring.list() : [],
    language: getCurrentLanguage(),
    exportedAt: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  const fileName = `invoiceforge-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast(getTranslation('backupExported'), 'success');
}

function importBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const backup = JSON.parse(event.target.result);
        
        if (backup.documents) saveDocuments(backup.documents);
        if (backup.clients) saveClients(backup.clients);
        if (backup.products) saveProducts(backup.products);
        if (backup.settings) saveSettings(backup.settings);
        if (backup.inventory) saveInventory(backup.inventory);
        if (backup.recurring) {
          // Must match Recurring's own STORE_KEY ('invoiceforge.recurring').
          localStorage.setItem('invoiceforge.recurring', JSON.stringify(backup.recurring));
        }
        if (backup.language) setLanguage(backup.language);
        
        showToast(getTranslation('backupImported'), 'success');
        // Reload last so the success toast is actually visible for a moment.
        setTimeout(() => location.reload(), 800);
      } catch (err) {
        showToast(getTranslation('backupInvalid'), 'error');
      }
    };
    reader.readAsText(file);
  };
  
  input.click();
}

// Template rendering
function renderDocument(doc, container) {
  const settings = getSettings();
  const client = doc.clientId ? getClients().find(c => c.id === doc.clientId) : null;
  const currency = getDefaultCurrency();
  
  // Get template class
  const templateClass = 'template-' + (doc.template || 'classic');
  
  // Type translation
  const typeMap = {
    invoice: getTranslation('invoice'),
    quote: getTranslation('quote'),
    receipt: getTranslation('receipt'),
    purchase: getTranslation('purchase'),
    proforma: getTranslation('proforma'),
    credit: getTranslation('credit')
  };
  
  let html = `<div class="document ${templateClass}">`;
  
  html += `
    <div class="document-header">
  `;
  
  if (settings.companyLogo) {
    html += `<img src="${escapeHtml(settings.companyLogo)}" alt="${escapeHtml(settings.companyName || '')}" class="company-logo">`;
  }
  
  html += `
      <div class="header-info">
        <h1>${escapeHtml(settings.companyName || getTranslation('company'))}</h1>
        ${settings.companyEmail ? `<p>${escapeHtml(settings.companyEmail)}</p>` : ''}
        ${settings.companyPhone ? `<p>${escapeHtml(settings.companyPhone)}</p>` : ''}
        ${settings.companyAddress ? `<p>${escapeHtml(settings.companyAddress)}</p>` : ''}
        ${settings.companyTaxId ? `<p>${escapeHtml(settings.companyTaxId)}</p>` : ''}
      </div>
      <div class="document-title">
        <h2>${escapeHtml(typeMap[doc.type] || doc.type || '')}</h2>
        <p><strong>${getTranslation('number')}:</strong> ${escapeHtml(doc.number || '')}</p>
        <p><strong>${getTranslation('date')}:</strong> ${escapeHtml(doc.date || '')}</p>
        ${doc.dueDate ? `<p><strong>${getTranslation('dueDate')}:</strong> ${escapeHtml(doc.dueDate)}</p>` : ''}
      </div>
    </div>
    
    <div class="client-info">
      <div class="client-label">${getTranslation('billTo')}:</div>
      ${client ? `
        <h3>${escapeHtml(client.name || '')}</h3>
        ${client.email ? `<p>${escapeHtml(client.email)}</p>` : ''}
        ${client.phone ? `<p>${escapeHtml(client.phone)}</p>` : ''}
        ${client.address ? `<p>${escapeHtml(client.address)}</p>` : ''}
        ${client.taxId ? `<p>${escapeHtml(client.taxId)}</p>` : ''}
      ` : ''}
    </div>
    
    <table class="items-table">
      <thead>
        <tr>
          <th>${getTranslation('item')}</th>
          <th class="text-right">${getTranslation('price')}</th>
          <th class="text-right">${getTranslation('quantity')}</th>
          <th class="text-right">${getTranslation('tax')}</th>
          <th class="text-right">${getTranslation('total')}</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  // Totals: prefer the persisted amounts, falling back to recomputing them for
  // documents saved before those fields existed. See resolveDocumentTotals().
  const totals = resolveDocumentTotals(doc);
  const dispSubtotal = totals.subtotal;
  const dispTax      = totals.totalTax;
  const dispTotal    = totals.total;

  doc.items.forEach(item => {
    const rowTotal = (Number(item.price) || 0) * (Number(item.quantity) || 0);
    html += `
      <tr>
        <td><strong>${escapeHtml(item.name || '')}</strong></td>
        <td class="text-right">${formatCurrency(item.price, currency)}</td>
        <td class="text-right">${escapeHtml(String(item.quantity == null ? '' : item.quantity))}</td>
        <td class="text-right">${Number(item.tax) || 0}%</td>
        <td class="text-right">${formatCurrency(rowTotal, currency)}</td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
      <tfoot class="totals">
        <tr>
          <td colspan="3"></td>
          <td class="text-right"><strong>${getTranslation('subtotal')}</strong></td>
          <td class="text-right">${formatCurrency(dispSubtotal, currency)}</td>
        </tr>
        <tr>
          <td colspan="3"></td>
          <td class="text-right"><strong>${getTranslation('tax')}</strong></td>
          <td class="text-right">${formatCurrency(dispTax, currency)}</td>
        </tr>
        <tr class="total-row">
          <td colspan="3"></td>
          <td class="text-right"><strong>${getTranslation('total')}</strong></td>
          <td class="text-right">${formatCurrency(dispTotal, currency)}</td>
        </tr>
      </tfoot>
    </table>
  `;
  
  if (doc.notes) {
    html += `
      <div class="notes">
        <h4>${getTranslation('notes')}:</h4>
        <p>${escapeHtml(doc.notes).replace(/\n/g, '<br>')}</p>
      </div>
    `;
  }

  // QR Code (Stage 1.4) — Pro only
  html += buildQRBlock(doc, client, currency, settings);

  // Inject signature block if any
  if (typeof SignaturePad !== 'undefined' && SignaturePad.renderHTML && doc.signature) {
    html += SignaturePad.renderHTML(doc.signature);
  }

  html += `</div>`;
  container.innerHTML = html;

  // Render QR canvas if Pro
  const qrCanvas = container.querySelector('.doc-qr-canvas');
  if (qrCanvas && typeof QRCode !== 'undefined') {
    const payload = qrCanvas.getAttribute('data-qr-payload') || '';
    try {
      const c = QRCode.toCanvas(payload, 132);
      c.className = 'doc-qr-canvas';
      qrCanvas.replaceWith(c);
    } catch (e) {
      qrCanvas.outerHTML = `<div class="text-xs text-red-500">QR error: ${(e && e.message) || e}</div>`;
    }
  }
}

// Build the QR code block HTML for a document. Always renders a real,
// scannable QR code — there is no locked/placeholder variant any more.
function buildQRBlock(doc, client, currency, settings) {
  const label = getTranslation('qrCodeLabel');
  const title = getTranslation('qrCodeTitle');
  const hint  = getTranslation('qrCodeHint');

  // Totals: resolved exactly like the printed document, so a scanned QR can
  // never disagree with the amounts on the page.
  const { subtotal, totalTax: taxTotal, total } = resolveDocumentTotals(doc);

  // Build compact payload (base64 of JSON) so the QR stays short & robust
  const payload = {
    v: 1,
    app: 'InvoiceForge',
    n: doc.number,
    t: doc.type,
    d: doc.date,
    u: doc.dueDate || '',
    a: +total.toFixed(2),
    s: +subtotal.toFixed(2),
    x: +taxTotal.toFixed(2),
    c: currency || '¥',
    cn: (client && client.name) || (settings.companyName || ''),
    cl: (client && client.name) || '',
    paid: !!doc.paid
  };
  let payloadStr = '';
  try {
    payloadStr = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  } catch (e) {
    payloadStr = JSON.stringify(payload);
  }

  return `
    <div class="doc-qr-block">
      <div class="doc-qr-header">
        <i class="fa fa-qrcode"></i>
        <span>${title}</span>
      </div>
      <div class="doc-qr-body">
        <canvas class="doc-qr-canvas" data-qr-payload="${escapeHtml(payloadStr)}" width="132" height="132"></canvas>
        <div class="doc-qr-meta">
          <div class="doc-qr-label">${label}</div>
          <div class="doc-qr-hint">${hint}</div>
          <div class="doc-qr-fields">
            <div><strong>${getTranslation('number')}:</strong> ${escapeHtml(doc.number || '')}</div>
            <div><strong>${getTranslation('total')}:</strong> ${escapeHtml(currency || '¥')}${(+total).toFixed(2)}</div>
            ${client ? `<div><strong>${getTranslation('client')}:</strong> ${escapeHtml(client.name || '')}</div>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

// escapeHtml — escape the five characters that are unsafe inside HTML text or
// attribute values. NOTE: the ampersand MUST be replaced first, otherwise the
// entities produced by the later rules would be double-escaped.
// (A previous version of this function replaced every character with itself,
// which silently disabled all output escaping and allowed stored XSS.)
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.previewDocument = function(id) {
  const documents = getDocuments();
  const doc = documents.find(d => d.id === id);
  if (!doc) return;
  
  const container = document.getElementById('preview-content');
  renderDocument(doc, container);
  openModal('preview-modal');
  
  // Store current preview document id for export/print
  container.dataset.docId = id;
};

function printDocument() {
  if (typeof ThermalPrint !== 'undefined' && ThermalPrint.openPrintDialog) {
    ThermalPrint.openPrintDialog();
  } else {
    window.print();
  }
}

function exportDocumentPDF() {
  // Always use A4 layout for PDF export. Free users get A4; Pro users can also
  // still choose A4 here. Thermal receipt is reserved for the print dialog.
  if (typeof ThermalPrint !== 'undefined' && ThermalPrint.doPrint) {
    ThermalPrint.doPrint({ paper: 'a4', copies: 1 });
  } else {
    window.print();
  }
}

// Export as DOCX (requires docx library)
// For simplicity, we'll just provide a text-based export
// In production, you would include the docx library from CDN

window.exportDocx = function() {
  const container = document.getElementById('preview-content');
  const docId = container.dataset.docId;
  const documents = getDocuments();
  const doc = documents.find(d => d.id === docId);
  if (!doc) return;

  // Build a minimal but real .docx (Office Open XML) from invoice data.
  // Structure: ZIP containing [Content_Types].xml, _rels/.rels, word/document.xml.
  // We use the Store compression (no actual compression) so we can hand-build
  // a valid ZIP without a third-party library.
  // Escape text for embedding inside XML. Ampersand must come first so the
  // entities emitted below are not double-escaped. Without this, any value
  // containing & < > produced a malformed document.xml that Word refused to open.
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const lines = [];
  // Documents only persist `clientId`; resolve the client record so the export
  // shows a real name instead of an empty field.
  const docClient = doc.clientId
    ? (getClients().find(c => c.id === doc.clientId) || null)
    : null;
  const push = (txt) => lines.push('<w:p><w:r><w:t xml:space="preserve">' + esc(txt) + '</w:t></w:r></w:p>');
  push(doc.type ? doc.type.toUpperCase() : 'INVOICE');
  push('No.: ' + (doc.number || ''));
  push('Date: ' + (doc.date || ''));
  if (doc.dueDate) push('Due: ' + doc.dueDate);
  push('Client: ' + (docClient ? (docClient.name || '') : ''));
  push('');
  push('--- Items ---');
  (doc.items || []).forEach(it => {
    const line = (it.name || '') + '  x' + (it.quantity || 0) +
      '  @ ' + (it.price || 0) + '  tax ' + (it.tax || 0) + '%  = ' +
      (((it.price || 0) * (it.quantity || 0)).toFixed(2));
    push(line);
  });
  push('');
  // Use the field names actually persisted by saveDocument(). `doc.tax` never
  // existed, so the tax line always rendered blank.
  push('Subtotal: ' + (doc.subtotal != null ? Number(doc.subtotal).toFixed(2) : ''));
  push('Tax: ' + (doc.totalTax != null ? Number(doc.totalTax).toFixed(2) : ''));
  push('Total: ' + (doc.total != null ? Number(doc.total).toFixed(2) : ''));
  if (doc.notes) { push(''); push('Notes: ' + doc.notes); }

  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' + lines.join('') + '</w:body>' +
    '</w:document>';
  const contentTypesXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';
  const relsXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';

  // Store (no compression) ZIP builder.
  function crc32(buf) {
    let c, table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = (table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)) >>> 0;
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function encodeUTF8(s) { return new TextEncoder().encode(s); }
  function makeZip(files) {
    // files: [{name, data:Uint8Array}]
    const localParts = [], centralParts = [];
    let offset = 0;
    files.forEach(f => {
      const nameBytes = encodeUTF8(f.name);
      const data = f.data;
      const crc = crc32(data);
      const size = data.length;
      // local file header (30 bytes) + name + data
      const lh = new Uint8Array(30 + nameBytes.length);
      const dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);          // version needed
      dv.setUint16(6, 0, true);           // flags
      dv.setUint16(8, 0, true);           // method = stored
      dv.setUint16(10, 0, true);          // mod time
      dv.setUint16(12, 0, true);          // mod date
      dv.setUint32(14, crc, true);
      dv.setUint32(18, size, true);       // compressed size
      dv.setUint32(22, size, true);       // uncompressed size
      dv.setUint16(26, nameBytes.length, true);
      dv.setUint16(28, 0, true);
      lh.set(nameBytes, 30);
      localParts.push(lh, data);
      // central directory record
      const ch = new Uint8Array(46 + nameBytes.length);
      const cdv = new DataView(ch.buffer);
      cdv.setUint32(0, 0x02014b50, true);
      cdv.setUint16(4, 20, true);
      cdv.setUint16(6, 20, true);
      cdv.setUint16(8, 0, true);
      cdv.setUint16(10, 0, true);
      cdv.setUint16(12, 0, true);
      cdv.setUint16(14, 0, true);
      cdv.setUint32(16, crc, true);
      cdv.setUint32(20, size, true);
      cdv.setUint32(24, size, true);
      cdv.setUint16(28, nameBytes.length, true);
      cdv.setUint16(30, 0, true);
      cdv.setUint16(32, 0, true);
      cdv.setUint16(34, 0, true);
      cdv.setUint16(36, 0, true);
      cdv.setUint32(38, 0, true);
      cdv.setUint32(42, offset, true);
      ch.set(nameBytes, 46);
      centralParts.push(ch);
      offset += lh.length + data.length;
    });
    // End of central directory
    const totalFiles = files.length;
    const centralSize = centralParts.reduce((a, p) => a + p.length, 0);
    const eocd = new Uint8Array(22);
    const e = new DataView(eocd.buffer);
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(4, 0, true);
    e.setUint16(6, 0, true);
    e.setUint16(8, totalFiles, true);
    e.setUint16(10, totalFiles, true);
    e.setUint32(12, centralSize, true);
    e.setUint32(16, offset, true);
    e.setUint16(20, 0, true);
    return new Blob([...localParts, ...centralParts, eocd], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  const zip = makeZip([
    { name: '[Content_Types].xml',     data: encodeUTF8(contentTypesXml) },
    { name: '_rels/.rels',             data: encodeUTF8(relsXml) },
    { name: 'word/document.xml',       data: encodeUTF8(documentXml) }
  ]);
  const url = URL.createObjectURL(zip);
  const a = document.createElement('a');
  a.href = url;
  a.download = (doc.number || 'document') + '.docx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

window.exportExcel = function() {
  const container = document.getElementById('preview-content');
  const docId = container.dataset.docId;
  const documents = getDocuments();
  const doc = documents.find(d => d.id === docId);
  
  if (!doc) return;
  
  // Create CSV
  let csv = 'Item,Price,Quantity,Tax,Total\n';
  doc.items.forEach(item => {
    const total = item.price * item.quantity;
    csv += `"${item.name}",${item.price},${item.quantity},${item.tax},${total}\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.number}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
