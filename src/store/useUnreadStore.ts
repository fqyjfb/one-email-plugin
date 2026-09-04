// 未读计数：IMAP IDLE 实时推送 + 定时轮询兜底，用于侧边栏角标
// 性能：新邮件事件短时去抖 + 并发去重，避免每封新邮件都触发一次昂贵的
// getUnreadCounts（主进程会 list + 逐文件夹 status，N 个文件夹 = N 次往返）
//
// 注意：本 hook 不直接订阅 emailService.onNewMail（preload 端为单订阅覆盖式），
// 只暴露 scheduleUnreadRefresh / adjustUnread，由调用方统一管理订阅。

import { useState, useCallback, useEffect, useRef } from 'react';
import type { AccountMeta, Credential } from '../types';
import * as emailService from '../services/emailService';

const POLL_INTERVAL = 30000; // 定时轮询兜底（30s，更敏感）
const EVENT_DEBOUNCE = 250; // 新邮件事件去抖（毫秒）

export function useUnreadStore(
  accounts: AccountMeta[],
  decrypt: (account: AccountMeta) => Promise<Credential | null>,
) {
  const [unread, setUnread] = useState<Record<string, number>>({});
  const decryptRef = useRef(decrypt);
  decryptRef.current = decrypt;

  // 并发去重：一次进行中的 refresh 尚未结束时，新的请求只标记 pending，
  // 由进行中的那次在收尾时补跑一次，避免多连接同时拉取全文件夹状态。
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }
    inFlightRef.current = true;
    try {
      const next: Record<string, number> = {};
      await Promise.all(
        accounts.map(async (acc) => {
          try {
            const cred = await decryptRef.current(acc);
            if (!cred) {
              next[acc.id] = 0;
              return;
            }
            const counts = await emailService.getUnreadCounts(acc, cred);
            next[acc.id] = counts['INBOX'] ?? 0;
          } catch {
            next[acc.id] = 0;
          }
        }),
      );
      setUnread(next);
    } finally {
      inFlightRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        void refresh();
      }
    }
  }, [accounts]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // 新邮件事件去抖：短时多封到达只触发一次未读刷新
  const eventTimer = useRef<number | null>(null);
  const scheduleUnreadRefresh = useCallback(() => {
    if (eventTimer.current) window.clearTimeout(eventTimer.current);
    eventTimer.current = window.setTimeout(() => {
      eventTimer.current = null;
      void refreshRef.current();
    }, EVENT_DEBOUNCE);
  }, []);

  const cancelScheduledRefresh = useCallback(() => {
    if (eventTimer.current) {
      window.clearTimeout(eventTimer.current);
      eventTimer.current = null;
    }
  }, []);

  // 就地增减某账号未读数（标记已读/未读/删除/移动时立即同步到侧边栏角标，
  // 避免等待 IDLE 推送或 30s 轮询才反映状态变化）
  const adjustUnread = useCallback((accountId: string, delta: number) => {
    if (!accountId || !delta) return;
    setUnread((prev) => {
      const cur = prev[accountId];
      if (cur === undefined) return prev; // 尚未拉取过该账号，跳过
      const next = Math.max(0, cur + delta);
      if (next === cur) return prev;
      return { ...prev, [accountId]: next };
    });
  }, []);

  // 定时轮询兜底（IDLE 之外的可靠性保障）
  useEffect(() => {
    if (accounts.length === 0) {
      setUnread({});
      return;
    }
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [accounts, refresh]);

  // 为每个账号启动 IDLE 长连接监听；变化/卸载时停止
  useEffect(() => {
    accounts.forEach((acc) => {
      decryptRef.current(acc).then((cred) => {
        if (cred) emailService.watchStart(acc, cred, acc.id).catch(() => {});
      });
    });
    return () => {
      accounts.forEach((acc) => {
        emailService.watchStop(acc.id).catch(() => {});
      });
      cancelScheduledRefresh();
    };
  }, [accounts, cancelScheduledRefresh]);

  // 窗口聚焦 / 切到前台时立即拉一次未读：用户在外部（Web / 手机）把邮件
  // 处理完了切回本插件窗口，立即同步服务端真实状态，不必等 30s 轮询。
  // 注意：IMAP IDLE 只推新邮件 / 删除事件，不推已读变更，这是唯一能即时
  // 反映外部「已读处理」的入口。用 refreshRef 避免事件回调闭包过期。
  useEffect(() => {
    const trigger = () => {
      void refreshRef.current();
    };
    const onVisibility = () => {
      if (!document.hidden) trigger();
    };
    window.addEventListener('focus', trigger);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', trigger);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return {
    unread,
    refreshUnread: refresh,
    scheduleUnreadRefresh,
    adjustUnread,
  };
}