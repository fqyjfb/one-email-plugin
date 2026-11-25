/**
 * 验证码提取服务：封装 otp 算法 + 缓存，供 store / 右键菜单 / 阅读区共用。
 * 主进程若已在 getMessage 返回 code，则直接复用，不再重复计算。
 */
import { extractOtpFromMail } from '../utils/otp';
import type { MailDetail } from '../types';
import { getCachedOtp, setCachedOtp, otpKey } from './otpCache';

export { otpKey } from './otpCache';

/** 给定详情，返回验证码（优先主进程结果，其次缓存，最后实时计算并缓存）。 */
export function computeDetailCode(detail: MailDetail, fallbackAccountId?: string | null): string | null {
  if (detail.code != null) {
    if (detail.code) {
      setCachedOtp(otpKey(detail.accountId ?? fallbackAccountId, detail.uid), detail.code);
    }
    return detail.code;
  }
  const key = otpKey(detail.accountId ?? fallbackAccountId, detail.uid);
  const cached = getCachedOtp(key);
  if (cached != null) return cached;
  const code = extractOtpFromMail({
    subject: detail.subject,
    text: detail.text,
    html: detail.html,
  });
  if (code) setCachedOtp(key, code);
  return code;
}
