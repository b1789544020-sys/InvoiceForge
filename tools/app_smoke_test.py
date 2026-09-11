"""
Browser-level smoke test: loads index.html in Chromium and checks that the
modules initialise, the money math is correct, and nothing throws.

Needs Playwright:

    pip install playwright
    playwright install chromium

Run:
    python tools/app_smoke_test.py
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

# Repo root is the parent of tools/, so this works from any checkout.
INDEX = Path(__file__).resolve().parent.parent / "index.html"

passed = failed = 0
def chk(label, cond, extra=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  PASS  {label}")
    else:
        failed += 1
        print(f"  FAIL  {label}  {extra}")

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page()
    js_errors = []
    page.on("pageerror", lambda e: js_errors.append(str(e)))
    page.goto(INDEX.as_uri())
    page.wait_for_timeout(900)

    print("\n== modules load ==")
    for mod in ["Reports", "Recurring", "SignaturePad", "Snapshots",
                "TemplateEditor", "ThermalPrint", "Encryption"]:
        chk(f"{mod} available",
            page.evaluate(f"typeof window.{mod} !== 'undefined'"))

    print("\n== storage round-trip ==")
    count = page.evaluate("""() => {
        const docs = [];
        for (let i = 0; i < 12; i++) {
            docs.push({ id: 'd' + i, type: 'invoice', number: 'INV-' + i,
                        items: [{ description: 'x', quantity: 1,
                                  price: 100, tax: 0 }],
                        subtotal: 100, totalTax: 0, total: 100 });
        }
        saveDocuments(docs);
        return getDocuments().length;
    }""")
    chk("12 documents saved and read back", count == 12, f"got {count}")

    print("\n== thermal paper options ==")
    opts = page.evaluate(
        "() => ThermalPrint.effectiveOptions("
        "{ paper: 'thermal58', copies: 3 })")
    chk("58mm paper honoured", opts.get("paper") == "thermal58", opts)
    chk("copy count honoured", opts.get("copies") == 3, opts)

    print("\n== totals ==")
    # The per-line tax field is `tax`, expressed as a percentage.
    t = page.evaluate("""() => computeDocumentTotals(
        [{ quantity: 2, price: 100, tax: 13 },
         { quantity: '1', price: '50', tax: 0 }])""")
    chk("subtotal 250", t["subtotal"] == 250, t)
    chk("tax 26", t["totalTax"] == 26, t)
    chk("total 276", t["total"] == 276, t)

    chk("string amounts are coerced, not concatenated",
        page.evaluate("() => computeDocumentTotals("
                      "[{ quantity: '2', price: '3', tax: 0 }]).subtotal") == 6)

    chk("unparseable input never yields NaN",
        page.evaluate(
            "() => { const r = computeDocumentTotals("
            "[{ quantity: 'x', price: null, tax: undefined }]);"
            " return isNaN(r.total); }") is False)

    chk("empty / missing items list is safe",
        page.evaluate("() => computeDocumentTotals(null).total") == 0)

    print("\n== stored totals win over recomputation ==")
    resolved = page.evaluate("""() => resolveDocumentTotals({
        items: [{ quantity: 1, price: 110, tax: 0 }],
        subtotal: 500, totalTax: 65, total: 565 })""")
    chk("persisted total kept", resolved["total"] == 565, resolved)

    fallback = page.evaluate("""() => resolveDocumentTotals({
        items: [{ quantity: 1, price: 110, tax: 0 }] })""")
    chk("recomputed when absent", fallback["total"] == 110, fallback)

    print("\n== no JS errors ==")
    chk("clean console", not js_errors, js_errors)

    browser.close()

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
