/**
 * 验证码提取结果的进程内 LRU 缓存。
 * 同一封邮件（账号 + uid）只提取一次，右键/行内徽标/阅读区共享。
 * 渲染层模块单例；主进程另有独立缓存（见 emailService.cjs）。
 */

const CAPACITY = 200;
const store = new Map<string, string>();

export function otpKey(accountId: string | null | undefined, uid: number): string {
  return `${accountId ?? ''}:${uid}`;
}

export function getCachedOtp(key: string): string | undefined {
  return store.get(key);
}

export function hasCachedOtp(key: string): boolean {
  return store.has(key);
}

export function setCachedOtp(key: string, code: string): void {
  if (store.has(key)) {
    store.delete(key);
  } else if (store.size >= CAPACITY) {
    const first = store.keys().next().value;
    if (first != null) store.delete(first);
  }
  store.set(key, code);
}

/** 仅供测试/调试：清空缓存。 */
export function clearOtpCache(): void {
  store.clear();
}
