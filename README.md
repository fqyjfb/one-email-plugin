# 邮箱聚合

多邮箱账号聚合管理插件，支持添加、切换多个邮箱账号，收发、回复、转发、删除与管理邮件。

## 功能特性

- **多账号聚合**：侧边栏统一管理多个邮箱账号（增 / 删 / 改），一键切换
- **服务商预设**：内置 QQ、163、126、腾讯企业邮、阿里、Gmail、Outlook、iCloud 等 14 个常见服务商的 IMAP/SMTP 配置
- **收发邮件**：收件箱列表（分页）、正文阅读、纯文本写信 / 回复 / 转发
- **邮件管理**：标记已读 / 未读、删除（移入垃圾箱）、附件下载
- **凭据加密**：账号密码 / 授权码经 AES-GCM 加密后本地存储
- **暗色模式**：跟随 ToolBox 主题适配

## 架构

邮箱协议（IMAP / SMTP）运行在 ToolBox **主进程**（`imapflow` + `nodemailer` + `mailparser`），插件前端通过 `window.electron.email.*` IPC 调用，渲染进程不直接触网。

## 安装

1.  在 ToolBox 插件商店中搜索「邮箱聚合」安装并打开
3. 「＋ 添加账号」→ 选择服务商预设或手动填写 → 测试连接 → 保存

> 国内邮箱（QQ / 163 等）发信需先在邮箱设置中开启 IMAP/SMTP 服务并获取授权码。

## 构建

```bash
npm install
npm run build
```

构建产物输出到 `dist/index.js`（IIFE 格式，git 跟踪）。

## 技术栈

- React 19 + TypeScript
- Vite 5.x（IIFE 构建）
- Tailwind CSS（CDN 加载）
- Lucide React 图标
- DOMPurify（正文安全清洗）

## 许可证

MIT License
