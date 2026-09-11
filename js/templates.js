// Template styles for InvoiceForge - 4 different styles

const templateStyles = `
/* ============================================
   TEMPLATE - CLASSIC
   ============================================ */
.template-classic {
  background: #ffffff;
  max-width: 800px;
  margin: 0 auto;
  padding: 40px;
}

.template-classic .document-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 40px;
  border-bottom: 2px solid #333;
  padding-bottom: 20px;
}

.template-classic .document-header h1 {
  font-size: 28px;
  color: #333;
  margin: 0 0 5px 0;
}

.template-classic .document-title h2 {
  font-size: 24px;
  color: #333;
  margin: 0 0 10px 0;
}

.template-classic .client-info {
  margin-bottom: 30px;
}

.template-classic .client-label {
  font-weight: bold;
  text-transform: uppercase;
  color: #666;
  margin-bottom: 5px;
}

.template-classic .items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 30px;
}

.template-classic .items-table thead {
  background-color: #f5f5f5;
}

.template-classic .items-table th,
.template-classic .items-table td {
  padding: 12px 8px;
  border: 1px solid #ddd;
}

.template-classic .totals tr td {
  border: none;
  padding: 8px;
}

.template-classic .total-row {
  font-weight: bold;
  font-size: 1.2em;
  background: #f9f9f9;
}

/* ============================================
   TEMPLATE - MODERN
   ============================================ */
.template-modern {
  background: #ffffff;
  max-width: 800px;
  margin: 0 auto;
  padding: 40px;
}

.template-modern .document-header {
  background: #2c3e50;
  color: white;
  padding: 30px;
  margin: -40px -40px 40px -40px;
}

.template-modern .document-header h1 {
  font-size: 28px;
  margin: 0 0 10px 0;
}

.template-modern .document-header p {
  color: #bdc3c7;
}

.template-modern .document-title {
  background: #34495e;
  padding: 20px 30px;
  margin: 30px -40px;
}

.template-modern .document-title h2 {
  font-size: 26px;
  color: white;
  margin: 0;
}

.template-modern .document-title p {
  color: #bdc3c7;
  margin: 5px 0 0 0;
}

.template-modern .client-info {
  margin-bottom: 30px;
  background: #f8f9fa;
  padding: 20px;
  border-radius: 4px;
}

.template-modern .items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 30px;
}

.template-modern .items-table thead th {
  background: #2c3e50;
  color: white;
  padding: 15px 8px;
}

.template-modern .items-table td {
  padding: 12px 8px;
  border-bottom: 1px solid #eee;
}

.template-modern .total-row {
  background: #2c3e50;
  color: white;
  font-weight: bold;
  font-size: 1.2em;
}

.template-modern .total-row td {
  padding: 15px !important;
}

/* ============================================
   TEMPLATE - MINIMAL
   ============================================ */
.template-minimal {
  background: #ffffff;
  max-width: 800px;
  margin: 0 auto;
  padding: 40px;
}

.template-minimal .document-header {
  text-align: center;
  margin-bottom: 40px;
}

.template-minimal .document-header h1 {
  font-size: 32px;
  font-weight: 300;
  letter-spacing: 2px;
  color: #000;
  margin: 0 0 20px 0;
  text-transform: uppercase;
}

.template-minimal .document-title {
  text-align: center;
  margin: 30px 0;
}

.template-minimal .document-title h2 {
  font-size: 28px;
  font-weight: 300;
  margin: 0;
  color: #333;
}

.template-minimal .client-info {
  text-align: center;
  margin-bottom: 40px;
}

.template-minimal .client-label {
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #999;
  margin-bottom: 10px;
}

.template-minimal .items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 40px;
}

.template-minimal .items-table th {
  text-align: left;
  font-weight: 400;
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 1px;
  color: #999;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.template-minimal .items-table td {
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
}

.template-minimal .totals {
  text-align: right;
}

.template-minimal .total-row {
  font-weight: 300;
  font-size: 1.5em;
  letter-spacing: 1px;
}

/* ============================================
   TEMPLATE - BOLD
   ============================================ */
.template-bold {
  background: #ffffff;
  max-width: 800px;
  margin: 0 auto;
  padding: 40px;
}

.template-bold .document-header {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-bottom: 40px;
  border-left: 10px solid #ff6b6b;
  padding-left: 20px;
}

.template-bold .document-header h1 {
  font-size: 32px;
  color: #ff6b6b;
  margin: 0 0 10px 0;
}

.template-bold .document-title {
  background: #ff6b6b;
  color: white;
  padding: 20px;
  margin-bottom: 30px;
  display: inline-block;
}

.template-bold .document-title h2 {
  margin: 0;
  font-size: 26px;
}

.template-bold .client-info {
  margin-bottom: 30px;
}

.template-bold .client-label {
  display: inline-block;
  background: #ff6b6b;
  color: white;
  padding: 5px 15px;
  margin-bottom: 15px;
}

.template-bold .items-table {
  width: 100%;
  border-collapse: collapse;
}

.template-bold .items-table thead th {
  background: #ff6b6b;
  color: white;
  padding: 15px 10px;
  font-size: 14px;
}

.template-bold .items-table td {
  padding: 15px 10px;
  border-bottom: 3px solid #f0f0f0;
}

.template-bold .total-row {
  background: #2d3436;
  color: white;
  font-weight: bold;
  font-size: 1.3em;
}

.template-bold .total-row td {
  padding: 20px 10px !important;
}

/* ============================================
   COMMON STYLES FOR ALL TEMPLATES
   ============================================ */
.document {
  position: relative;
}

.company-logo {
  max-height: 80px;
  max-width: 200px;
  height: auto;
  width: auto;
}

.header-info p {
  margin: 3px 0;
  color: #666;
}

.client-info h3 {
  margin: 0 0 10px 0;
  color: #333;
}

.client-info p {
  margin: 2px 0;
  color: #666;
}

.items-table .text-right {
  text-align: right;
}

.notes {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.notes h4 {
  color: #666;
  margin: 0 0 10px 0;
}

@media print {
  body * {
    visibility: hidden;
  }
  
  #preview-modal, #preview-modal * {
    visibility: visible;
  }
  
  #preview-modal {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    background: white;
  }
  
  .modal-header, .modal-actions {
    display: none !important;
  }
  
  .document {
    box-shadow: none !important;
  }
  
  @page {
    margin: 1cm;
    size: A4;
  }
}
`;

// Inject styles when page loads
document.addEventListener('DOMContentLoaded', function() {
  const styleEl = document.createElement('style');
  styleEl.textContent = templateStyles;
  document.head.appendChild(styleEl);
});