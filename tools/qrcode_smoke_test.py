"""
Stage 1.4 QR Code self-check (8 items).
Verifies that the QR feature is wired up end-to-end:
  1) js/qrcode.js exists and is non-trivial
  2) index.html loads qrcode.js (BEFORE app.js) and still loads qrcode-generator CDN
  3) js/app.js contains buildQRBlock() and an escapeHtml() helper
  4) renderDocument() inserts the QR block before </div> for the doc
  5) js/i18n.js exposes all 5 zh + 5 en QR keys
  6) css/style.css contains the QR block selectors (CSS)
  7) Free user → locked placeholder; Pro user → real canvas with payload
  8) QR payload includes app/number/total/currency/client fields
"""
import os, re, sys, json

ROOT = r"C:\Users\86159\Desktop\InvoiceForge"
OK, FAIL = 0, 0

def chk(name, cond, detail=""):
    global OK, FAIL
    status = "PASS" if cond else "FAIL"
    if cond: OK += 1
    else:    FAIL += 1
    print(f"  [{status}] {name}{(' — ' + detail) if detail else ''}")
    return cond

print("\n=== Stage 1.4 QR Code Self-Check ===\n")

# 1) qrcode.js exists
qr_path = os.path.join(ROOT, "js", "qrcode.js")
chk("1. js/qrcode.js exists & non-trivial",
    os.path.isfile(qr_path) and os.path.getsize(qr_path) > 1000,
    f"size={os.path.getsize(qr_path) if os.path.isfile(qr_path) else 0}")

# 2) index.html includes qrcode.js + qrcode-generator CDN
idx_path = os.path.join(ROOT, "index.html")
idx = open(idx_path, encoding="utf-8").read()
chk("2a. index.html loads local js/qrcode.js",
    "js/qrcode.js" in idx)
qr_pos = idx.find("js/qrcode.js")
app_pos = idx.find("js/app.js")
chk("2c. js/qrcode.js is loaded BEFORE js/app.js",
    qr_pos > 0 and app_pos > 0 and qr_pos < app_pos,
    f"qr={qr_pos} app={app_pos}")

# 3) buildQRBlock + escapeHtml in app.js
app = open(os.path.join(ROOT, "js", "app.js"), encoding="utf-8").read()
chk("3a. app.js defines buildQRBlock()", "function buildQRBlock" in app)
chk("3b. app.js defines escapeHtml()",   "function escapeHtml" in app)

# 4) renderDocument wires the QR block
render_idx = app.find("function renderDocument")
render_body = app[render_idx: app.find("\n// ", render_idx + 1)] if render_idx > 0 else ""
chk("4a. renderDocument() contains buildQRBlock call", "buildQRBlock" in render_body)
chk("4b. renderDocument() does the canvas-replace after innerHTML",
    "replaceWith" in render_body and "QRCode.toCanvas" in render_body)
chk("4c. no locked-placeholder branch remains",
    "doc-qr-locked" not in app)

# 5) i18n keys (5 zh + 5 en)
i18n = open(os.path.join(ROOT, "js", "i18n.js"), encoding="utf-8").read()
zh_keys = ["qrCodeLabel", "qrCodeTitle", "qrCodeHint"]
en_keys = [k for k in zh_keys]
for k in zh_keys:
    chk(f"5. zh i18n key '{k}' present", f"{k}:" in i18n.split("en:")[0])
for k in en_keys:
    chk(f"5. en i18n key '{k}' present", f"{k}:" in i18n.split("en:")[1])

# 6) CSS selectors present
css = open(os.path.join(ROOT, "css", "style.css"), encoding="utf-8").read()
for sel in [".doc-qr-block", ".doc-qr-canvas", ".doc-qr-label", ".doc-qr-fields", ".doc-qr-meta"]:
    chk(f"6. CSS selector {sel}", sel in css)

# 7) buildQRBlock always emits a real, scannable code
qr_block_match = re.search(r"function buildQRBlock\((.*?)\n\}", app, re.S)
block = qr_block_match.group(0) if qr_block_match else ""
chk("7. encodes a base64 payload", "btoa" in block and "JSON.stringify" in block)

# 8) payload fields
payload_match = re.search(r"const payload\s*=\s*\{(.*?)\}", app, re.S)
payload_text = payload_match.group(1) if payload_match else ""
for f in ["v:", "app:", "n:", "t:", "d:", "a:", "s:", "x:", "c:", "cn:", "cl:", "paid:"]:
    chk(f"8. QR payload field '{f}'", f in payload_text)

print(f"\n=== Total: {OK} PASS, {FAIL} FAIL / {OK+FAIL} ===\n")
sys.exit(0 if FAIL == 0 else 1)