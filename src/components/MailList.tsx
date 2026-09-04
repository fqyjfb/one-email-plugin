import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  PenLine,
  Trash2,
  Paperclip,
  Loader2,
  CheckSquare,
  Square,
  MailOpen,
  Mail,
  FolderInput,
  X,
  CheckCheck,
} from 'lucide-react';
import type { MailMeta } from '../types';
import { formatAddress, formatDate } from '../utils/format';

export type MailFilter = 'all' | 'unread' | 'read';

interface MailListProps {
  messages: MailMeta[];
  total: number;
  loading: boolean;
  searching: boolean;
  hasMore: boolean;
  selectedUid: number | null;
  selectionMode: boolean;
  selectedUids: Set<number>;
  searchQuery: string;
  mailFilter: MailFilter;
  onFilterChange: (filter: MailFilter) => void;
  onSelect: (meta: MailMeta) => void;
  onLoadMore: () => void;
  onCompose: () => void;
  onDelete: (meta: MailMeta) => void;
  onToggleSelectionMode: () => void;
  onToggleSelect: (uid: number) => void;
  onSelectAll: (visibleUids: number[]) => void;
  onClearSelection: () => void;
  onBatchMarkSeen: (seen: boolean) => void;
  onBatchDelete: () => void;
  onBatchMove: () => void;
  /** 单封邮件标记已读/未读：未选批量或单选时使用 */
  onMarkSeen?: (uid: number, seen: boolean) => void;
}

interface ContextMenuState {
  x: number; // MailList 容器内坐标
  y: number;
  meta: MailMeta | null; // 右键命中的邮件（右键空白则为 null，仅允许「全选」「写邮件」）
}

const MENU_MIN_WIDTH = 160;
const MENU_GAP = 4;

