// 邮件状态管理 - 文件夹 / 列表分页 / 阅读 / 标记 / 删除 / 全文搜索
// 依赖当前账号 + 明文凭据（由 ToolPanel 解密后传入）

import { useState, useCallback, useEffect, useRef } from 'react';
import type { AccountMeta, Credential, Folder, MailMeta, MailDetail } from '../types';
import * as emailService from '../services/emailService';

const INBOX = 'INBOX';
const PAGE_SIZE = 50;

export function useMailStore(
  account: AccountMeta | null,
  credential: Credential | null,
  // 已读/删除/移动成功后立即同步到侧边栏未读角标（(accountId, delta) 形式）
  onSeenChange?: (accountId: string, delta: number) => void,
) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string>(INBOX);
  const [messages, setMessages] = useState<MailMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<MailDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 全文搜索（IMAP SEARCH）
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<number | null>(null);

  // messages 同步镜像，供 markSeen/batchMarkSeen/deleteMails/moveMails
  // 等操作读取"本次操作前的 seen 状态"——避免 callback 闭包里 messages 过期
  const messagesRef = useRef<MailMeta[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const accountId = account?.id ?? null;

  const loadFolders = useCallback(async () => {
    if (!account || !credential) return;
    setLoadingFolders(true);
    try {
      const list = await emailService.listFolders(account, credential);
      setFolders(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingFolders(false);
    }
  }, [account, credential]);

  const loadMessages = useCallback(
    async (folder: string, reset: boolean) => {
      if (!account || !credential) return;
      setLoadingList(true);
      setError(null);
      try {
        const nextOffset = reset ? 0 : offset;
        const res = await emailService.listMessages(account, credential, folder, nextOffset, PAGE_SIZE);
        setMessages((prev) => (reset ? res.messages : [...prev, ...res.messages]));
        setTotal(res.total);
        setHasMore(res.hasMore);
        setOffset(nextOffset + res.messages.length);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoadingList(false);
      }
    },
    [account, credential, offset],
  );

  const doSearch = useCallback(
    async (query: string) => {
      if (!account || !credential) return;
      setSearching(true);
      setError(null);
      try {
        const res = await emailService.searchMessages(account, credential, currentFolder, query, PAGE_SIZE);
        setMessages(res.messages);
        setTotal(res.total);
        setHasMore(false);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSearching(false);
      }
    },
    [account, credential, currentFolder],
  );

  // 搜索框输入（350ms 防抖；清空则恢复列表）
  const runSearch = useCallback(
    (q: string) => {
      setSearchQuery(q);
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
      const query = q.trim();
      if (!query) {
        void loadMessages(currentFolder, true);
        return;
      }
      searchTimer.current = window.setTimeout(() => {
        void doSearch(query);
      }, 350);
    },
    [loadMessages, currentFolder, doSearch],
  );

  // 账号切换或凭据就绪时重置并加载（credential 依赖保证解密完成后触发一次正确加载）
  useEffect(() => {
    setFolders([]);
    setCurrentFolder(INBOX);
    setMessages([]);
    setTotal(0);
    setHasMore(false);
    setOffset(0);
    setSelectedDetail(null);
    setError(null);
    setSearchQuery('');
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
    if (account && credential) {
      void loadFolders();
      void loadMessages(INBOX, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, credential]);

  const switchFolder = useCallback(
    (folder: string) => {
      setCurrentFolder(folder);
      setSelectedDetail(null);
      setMessages([]);
      setTotal(0);
      setHasMore(false);
      setOffset(0);
      setSearchQuery('');
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current);
        searchTimer.current = null;
      }
      void loadMessages(folder, true);
    },
    [loadMessages],
  );

  const loadMore = useCallback(() => {
    if (!loadingList && hasMore && !searchQuery.trim()) void loadMessages(currentFolder, false);
  }, [loadingList, hasMore, currentFolder, loadMessages, searchQuery]);

  const refreshList = useCallback(() => {
    if (searchQuery.trim()) void doSearch(searchQuery.trim());
    else void loadMessages(currentFolder, true);
  }, [searchQuery, doSearch, loadMessages, currentFolder]);

  const openMail = useCallback(
    async (meta: MailMeta) => {
      if (!account || !credential) return;
      setLoadingDetail(true);
      setError(null);
      try {
        const detail = await emailService.getMessage(account, credential, currentFolder, meta.uid);
        setSelectedDetail(detail);
        if (!meta.seen) {
          await emailService.setSeen(account, credential, currentFolder, [meta.uid], true);
          setMessages((prev) => prev.map((m) => (m.uid === meta.uid ? { ...m, seen: true } : m)));
          // 未读 -1 → 侧边栏角标立即减
          if (accountId) onSeenChange?.(accountId, -1);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoadingDetail(false);
      }
    },
    [account, credential, currentFolder, accountId, onSeenChange],
  );

  const markSeen = useCallback(
    async (uid: number, seen: boolean) => {
      if (!account || !credential) return;
      const wasSeen = messagesRef.current.find((m) => m.uid === uid)?.seen ?? false;
      const delta = wasSeen === seen ? 0 : seen ? -1 : +1;
      try {
        await emailService.setSeen(account, credential, currentFolder, [uid], seen);
        setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, seen } : m)));
        if (delta && accountId) onSeenChange?.(accountId, delta);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [account, credential, currentFolder, accountId, onSeenChange],
  );

  const deleteMails = useCallback(
    async (uids: number[], trashFolder: string | null) => {
      if (!account || !credential) return;
      // 统计被删邮件中的未读数：从 INBOX 移走即影响未读
      const unreadRemoved = messagesRef.current.filter((m) => uids.includes(m.uid) && !m.seen).length;
      try {
        await emailService.deleteMessages(account, credential, currentFolder, trashFolder, uids);
        setMessages((prev) => prev.filter((m) => !uids.includes(m.uid)));
        setTotal((t) => Math.max(0, t - uids.length));
        setSelectedDetail(null);
        if (unreadRemoved && accountId) onSeenChange?.(accountId, -unreadRemoved);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [account, credential, currentFolder, accountId, onSeenChange],
  );

  const batchMarkSeen = useCallback(
    async (uids: number[], seen: boolean) => {
      if (!account || !credential) return;
      // 统计本次需要切换的实际数量（已被标记的目标状态者不计入）
      const transitions = messagesRef.current.filter((m) => uids.includes(m.uid) && m.seen !== seen).length;
      try {
        await emailService.setSeen(account, credential, currentFolder, uids, seen);
        setMessages((prev) => prev.map((m) => (uids.includes(m.uid) ? { ...m, seen } : m)));
        if (transitions && accountId) onSeenChange?.(accountId, seen ? -transitions : +transitions);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [account, credential, currentFolder, accountId, onSeenChange],
  );

  const moveMails = useCallback(
    async (uids: number[], toFolder: string) => {
      if (!account || !credential) return;
      // 从当前文件夹移走，仅当当前是 INBOX 时影响未读
      const unreadRemoved = currentFolder === 'INBOX'
        ? messagesRef.current.filter((m) => uids.includes(m.uid) && !m.seen).length
        : 0;
      try {
        await emailService.moveMessages(account, credential, currentFolder, toFolder, uids);
        setMessages((prev) => prev.filter((m) => !uids.includes(m.uid)));
        setTotal((t) => Math.max(0, t - uids.length));
        setSelectedDetail(null);
        if (unreadRemoved && accountId) onSeenChange?.(accountId, -unreadRemoved);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [account, credential, currentFolder, accountId, onSeenChange],
  );

  return {
    folders,
    currentFolder,
    messages,
    total,
    hasMore,
    loadingList,
    loadingFolders,
    selectedDetail,
    loadingDetail,
    error,
    searchQuery,
    searching,
    switchFolder,
    loadMore,
    refreshList,
    runSearch,
    openMail,
    markSeen,
    deleteMails,
    batchMarkSeen,
    moveMails,
  };
}
