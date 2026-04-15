# 🚀 发布指南

本文档指导你如何将此插件发布到 GitHub 和 Chrome Web Store。

---

## 📦 第一步：准备图标

由于图标需要是 PNG 格式，你需要将 `icons/icon.svg` 转换为以下尺寸的 PNG 文件：

- `icon16.png` - 16x16 像素
- `icon32.png` - 32x32 像素
- `icon48.png` - 48x48 像素
- `icon128.png` - 128x128 像素

**转换方法：**
1. 在线工具：[SVG to PNG](https://cloudconvert.com/svg-to-png)
2. 或设计软件（Photoshop、Figma 等）
3. 确保背景是透明的

---

## 📁 第二步：打包插件

### 方法：手动打包

1. 确保所有文件都已准备就绪：
   ```
   selection-translator/
   ├── manifest.json
   ├── content.js
   ├── styles.css
   ├── background.js
   ├── popup.html
   ├── popup.js
   ├── options.html
   ├── options.js
   ├── icons/
   │   ├── icon16.png
   │   ├── icon32.png
   │   ├── icon48.png
   │   └── icon128.png
   ├── README.md
   ├── LICENSE
   └── PRIVACY.md
   ```

2. 将所有文件压缩为 ZIP 文件：
   - Windows：选中所有文件 → 右键 → 发送到 → 压缩文件夹
   - Mac：选中所有文件 → 右键 → 压缩
   - 命名为 `selection-translator-v1.0.0.zip`

---

## 🌐 第三步：发布到 GitHub

### 创建仓库

1. 访问 [github.com](https://github.com) 并登录
2. 点击右上角的 "+" → "New repository"
3. 填写信息：
   - **Repository name**: `selection-translator`
   - **Description**: `免费的浏览器划词翻译插件，支持多语言互译`
   - **Public** (选中)
   - **Add a README file**: 不勾选（已有 README）
4. 点击 "Create repository"

### 上传代码

**方法一：使用 Git 命令行**

```bash
# 在插件文件夹中打开终端
cd selection-translator

# 添加远程仓库（替换 yourusername 为你的 GitHub 用户名）
git remote add origin https://github.com/yourusername/selection-translator.git

# 推送代码
git branch -M main
git push -u origin main
```

**方法二：网页上传**

1. 在新创建的仓库页面，点击 "uploading an existing file"
2. 拖拽所有文件到上传区域
3. 点击 "Commit changes"

---

## 🛒 第四步：发布到 Chrome Web Store

### 准备工作

1. **注册开发者账号**
   - 访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
   - 登录 Google 账号
   - 支付 $5 开发者注册费（一次性）

2. **准备宣传图片**（商店展示用）
   - **商店图标**: 128x128 像素（PNG）
   - **截图**: 1280x800 或 640x400 像素，最多 5 张
   - **宣传图**: 440x280 像素（可选）
   - ** Marquee 图**: 1400x560 像素（可选）

### 提交插件

1. 访问 [Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. 点击 "New Item"
3. 上传 ZIP 文件
4. 填写商店信息：

#### 基本信息

| 字段 | 填写内容 |
|------|----------|
| **名称** | 划词翻译 - Selection Translator |
| **简短描述** | 免费的划词翻译工具，支持多语言互译，无使用限制 |
| **详细描述** | 见下方模板 |
| **类别** | 生产力工具 / 辅助功能 |
| **语言** | 中文（简体）|

#### 详细描述模板

```
🌐 划词翻译 - 让网页阅读无障碍

一款完全免费、无使用限制的浏览器划词翻译插件。

✨ 主要功能：
• 划词即译 - 选中文字立即显示翻译
• 多语言支持 - 支持 20+ 种语言互译
• 完全免费 - 无次数限制，无需 API 密钥
• 语音朗读 - 支持翻译结果发音
• 快捷键支持 - Ctrl+Shift+T 快速翻译
• 双主题 - 浅色/深色主题自由切换

🚀 使用方法：
1. 在任意网页选中文字
2. 自动弹出翻译结果
3. 点击朗读按钮听取发音
4. 点击复制按钮复制结果

🔒 隐私保护：
本插件不收集任何用户数据，所有设置仅保存在本地。

💡 快捷键：
• Ctrl+Shift+T: 翻译选中文本
• Esc: 关闭翻译弹窗

如有问题或建议，欢迎通过 GitHub 反馈！
```

5. **上传图片**：
   - 商店图标（必需）
   - 截图（至少 1 张，建议 3-5 张）

6. **隐私设置**：
   - 选择 "This item uses the Privacy practices from its Privacy policy"
   - 上传 `PRIVACY.md` 或填写隐私说明

7. **定价和发布范围**：
   - 价格：免费
   - 发布范围：公开

8. 点击 "Submit for review"

### 审核时间

- 通常需要 1-3 个工作日
- 审核通过后会收到邮件通知
- 插件会自动发布到 Chrome Web Store

---

## 🔄 第五步：后续更新

### 版本更新流程

1. **修改版本号**：编辑 `manifest.json`
   ```json
   {
     "version": "1.0.1"
   }
   ```

2. **提交代码**：
   ```bash
   git add .
   git commit -m "Update to v1.0.1: 修复xxx问题"
   git push
   ```

3. **重新打包**：压缩所有文件为新的 ZIP

4. **提交更新**：
   - 访问 Developer Dashboard
   - 找到你的插件
   - 点击 "Package" → "Upload new package"
   - 上传新的 ZIP 文件
   - 填写更新说明
   - 提交审核

---

## 📋 发布清单

发布前请确认：

- [ ] 所有图标文件已准备（16, 32, 48, 128 PNG）
- [ ] manifest.json 中的版本号正确
- [ ] 所有功能已测试通过
- [ ] README.md 内容完整
- [ ] PRIVACY.md 已准备
- [ ] 宣传截图已准备（1280x800）
- [ ] 代码已推送到 GitHub
- [ ] ZIP 文件已打包
- [ ] Chrome Web Store 开发者账号已注册

---

## 🆘 常见问题

### Q: 审核被拒绝怎么办？
A: 仔细阅读拒绝原因，修改后重新提交。常见原因：
- 缺少隐私政策
- 功能描述不清晰
- 图标不符合规范

### Q: 如何测试插件？
A: 在 Chrome 地址栏输入 `chrome://extensions/`，开启开发者模式，点击"加载已解压的扩展程序"选择插件文件夹。

### Q: 支持 Edge 浏览器吗？
A: 支持！Edge 基于 Chromium，可以直接使用相同的插件包。也可以单独提交到 [Edge Add-ons](https://microsoftedge.microsoft.com/addons/Microsoft-Edge-Extensions-Home)。

---

## 📞 需要帮助？

- 查看 [Chrome 扩展开发文档](https://developer.chrome.com/docs/extensions/)
- 访问 [Chrome Web Store 开发者帮助](https://developer.chrome.com/docs/webstore/)
- 提交 GitHub Issue

---

**祝你发布顺利！🎉**
