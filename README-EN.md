# InvoiceForge - Local Invoice & Business Document Manager

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![No build step](https://img.shields.io/badge/build-none-blue)
![Offline first](https://img.shields.io/badge/offline-100%25-brightgreen)

[中文](README.md) | English

InvoiceForge is a pure-frontend, locally-running invoice and business document management tool designed for freelancers, consultants, and small businesses. Create and manage various business documents in your browser, with all data stored locally on the user's device — no cloud server required.

> Open source and free. Your data stays in your own browser — no network access.

## 🚀 Features

### Core Functions

✅ **Multiple Document Types** - Supports 6 types: Invoices, Quotes, Receipts, Purchase Orders, Proforma Invoices, and Credit Notes
✅ **Customer Management** - Save customer info, quickly select when creating documents
✅ **Product Library** - Save frequently-used products/services, record prices and tax rates, quickly add to documents
✅ **Real-time Preview** - Live preview of print output while editing, with 4 template styles to choose from (Classic / Modern / Minimal / Bold)
✅ **Export** - Print/PDF export, CSV export
✅ **Data Backup** - Export full JSON backup, restore data from JSON
✅ **Dashboard Statistics** - Show total received, pending payments, overdue items, document count, and recent documents
✅ **Chinese/English Toggle** - Switch interface language with one click
✅ **Company Settings** - Save company info, upload logo, set default currency, tax rate, and payment terms

### Advanced Features

✅ Inventory Management (stock levels, low-stock threshold, auto-deduct on invoicing)
✅ Payment Tracking (mark as paid, payment method, overdue stats)
✅ Overdue Reminders
✅ Encrypted Storage (Password Protection)
✅ Template Editor (custom primary/accent colours)
✅ Thermal Printer Support (80mm / 58mm receipts, multi-copy printing)
✅ Electronic Signatures (hand-drawn and typed)
✅ Document QR Codes
✅ Version Snapshots / Rollback
✅ Recurring Auto-Billing
✅ Advanced Reports (revenue trend, top clients, CSV export)
✅ Multi-Tax-Rate Support

## 🛡️ Privacy

No sign-up, no network access. All data lives in your browser's
localStorage — fully local, privacy under your control.

## 💻 How to Use

### Direct Use

1. Download the project files
2. Double-click `index.html` to open in your browser
3. Start using! No installation, no backend, all data saved locally

### Online Use

Can be deployed to any static hosting service (such as Vercel, Netlify, GitHub Pages, etc.)

## 🔧 Tech Stack

- Pure HTML/CSS/JavaScript
- Tailwind CSS via CDN
- No backend required, runs directly in the browser
- Responsive design, adapts to desktop and mobile devices

## 📝 Development

Project structure:

```
InvoiceForge/
├── index.html              # single entry point
├── css/
│   └── style.css           # custom styles
├── js/
│   ├── app.js              # main logic (documents / clients / products / inventory / dashboard)
│   ├── i18n.js             # zh + en dictionary
│   ├── templates.js        # the 4 template renderers
│   ├── qrcode.js           # QR generation (local, no CDN dependency)
│   ├── encryption.js       # encrypted storage
│   ├── recurring.js        # recurring auto-billing
│   ├── reports.js          # advanced reports
│   ├── reminders.js        # overdue reminders
│   ├── signature.js        # electronic signatures
│   ├── snapshots.js        # version snapshots / rollback
│   ├── template-editor.js  # template editor
│   └── thermal.js          # thermal printing
├── docs/
│   └── FEATURES-CN.md      # detailed feature list (Chinese)
└── tools/                  # smoke tests (Python)
```

## 🧪 Tests

`tools/` holds static smoke tests that check source structure and i18n key
completeness. No browser required:

```bash
python tools/inventory_smoke_test.py
python tools/qrcode_smoke_test.py
python tools/reminders_smoke_test.py
python tools/thermal_smoke_test.py
```

There is also a real-browser test, which needs Playwright
(`pip install playwright` + `playwright install chromium`):

```bash
python tools/open_source_smoke_test.py
```

## 🎨 Template Styles

1. **Classic** - Traditional business style, suitable for formal occasions
2. **Modern** - Dark header, clean and professional
3. **Minimal** - Simple and modern, with whitespace design
4. **Bold** - Bright accents, modern feel

## 🔒 Privacy

- All data is stored in your browser's local storage
- Data is never uploaded to any server
- You can export backups at any time, maintaining full control over your data

## 🤝 Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

MIT License — free to use, modify and distribute. See [LICENSE](LICENSE).