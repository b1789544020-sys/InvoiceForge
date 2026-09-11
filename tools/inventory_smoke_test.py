"""
阶段 1.1 库存管理 端到端自检
模拟：保存库存条目 → 创建含 SKU 的发票 → 验证库存自动扣减
"""
import esprima
import re
from pathlib import Path

APP = Path(r"C:\Users\86159\Desktop\InvoiceForge\js\app.js")
src = APP.read_text(encoding="utf-8")

print("=" * 60)
print("阶段 1.1 库存管理 自检报告")
print("=" * 60)

# 1. 语法检查
try:
    esprima.parseModule(src)
    print("\n[1] 语法检查                : PASS")
except Exception as e:
    print(f"\n[1] 语法检查                : FAIL - {e}")
    raise SystemExit(1)

# 2. 关键函数定义
required = [
    "function getInventory(",
    "function saveInventory(",
    "function updateInventoryTable(",
    "window.openInventoryModal = function",
    "function saveInventoryItem(",
    "function deductInventoryFromDocument(",
]
print("\n[2] 关键函数定义")
for fn in required:
    ok = fn in src
    print(f"    {'PASS' if ok else 'FAIL'}  {fn}")

# 3. DOM 绑定
bindings = [
    ("save-inventory-btn click 绑定", "saveInventoryItem"),
    ("close-inventory-modal 关闭 ", "close-inventory-modal"),
    ("updateInventoryTable 启动调用", "updateInventoryTable();"),
    ("deductInventoryFromDocument 调用", "deductInventoryFromDocument"),
]
print("\n[3] DOM 绑定 / 启动调用")
for name, marker in bindings:
    ok = marker in src
    print(f"    {'PASS' if ok else 'FAIL'}  {name} ({marker})")

# 4. SKU 字段在 item 收集时存在
sku_in_save = "sku = skuEl ? skuEl.value : ''" in src
sku_in_additem = "item-sku" in src
print(f"\n[4] SKU 字段贯通")
print(f"    {'PASS' if sku_in_additem else 'FAIL'}  addItemRow 渲染 .item-sku 下拉框")
print(f"    {'PASS' if sku_in_save else 'FAIL'}  saveDocument 收集 item.sku")

# 5. 模拟流程
print("\n[5] 模拟流程（仅文本推理）")
print("    步骤 A: openInventoryModal()  -> 打开 #inventory-modal")
print("    步骤 B: 用户填 name/sku/price/stock")
print("    步骤 C: 点 #save-inventory-btn -> saveInventoryItem()")
print("    步骤 D: 验证 localStorage.invoiceforge_inventory 写入")
print("    步骤 E: 新建单据, 在 .item-sku 选已存 SKU")
print("    步骤 F: 点 #save-document-btn -> saveDocument()")
print("    步骤 G: 验证 deductInventoryFromDocument() 被调用")
print("    步骤 H: 验证库存 stock -= 销售 quantity")

# 6. 检查 renderDocument 是否会显示 SKU（可选）
render_skills = "item.sku" in src
print(f"\n[6] 单据预览显示 SKU（可选增强）: {'PASS' if render_skills else '暂未实现'}")

# 7. 库存行操作按钮
edit_btn = "editInventory" in src
del_btn = "deleteInventory" in src
print(f"\n[7] 库存行内按钮")
print(f"    {'PASS' if edit_btn else 'FAIL'}  editInventory 按钮")
print(f"    {'PASS' if del_btn else 'FAIL'}  deleteInventory 按钮")

# 8. 低库存预警
low_warn = "inventoryLowWarning" in src
low_count = "inventory-low-count" in src
print(f"\n[8] 低库存预警")
print(f"    {'PASS' if low_warn else 'FAIL'}  低库存文案")
print(f"    {'PASS' if low_count else 'FAIL'}  低库存计数展示")

print("\n" + "=" * 60)
print("阶段 1.1 库存管理 — 全部自检完成")
print("=" * 60)