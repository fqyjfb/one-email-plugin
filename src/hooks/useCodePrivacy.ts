/**
 * 验证码隐私遮蔽 Hook（移植 daozai Privacy 状态机的阅读区子集）。
 *
 * - hideSeconds = 0 → 始终显示，不计时。
 * - hideSeconds > 0 → 打开邮件后 min(clamp(hideSeconds,15,300), 显式有效期) 秒后掩码；
 *   点击「查看 15 秒」临时揭示 15 秒。
 * - 只影响展示，不声明验证码失效。
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { MailDetail } from '../types';
import { maskCode, parseExplicitLifetime } from '../utils/codePrivacy';

export interface CodePrivacyState {
  hidden: boolean;
  maskedSubject: string;
  maskedText: string | null;
  maskedHtml: string | null;
  reveal: () => void;
}

export function useCodePrivacy(
  detail: MailDetail | null,
  hideSeconds: number,
): CodePrivacyState {
  const code = detail?.code ?? null;
  const key = detail ? `${detail.accountId ?? ''}:${detail.uid}:${code ?? ''}` : '';

  const [now, setNow] = useState(() => Date.now());
  const firstSeenRef = useRef<number>(Date.now());
  const revealUntilRef = useRef<number>(0);
  const explicitRef = useRef<number | null>(null);
  const lastKeyRef = useRef<string>('');

  // 切换邮件时重置计时与显式有效期
  useEffect(() => {
    if (key !== lastKeyRef.current) {
      lastKeyRef.current = key;
      firstSeenRef.current = Date.now();
      revealUntilRef.current = 0;
      explicitRef.current = code ? parseExplicitLifetime(detail!.subject, detail!.text ?? detail!.html ?? '', code) : null;
      setNow(Date.now());
    }
  }, [key, code, detail]);

  // 仅在需要遮蔽时启动秒级 tick
  useEffect(() => {
    if (!code || !hideSeconds) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [code, hideSeconds]);

  const reveal = useCallback(() => {
    revealUntilRef.current = Date.now() + 15_000;
    setNow(Date.now());
  }, []);

  const fallbackState: CodePrivacyState = {
    hidden: false,
    maskedSubject: detail?.subject ?? '',
    maskedText: detail?.text ?? null,
    maskedHtml: detail?.html ?? null,
    reveal,
  };

  if (!detail || !code || !hideSeconds) return fallbackState;

  // 手动 reveal 窗口期内不遮蔽
  if (revealUntilRef.current > now) return fallbackState;

  const limit = Math.min(Math.max(hideSeconds, 15), 300);
  const withLifetime = explicitRef.current != null ? Math.min(limit, explicitRef.current) : limit;
  const elapsed = (now - firstSeenRef.current) / 1000;
  const hidden = elapsed >= withLifetime;

  if (!hidden) return fallbackState;

  return {
    hidden: true,
    maskedSubject: maskCode(detail.subject, code),
    maskedText: detail.text != null ? maskCode(detail.text, code) : null,
    maskedHtml: detail.html != null ? maskCode(detail.html, code) : null,
    reveal,
  };
}
