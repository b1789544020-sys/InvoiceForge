# InvoiceForge - 本地发票/商业单据管理工具

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![No build step](https://img.shields.io/badge/build-none-blue)
![Offline first](https://img.shields.io/badge/offline-100%25-brightgreen)

中文 | [English](README-EN.md)

InvoiceForge 是一款纯前端本地运行的发票/商业单据管理工具，专为自由职业者、顾问和小微企业设计。在浏览器中创建管理各种商业单据，所有数据保存在用户本地浏览器，不需要云端服务器。

> 开源、免费。数据全部留在你自己的浏览器里，不联网。

## 🚀 特性

### 核心功能

✅ **多类型单据** - 支持发票、报价单、收据、采购单、形式发票、贷记通知单 6种  
✅ **客户管理** - 保存客户信息，开单快速选择  
✅ **产品库** - 保存常用产品/服务，记录价格税率，快速添加到单据  
✅ **实时预览** - 编辑时实时预览打印效果，4种模板风格可选（经典/现代/极简/醒目）  
✅ **导出** - 打印/PDF导出、CSV导出  
✅ **数据备份** - 导出全部JSON备份，从JSON恢复数据  
✅ **仪表盘统计** - 展示已收总额、待收款、逾期、单据数，显示最近单据  
✅ **中英文切换** - 一键切换界面语言  
✅ **公司设置** - 保存公司信息，上传Logo，设置默认货币、税率、账期  

### 进阶功能

✅ 库存管理（出入库、低库存阈值、开票自动扣减）
✅ 支付跟踪（标记已收款、付款方式、逾期统计）
✅ 逾期提醒
✅ 加密存储（密码保护）
✅ 模板编辑器（自定义主色/强调色）
✅ 热敏打印（80mm / 58mm 小票、多份打印）
✅ 电子签名（手写 + 文字两种）
✅ 单据二维码
✅ 版本快照 / 回滚
✅ 定期自动账单
✅ 高级报表（收入趋势、客户排行、CSV 导出）
✅ 多税率支持

## 🛡️ 隐私

无需注册、无需联网。所有数据存在浏览器 localStorage，完全本地，隐私可控。

## 💻 使用方法

### 直接运行

1. 下载项目文件
2. 双击打开 `index.html` 在浏览器中打开
3. 开始使用！无需安装，无需后端，所有数据保存在本地

### 在线使用

可以直接部署到任何静态网站托管服务（如Vercel, Netlify, GitHub Pages等）

## 🔧 技术栈

- 纯 HTML/CSS/JavaScript 实现
- Tailwind CSS via CDN
- 无需后端，浏览器直接运行
- 响应式设计，适配桌面和移动设备

## 📝 开发

项目结构：

```
InvoiceForge/
├── index.html              # 单文件入口
├── css/
│   └── style.css           # 自定义样式
├── js/
│   ├── app.js              # 主应用逻辑（单据 / 客户 / 产品 / 库存 / 仪表盘）
│   ├── i18n.js             # 中英双语字典
│   ├── templates.js        # 4 套模板渲染
│   ├── qrcode.js           # 二维码生成（本地实现，无 CDN 依赖）
│   ├── encryption.js       # 加密存储
│   ├── recurring.js        # 定期自动账单
│   ├── reports.js          # 高级报表
│   ├── reminders.js        # 逾期提醒
│   ├── signature.js        # 电子签名
│   ├── snapshots.js        # 版本快照 / 回滚
│   ├── template-editor.js  # 模板编辑器
│   └── thermal.js          # 热敏打印
├── docs/
│   └── FEATURES-CN.md      # 详细功能清单
└── tools/                  # 冒烟测试脚本（Python）
```

## 🧪 测试

`tools/` 下是静态冒烟测试，检查源码结构与 i18n 键的完整性，无需浏览器：

```bash
python tools/inventory_smoke_test.py
python tools/qrcode_smoke_test.py
python tools/reminders_smoke_test.py
python tools/thermal_smoke_test.py
```

另有一个浏览器实机测试，需要 Playwright（`pip install playwright` +
`playwright install chromium`）：

```bash
python tools/open_source_smoke_test.py
```

## 🎨 模板风格

1. **经典** - 传统商务风格，适合正式场合
2. **现代** - 深色头部，清爽专业
3. **极简** - 简约现代，留白设计
4. **醒目** - 亮色强调，现代感强

## 🔒 隐私

- 所有数据存储在您的浏览器本地存储中
- 数据不会上传到任何服务器
- 您可以随时导出备份，掌握自己的数据

## 🤝 贡献

欢迎提 Issue 和 PR，详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 📄 许可证

MIT License — 可自由使用、修改、分发。详见 [LICENSE](LICENSE)。