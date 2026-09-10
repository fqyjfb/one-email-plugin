// 邮件地址拆分与校验工具 — 收件人/抄送/密送三处共用

/** 拆分地址串：兼容中英文逗号/分号分隔，自动 trim 与去空 */
export function splitAddresses(s: string): string[] {
  return s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
}

/** 轻量邮箱格式校验 */
export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
