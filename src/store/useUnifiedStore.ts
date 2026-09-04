// 统一收件箱 - 聚合所有账号 INBOX 邮件，按时间倒序合并
// 每封邮件注入 accountId / accountEmail，用于按账号上下文读取 / 回复 / 删除 / 搜索

import { useState, useCallback, useEffect, useRef } from 'react';
import type { AccountMeta, Credential, MailMeta, MailDetail } from '../types';
import * as emailService from '../services/emailService';

/** 侧边栏「统一收件箱」虚拟入口 id */
export const UNIFIED_ID = '__unified__';

const INBOX = 'INBOX';
const PAGE_SIZE = 50;

export function useUnifiedStore(
  accounts: AccountMeta[],
  decrypt: (account: AccountMeta) => Promise<Credential | null>,
  active = true,
  // 已读/删除/移动成功后立即同步到侧边栏未读角标（(accountId, delta) 形式）
  onSeenChange?: (accountId: string, delta: number) => void,
) {
  const [messages, setMessages] = useState<MailMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimer = useRef<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<MailDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decryptRef = useRef(decrypt);
  decryptRef.current = decrypt;

  // messages 同步镜像，供 markSeen/deleteMail 读取"操作前 seen 状态"——避免闭包过期
  const messagesRef = useRef<MailMeta[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const all: MailMeta[] = [];
    await Promise.all(
      accounts.map(async (acc) => {
        try {
          const cred = await decryptRef.current(acc);
          if (!cred) return;
          const res = await emailService.listMessages(acc, cred, INBOX, 0, PAGE_SIZE);
          for (const m of res.messages) {
            all.push({ ...m, accountId: acc.id, accountEmail: acc.email });
          }
        } catch {
          // 单账号失败跳过，不阻断整体
        }
      }),
    );
    all.sort((a, b) => b.date - a.date);
    setMessages(all);
    setLoading(false);
  }, [accounts]);

  // 跨账号全文搜索（IMAP SEARCH，每个账号搜一遍后合并）
  const doSearch = useCallback(
    async (query: string) => {
      setSearching(true);
      setError(null);
      const all: MailMeta[] = [];
      await Promise.all(
        accounts.map(async (acc) => {
          try {
            const cred = await decryptRef.current(acc);
            if (!cred) return;
            const res = await emailService.searchMessages(acc, cred, INBOX, query, PAGE_SIZE);
            for (const m of res.messages) {
              all.push({ ...m, accountId: acc.id, accountEmail: acc.email });
            }
          } catch {
            // skip
          }
        }),
      );
      all.sort((a, b) => b.date - a.date);
      setMessages(all);
      setSearching(false);
    },
    [accounts],
  );

  const runSearch = useCallback(
    (q: string) => {
      setSearchQuery(q);
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
      const query = q.trim();
      if (!query) {
        void refresh();
        return;
      }
      searchTimer.current = window.setTimeout(() => {
        void doSearch(query);
      }, 350);
    },
    [refresh, doSearch],
  );

  useEffect(() => {
    if (accounts.length === 0) {
      setMessages([]);
      setSelectedDetail(null);
      setError(null);
      setSearchQuery('');
      return;
    }
    void refresh();
  }, [accounts, refresh]);

  const openMail = useCallback(
    async (meta: MailMeta) => {
      const acc = accounts.find((a) => a.id === meta.accountId);
      if (!acc) return;
      const cred = await decryptRef.current(acc);
      if (!cred) {
        setError('凭据解密失败，请重新编辑账号');
        return;
      }
      setLoadingDetail(true);
      setError(null);
      try {
        const detail = await emailService.getMessage(acc, cred, INBOX, meta.uid);
        setSelectedDetail({ ...detail, accountId: acc.id });
        if (!meta.seen) {
          await emailService.setSeen(acc, cred, INBOX, [meta.uid], true);
          setMessages((prev) => prev.map((m) => (m.uid === meta.uid ? { ...m, seen: true } : m)));
          // 未读 -1 → 侧边栏角标立即减
          onSeenChange?.(acc.id, -1);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoadingDetail(false);
      }
    },
    [accounts, onSeenChange],
  );

  const markSeen = useCallback(
    async (accountId: string, uid: number, seen: boolean) => {
      const acc = accounts.find((a) => a.id === accountId);
      if (!acc) return;
      const cred = await decryptRef.current(acc);
      if (!cred) return;
      const wasSeen = messagesRef.current.find((m) => m.uid === uid)?.seen ?? false;
      const delta = wasSeen === seen ? 0 : seen ? -1 : +1;
      try {
        await emailService.setSeen(acc, cred, INBOX, [uid], seen);
        setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, seen } : m)));
        if (delta) onSeenChange?.(accountId, delta);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [accounts, onSeenChange],
  );

  // 删除（与单账号一致：优先移入该账号垃圾箱，找不到则硬删）
  const deleteMail = useCallback(
    async (meta: MailMeta) => {
      const acc = accounts.find((a) => a.id === meta.accountId);
      if (!acc) return;
      const cred = await decryptRef.current(acc);
      if (!cred) return;
      const unreadRemoved = messagesRef.current.find((m) => m.uid === meta.uid && !m.seen) ? 1 : 0;
      try {
        let trash: string | null = null;
        try {
          const folders = await emailService.listFolders(acc, cred);
          trash = folders.find((f) => f.specialUse === '\\Trash')?.path || null;
        } catch {
          trash = null;
        }
        await emailService.deleteMessages(acc, cred, INBOX, trash, [meta.uid]);
        setMessages((prev) => prev.filter((m) => m.uid !== meta.uid));
        setSelectedDetail(null);
        if (unreadRemoved && acc.id) onSeenChange?.(acc.id, -unreadRemoved);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [accounts, onSeenChange],
  );

  return {
    messages,
    loading,
    searching,
    searchQuery,
    selectedDetail,
    loadingDetail,
    error,
    refresh,
    runSearch,
    openMail,
    markSeen,
    deleteMail,
  };
}
