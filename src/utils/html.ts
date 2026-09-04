// HTML 文本转换工具 - 用于富文本写信：纯文本 ↔ HTML 互转、转义

/** 转义 HTML 特殊字符（把纯文本安全地嵌入 HTML，防止破坏结构 / XSS） */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 纯文本 → HTML（换行转 <br>） */
export function plainTextToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

/** HTML → 纯文本（取 innerText） */
export function htmlToPlainText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.innerText || '';
}
