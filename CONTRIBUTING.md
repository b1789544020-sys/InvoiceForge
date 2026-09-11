# 贡献指南

欢迎提 Issue 和 Pull Request。

## 项目原则

1. **纯前端，零构建**。不引入打包工具、不加 `npm install` 步骤。
   双击 `index.html` 就应该能跑起来。
2. **数据只留在本地**。不要添加任何会把用户数据发往服务器的代码，
   也不要加统计 / 追踪脚本。
3. **中英双语同步**。新增界面文案时，`js/i18n.js` 的 `zh` 和 `en`
   两个词条都要加。

## 开发环境

不需要安装依赖。直接用浏览器打开 `index.html` 即可。

若要修改后立即验证，建议起一个静态服务器（避免部分浏览器对
`file://` 的限制）：

```bash
python -m http.server 8000
# 然后访问 http://localhost:8000
```

## 提交前请跑一遍冒烟测试

```bash
python tools/inventory_smoke_test.py
python tools/qrcode_smoke_test.py
python tools/reminders_smoke_test.py
python tools/thermal_smoke_test.py
```

四个脚本都应输出 `exit=0`。它们是静态检查（源码结构 + i18n 键完整性），
不需要浏览器，也不需要额外的 Python 包。

还有一个浏览器实机测试，验证各模块正常加载、金额计算正确、无 JS 报错。
它需要 Playwright：

```bash
pip install playwright
playwright install chromium
python tools/app_smoke_test.py
```

## 代码风格

- 缩进 2 空格
- 现有文件是 UTF-8 + CRLF，请保持不变
- 拼接 HTML 时，凡是用户可控的字符串都必须经过 `escapeHtml()`
- 金额计算统一走 `computeDocumentTotals()` / `resolveDocumentTotals()`，
  不要再各处重写累加逻辑

## 新增功能时

- 独立功能建议单独放一个 `js/xxx.js`，用 IIFE 挂到 `window` 上，
  参考 `js/reports.js`
- 记得在 `index.html` 里加上 `<script>` 标签（注意加载顺序：
  独立模块在 `app.js` 之前）
- 在 `CHANGELOG.md` 顶部记一行
