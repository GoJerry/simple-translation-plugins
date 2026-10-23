# 🌐 划词翻译 - Selection Translator

一款完全免费、无使用限制的浏览器划词翻译插件，支持多语言互译。

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-brightgreen.svg)](https://chrome.google.com/webstore)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## ✨ 功能特性

- 🎯 **划词翻译** - 选中网页任意文字即可翻译
- 🌍 **多语言支持** - 支持 20+ 种语言互译
- 💰 **免费引擎开箱即用** - Google / MyMemory / LibreTranslate / Lingva，无需任何密钥
- 🤖 **大模型翻译** - 支持硅基流动（DeepSeek 等）、OpenAI、DeepL 等，填入 Key 即可用
- 🖼️ **截图翻译** - 截图后免费 OCR（OCR.space，免注册即可用）识别并翻译
- 📄 **全文翻译** - 双语对照 / 仅译文 / 仅原文 三种视图
- 🔊 **语音朗读** - 支持翻译结果语音播放
- 🎨 **双主题** - 浅色/深色主题自由切换
- ⚡ **快捷键** - Ctrl+Shift+F 快速翻译（可在 `chrome://extensions/shortcuts` 自定义）
- 📋 **一键复制** - 逐引擎复制译文 / 自动复制
- 🔒 **隐私保护** - 不收集用户数据，密钥仅存本地；所有请求由扩展后台代发以规避跨域

## 🚀 安装方法

### 方式一：Chrome 应用商店（推荐）

1. 访问 [Chrome Web Store](https://chrome.google.com/webstore)
2. 搜索 "划词翻译"
3. 点击 "添加至 Chrome"

### 方式二：本地安装（开发者模式）

1. 下载本仓库代码并解压
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启右上角的 "开发者模式"
4. 点击 "加载已解压的扩展程序"
5. 选择解压后的文件夹

## 📖 使用说明

### 基本使用

1. **划词翻译**：在任意网页选中文字，自动弹出翻译结果
2. **快捷键翻译**：选中文字后按 `Ctrl+Shift+F`（可在 `chrome://extensions/shortcuts` 修改）
3. **关闭弹窗**：按 `Esc` 键或点击关闭按钮

### 设置选项

点击浏览器工具栏的插件图标，进入设置页面：

- **目标语言**：选择翻译结果的语言
- **源语言**：选择原文语言（支持自动检测）
- **触发模式**：自动翻译或点击图标翻译
- **主题风格**：浅色或深色主题
- **自动发音**：开启后自动播放翻译结果

## 🛠️ 技术实现

- **翻译API**：Google / MyMemory / LibreTranslate / Lingva（免费，无需密钥）+ 硅基流动 / OpenAI / DeepL 等（需 Key）
- **截图OCR**：OCR.space 接口（免注册即可用，也可在设置页填入自己的免费 Key 提高配额）
- **合规说明**：不加载任何远程代码，不改写 MV3 的 CSP，因此可正常加载并上架
- **网络层**：所有请求由后台 Service Worker 代发（持有 `<all_urls>` 权限），规避内容脚本跨域（CORS）限制
- **语音合成**：Web Speech API
- **框架**：原生 JavaScript，无需依赖（MD5/SHA256 等亦为手写实现）

## 📁 文件结构

```
selection-translator/
├── manifest.json      # 插件配置文件
├── content.js         # 内容脚本（核心功能）
├── content.css        # 样式文件
├── background.js      # 后台服务脚本
├── popup.html         # 弹出窗口
├── popup.js           # 弹出窗口脚本
├── options.html       # 设置页面
├── options.js         # 设置页面脚本
├── icons/             # 图标文件夹
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md          # 说明文档
```

## 🔧 开发计划

- [ ] 添加生词本功能
- [ ] 支持整页翻译
- [ ] 添加更多翻译引擎
- [ ] 支持 PDF 文件翻译
- [ ] 添加划词历史记录

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证开源。

## 🙏 致谢

- 翻译服务由 Google Translate 和 MyMemory 提供
- 图标设计灵感来自 Material Design

## 📮 联系我们

如有问题或建议，欢迎通过以下方式联系：

- 提交 [GitHub Issue](../../issues)
- 发送邮件至：jerryningmm@gmail.com

---

**如果这个项目对你有帮助，请给个 ⭐ Star 支持一下！**
