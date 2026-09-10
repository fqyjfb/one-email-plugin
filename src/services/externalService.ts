// 通用系统能力封装 - 调用 window.electron.shell.openExternal（主程序将来可暴露），回退 window.open
// 沿用 emailService.ts 同样的 (window as any).electron.* 范式，保持与项目既定的协议层风格一致

/**
 * 用系统默认浏览器打开外部链接（mailto:/tel:/http/https）。
 *
 * 当前主程序未暴露 shell 通道时，自动降级为 window.open；
 * window.open 在 Electron BrowserWindow 中默认由主程序 setWindowOpenHandler 接管
 * — 主程序若启用 shell.openExternal 转交，行为即为「系统默认浏览器」。
 *
 * 主程序后续只需注册 `window.electron.shell.openExternal(url)`，本函数将自动走新通道，无需前端再改。
 */
export async function openExternal(url: string): Promise<void> {
  if (!url) return;

  // 1. 优先主程序通用 shell 通道（一次性约定，主程序注册即生效）
  const shell = (window as any).electron?.shell;
  if (shell?.openExternal) {
    try {
      await shell.openExternal(url);
      return;
    } catch (e) {
      console.error('electron.shell.openExternal failed:', e);
    }
  }

  // 2. 兜底：window.open（Electron 中行为取决于主程序窗口策略）
  try {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (win) return;
  } catch (e) {
    console.error('window.open fallback failed:', e);
  }

  // 3. 最后兜底：复制 URL 到剪贴板，避免点击后无任何反馈
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      console.warn('外部链接无法打开，已复制到剪贴板:', url);
    }
  } catch {
    /* noop */
  }
}