const MailList: React.FC<MailListProps> = ({
  messages,
  total,
  loading,
  searching,
  hasMore,
  selectedUid,
  selectionMode,
  selectedUids,
  searchQuery,
  mailFilter,
  onFilterChange,
  onSelect,
  onLoadMore,
  onCompose,
  onDelete,
  onToggleSelectionMode,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBatchMarkSeen,
  onBatchDelete,
  onBatchMove,
  onMarkSeen,
}) => {
  const actionBtn =
    'flex items-center gap-1 px-2 py-1 text-xs border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-60';
  const iconOnlyBtn =
    'p-1.5 rounded-md hover:bg-accent transition-colors disabled:opacity-60 shrink-0';
  const busy = (loading || searching) && messages.length === 0;

  const isSearching = searchQuery.trim().length > 0;
  const visibleMessages = useMemo(() => {
    if (isSearching) return messages;
    if (mailFilter === 'unread') return messages.filter((m) => !m.seen);
    if (mailFilter === 'read') return messages.filter((m) => m.seen);
    return messages;
  }, [messages, mailFilter, isSearching]);
  const visibleUids = useMemo(() => visibleMessages.map((m) => m.uid), [visibleMessages]);

  const unreadCount = useMemo(() => messages.filter((m) => !m.seen).length, [messages]);
  const readCount = messages.length - unreadCount;

  // —— 右键菜单状态 ——
  const hostRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [renderPos, setRenderPos] = useState<{ left: number; top: number } | null>(null);

  const closeMenu = useCallback(() => {
    setMenu(null);
    setRenderPos(null);
  }, []);

  const handleRowContextMenu = useCallback(
    (e: React.MouseEvent, meta: MailMeta) => {
      e.preventDefault();
      e.stopPropagation();
      const host = hostRef.current;
      if (!host) return;
      const hostRect = host.getBoundingClientRect();
      setMenu({
        x: e.clientX - hostRect.left,
        y: e.clientY - hostRect.top,
        meta,
      });
      setRenderPos(null);
    },
    [],
  );

  // 在 MailList 空白区域（邮件列表的外层容器，不是邮件行）右键也能触发只含「全选 / 写邮件」的菜单
  const handleHostContextMenu = useCallback((e: React.MouseEvent) => {
    // 仅当右键不在某封具体邮件行（行内自己会 stopPropagation）时走这里
    const host = hostRef.current;
    if (!host) return;
    // 如果点击目标是邮件行内部（.mail-row 的后代），不重复触发
    if ((e.target as HTMLElement).closest('[data-mail-row]')) return;
    e.preventDefault();
    const hostRect = host.getBoundingClientRect();
    setMenu({
      x: e.clientX - hostRect.left,
      y: e.clientY - hostRect.top,
      meta: null,
    });
    setRenderPos(null);
  }, []);

  // 首次渲染：根据真实测量尺寸 clamp
  useLayoutEffect(() => {
    if (!menu) return;
    const host = hostRef.current;
    const el = menuRef.current;
    if (!host || !el) return;

    const hostW = host.clientWidth;
    const hostH = host.clientHeight;
    const menuW = Math.max(el.offsetWidth, MENU_MIN_WIDTH);
    const menuH = el.offsetHeight;

    let left = menu.x;
    let top = menu.y;

    if (left + menuW + MENU_GAP > hostW) {
      left = menu.x - menuW;
      if (left < MENU_GAP) left = MENU_GAP;
    }
    if (top + menuH + MENU_GAP > hostH) {
      top = menu.y - menuH;
      if (top < MENU_GAP) top = MENU_GAP;
    }
    setRenderPos({ left, top });
  }, [menu]);

  // 关闭：点击外部 / ESC / 滚动 / 窗口变化
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      closeMenu();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeMenu();
    const onScroll = () => closeMenu();
    const onResize = () => closeMenu();
    const host = hostRef.current;
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    host?.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      host?.removeEventListener('scroll', onScroll, true);
    };
  }, [menu, closeMenu]);

  // —— 菜单可用上下文 ——
  const ctxMeta = menu?.meta || null;
  const batchAvailable = selectionMode && selectedUids.size > 0;
  const singleAvailable = !!ctxMeta;
  const canSelectAll = visibleMessages.length > 0;

  const doMarkSeen = (seen: boolean) => {
    closeMenu();
    if (batchAvailable) {
      onBatchMarkSeen(seen);
      return;
    }
    if (singleAvailable && onMarkSeen) {
      onMarkSeen(ctxMeta!.uid, seen);
    }
  };

  const doSelectAll = () => {
    closeMenu();
    if (!selectionMode) onToggleSelectionMode();
    setTimeout(() => onSelectAll(visibleUids), 0);
  };

  const doDelete = () => {
    closeMenu();
    if (batchAvailable) {
      onBatchDelete();
      return;
    }
    if (singleAvailable) {
      onDelete(ctxMeta!);
    }
  };

  const filterBtn = (f: MailFilter, label: string, count: number) => {
    const active = mailFilter === f;
    return (
      <button
        onClick={() => onFilterChange(f)}
        className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
          active
            ? 'bg-primary text-button-text'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        }`}
      >
        {label}
        <span className={`min-w-[18px] text-center rounded ${active ? 'bg-button-text/20 px-1' : 'bg-muted px-1'}`}>
          {count}
        </span>
      </button>
    );
  };

  return (
    <div ref={hostRef} className="relative w-[360px] shrink-0 flex flex-col border-r border-border bg-background" onContextMenu={handleHostContextMenu}>
      {/* 工具栏行：多选切换（左）+ 分类筛选（中） + 已选计数（右） */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-background shrink-0">
        <button
          onClick={onToggleSelectionMode}
          className={`${iconOnlyBtn} ${selectionMode ? 'bg-accent text-foreground' : ''}`}
          title={selectionMode ? '退出多选' : '进入多选'}
        >
          <CheckSquare className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 min-w-0">
          {!isSearching && (
            <>
              {filterBtn('all', '全部', messages.length)}
              {filterBtn('unread', '未读', unreadCount)}
              {filterBtn('read', '已读', readCount)}
            </>
          )}
          {isSearching && (
            <span className="text-xs text-muted-foreground px-2">搜索结果 {messages.length} 封</span>
          )}
        </div>

        {selectionMode && (
          <span className="ml-auto text-xs text-muted-foreground shrink-0">已选 {selectedUids.size}</span>
        )}
      </div>

      {/* 多选模式下的快捷操作行 */}
      {selectionMode && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/30 shrink-0">
          <button onClick={() => onSelectAll(visibleUids)} className={actionBtn} disabled={!canSelectAll}>
            <CheckCheck className="w-3.5 h-3.5" /> 全选
          </button>
          <button onClick={() => onBatchMarkSeen(true)} className={actionBtn} title="标记已读" disabled={selectedUids.size === 0}>
            <MailOpen className="w-3.5 h-3.5" /> 已读
          </button>
          <button onClick={() => onBatchMarkSeen(false)} className={actionBtn} title="标记未读" disabled={selectedUids.size === 0}>
            <Mail className="w-3.5 h-3.5" /> 未读
          </button>
          <button onClick={onBatchMove} className={actionBtn} title="移动" disabled={selectedUids.size === 0}>
            <FolderInput className="w-3.5 h-3.5" /> 移动
          </button>
          <button onClick={onBatchDelete} className={`${actionBtn} text-destructive`} title="删除" disabled={selectedUids.size === 0}>
            <Trash2 className="w-3.5 h-3.5" /> 删除
          </button>
          <button
            onClick={onClearSelection}
            className="p-1 rounded-md hover:bg-accent transition-colors ml-auto"
            title="取消多选"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {busy ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {isSearching
              ? '无匹配邮件'
              : mailFilter === 'unread'
                ? '没有未读邮件'
                : mailFilter === 'read'
                  ? '没有已读邮件'
                  : '暂无邮件'}
          </div>
        ) : (
          visibleMessages.map((m) => {
            const checked = selectedUids.has(m.uid);
            return (
              <div
                data-mail-row
                key={`${m.accountId || 'a'}:${m.uid}`}
                onClick={() => (selectionMode ? onToggleSelect(m.uid) : onSelect(m))}
                onContextMenu={(e) => handleRowContextMenu(e, m)}
                className={`group flex items-start gap-2 px-3 py-2.5 cursor-pointer border-b border-border/60 transition-colors ${
                  m.uid === selectedUid ? 'bg-accent' : 'hover:bg-accent/50'
                }`}
              >
                {selectionMode && (
                  <span className="mt-1 shrink-0 text-muted-foreground">
                    {checked ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                  </span>
                )}
                {!selectionMode && (
                  <span
                    className={`mt-1.5 w-2 h-2 shrink-0 rounded-full ${m.seen ? 'bg-transparent' : 'bg-blue-600'}`}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${m.seen ? 'text-muted-foreground' : 'font-semibold'}`}>
                      {m.from?.name || m.from?.address || '(未知发件人)'}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatDate(m.date)}</span>
                  </div>
                  <div className={`text-sm truncate ${m.seen ? 'text-muted-foreground' : 'font-medium'}`}>{m.subject}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {m.hasAttachment && <Paperclip className="w-3 h-3" />}
                    {m.accountEmail && (
                      <span className="truncate rounded bg-muted px-1 text-[10px] text-muted-foreground" title={m.accountEmail}>
                        {m.accountEmail}
                      </span>
                    )}
                    <span className="truncate">{formatAddress(m.from)}</span>
                  </div>
                </div>
                {!selectionMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(m);
                    }}
                    className="hidden group-hover:block p-1 rounded hover:bg-background text-destructive transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}

        {hasMore && !selectionMode && !isSearching && mailFilter === 'all' && (
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="w-full py-2 text-sm text-muted-foreground hover:bg-accent/50 transition-colors disabled:opacity-60"
          >
            {loading ? '加载中…' : `加载更多（共 ${total} 封）`}
          </button>
        )}
      </div>

      {/* 邮件操作右键菜单：显式纯色 bg-white dark:bg-gray-800 + 内联 style.background，双保险避免背景透明；z-40 保证层级 */}
      {menu && (
        <div
          ref={menuRef}
          data-context-menu="mail-list"
          style={{
            left: renderPos ? renderPos.left : menu.x,
            top: renderPos ? renderPos.top : menu.y,
            minWidth: MENU_MIN_WIDTH,
            visibility: renderPos ? 'visible' : 'hidden',
            background: '#ffffff',
          }}
          className="absolute z-40 py-1 rounded-md border border-border bg-white dark:bg-gray-800 text-sm shadow-md"
        >
          <div className="px-3 py-1 text-[11px] text-muted-foreground border-b border-border/60">
            {ctxMeta ? (selectionMode ? `已选 ${selectedUids.size} 封 / 当前右键邮件` : '当前邮件') : '邮件列表操作'}
          </div>
          <button
            onClick={doSelectAll}
            disabled={!canSelectAll}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors text-left disabled:opacity-50"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            全选当前列表
          </button>
          <button
            onClick={() => doMarkSeen(true)}
            disabled={!batchAvailable && !(singleAvailable && !!onMarkSeen)}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors text-left disabled:opacity-50"
          >
            <MailOpen className="w-3.5 h-3.5" />
            标记已读
          </button>
          <button
            onClick={() => doMarkSeen(false)}
            disabled={!batchAvailable && !(singleAvailable && !!onMarkSeen)}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors text-left disabled:opacity-50"
          >
            <Mail className="w-3.5 h-3.5" />
            标记未读
          </button>
          {selectionMode && (
            <button
              onClick={() => { closeMenu(); onBatchMove(); }}
              disabled={!batchAvailable}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors text-left disabled:opacity-50"
            >
              <FolderInput className="w-3.5 h-3.5" />
              移动邮件
            </button>
          )}
          <div className="my-0.5 border-t border-border/60" />
          <button
            onClick={() => { closeMenu(); onCompose(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors text-left"
          >
            <PenLine className="w-3.5 h-3.5" />
            写邮件
          </button>
          <button
            onClick={doDelete}
            disabled={!batchAvailable && !singleAvailable}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors text-left text-destructive disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            删除
          </button>
        </div>
      )}
    </div>
  );
};

export default MailList;
