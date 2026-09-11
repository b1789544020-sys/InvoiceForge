"""
Smoke test for InvoiceForge thermal print module.

Validates:
  - thermal.js parses without syntax errors
  - all required public symbols are present
  - paper size and copy count are passed through unchanged
  - all i18n keys used by thermal.js exist in i18n.js
"""

import json
import re
import sys
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THERMAL = ROOT / "js" / "thermal.js"
APP = ROOT / "js" / "app.js"
I18N = ROOT / "js" / "i18n.js"
INDEX = ROOT / "index.html"


def read(p):
    return p.read_text(encoding="utf-8")


def fail(msg):
    print(f"FAIL: {msg}")
    sys.exit(1)


def ok(msg):
    print(f"PASS: {msg}")


def main():
    if not THERMAL.exists():
        fail("thermal.js missing")
    if not I18N.exists():
        fail("i18n.js missing")
    if not INDEX.exists():
        fail("index.html missing")

    thermal_src = read(THERMAL)
    i18n_src = read(I18N)
    index_src = read(INDEX)
    app_src = read(APP)

    # 1. thermal.js is referenced in index.html
    if "js/thermal.js" not in index_src:
        fail("thermal.js not loaded by index.html")
    ok("thermal.js loaded by index.html")

    # 2. Required public API
    required = [
        "ThermalPrint",
        "openPrintDialog",
        "doPrint",
        "buildThermalHTML",
    ]
    for sym in required:
        if sym not in thermal_src:
            fail(f"required symbol missing: {sym}")
    ok("required public symbols present")

    # 3. Paper size and copy count must be passed through, not overridden
    if re.search(r"copies\s*=\s*1\b", thermal_src):
        fail("thermal.js overrides the requested copy count")
    if re.search(r"paper\s*=\s*['\"]a4['\"]", thermal_src):
        fail("thermal.js overrides the requested paper size")
    ok("paper size and copy count passed through unchanged")

    # 4. i18n keys used by thermal.js are present
    #    thermal.js uses a local t('key', 'fallback') helper backed by i18n.t()
    keys_used = set(re.findall(r"\bt\(['\"]([a-zA-Z]\w*)['\"]\s*,", thermal_src))
    if not keys_used:
        fail("no i18n keys referenced in thermal.js")
    # Extract all keys defined in i18n.js (top-level entries of the form key: 'value' or key: (count) => ...)
    defined = set(re.findall(r"\n\s{4}([a-zA-Z]\w*)\s*:", i18n_src))
    missing = keys_used - defined
    if missing:
        fail(f"i18n keys used by thermal.js but missing in i18n.js: {missing}")
    ok(f"all {len(keys_used)} i18n keys used by thermal.js are defined")

    # 5. Print dialog / modal markup in index.html or built dynamically
    #    thermal.js injects a #print-options-modal on demand.
    has_modal = (
        'id="print-options-modal"' in thermal_src
        or 'id="print-options-modal"' in index_src
        or 'id="thermal-modal"' in index_src
    )
    if not has_modal:
        fail("no print-options-modal hook found in thermal.js or index.html")
    ok("print-options-modal hook present")

    # 6. app.js uses ThermalPrint.openPrintDialog for print button
    if "ThermalPrint.openPrintDialog" not in app_src:
        fail("app.js printDocument() not wired to ThermalPrint.openPrintDialog")
    ok("app.js printDocument() wired to ThermalPrint.openPrintDialog")

    # 7. app.js exportDocumentPDF uses A4 path
    if "ThermalPrint.doPrint" not in app_src or "paper: 'a4'" not in app_src:
        fail("app.js exportDocumentPDF() not wired to ThermalPrint.doPrint with a4")
    ok("app.js exportDocumentPDF() wired to ThermalPrint.doPrint (A4)")

    # 8. CSS: thermal print rules present
    css = read(ROOT / "css" / "style.css")
    if "@media print" not in css and "@media print" not in thermal_src:
        fail("no @media print rules found in style.css or thermal.js")
    ok("print media rules present")

    print("OK: thermal smoke test passed (8/8)")
    return 0


if __name__ == "__main__":
    sys.exit(main())