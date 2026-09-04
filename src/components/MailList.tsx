import React, { useMemo } from 'react';
import {
  RefreshCw,
  Search,
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
  onSearch: (query: string) => void;
  onSelect: (meta: MailMeta) => void;
  onLoadMore: () => void;
  onRefresh: () => void;
  onCompose: () => void;
  onDelete: (meta: MailMeta) => void;
  onToggleSelectionMode: () => void;
  onToggleSelect: (uid: number) => void;
  onSelectAll: (visibleUids: number[]) => void;
  onClearSelection: () => void;
  onBatchMarkSeen: (seen: boolean) => void;
  onBatchDelete: () => void;
  onBatchMove: () => void;
}

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
  onSearch,
  onSelect,
  onLoadMore,
  onRefresh,
  onCompose,
  onDelete,
  onToggleSelectionMode,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBatchMarkSeen,
  onBatchDelete,
  onBatchMove,
}) => {
  const actionBtn =
    'flex items-center gap-1 px-2 py-1 text-xs border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-60';
  const busy = (loading || searching) && messages.length === 0;

  // 分类筛选（仅在未搜索时生效；搜索时显示 IMAP 检索结果全集）
  const isSearching = searchQuery.trim().length > 0;
  const visibleMessages = useMemo(() => {
    if (isSearching) return messages;
    if (mailFilter === 'unread') return messages.filter((m) => !m.seen);
    if (mailFilter === 'read') return messages.filter((m) => m.seen);
    return messages;
  }, [messages, mailFilter, isSearching]);

  const unreadCount = useMemo(() => messages.filter((m) => !m.seen).length, [messages]);
  const readCount = messages.length - unreadCount;

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
    <div className="w-[360px] shrink-0 flex flex-col border-r border-border bg-background">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-input bg-muted/40">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm focus:outline-none"
            placeholder="搜索邮件（主题/发件人/正文）"
          />
        </div>
        <button onClick={onRefresh} className="p-1.5 rounded-md hover:bg-accent transition-colors" title="刷新">
          <RefreshCw className={`w-4 h-4 ${searching ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={onCompose}
          className="p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-colors"
          title="写邮件"
        >
          <PenLine className="w-4 h-4" />
        </button>
      </div>

      {/* 工具栏：多选（最左）+ 全部/未读/已读分类（搜索时隐藏）+ 已选计数（最右） */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-background">
        <button
          onClick={onToggleSelectionMode}
          className={`p-1.5 rounded-md transition-colors ${selectionMode ? 'bg-accent text-foreground' : 'hover:bg-accent'}`}
          title={selectionMode ? '退出多选' : '多选'}
        >
          <CheckSquare className="w-4 h-4" />
        </button>
        {!isSearching && (
          <>
            {filterBtn('all', '全部', messages.length)}
            {filterBtn('unread', '未读', unreadCount)}
            {filterBtn('read', '已读', readCount)}
          </>
        )}
        {selectionMode && (
          <span className="ml-auto text-xs text-muted-foreground">已选 {selectedUids.size} 封</span>
        )}
      </div>

      {selectionMode && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/30">
          <button onClick={() => onSelectAll(visibleMessages.map((m) => m.uid))} className={actionBtn}>
            <CheckCheck className="w-3.5 h-3.5" /> 全选
          </button>
          <button onClick={() => onBatchMarkSeen(true)} className={actionBtn} title="标记已读">
            <MailOpen className="w-3.5 h-3.5" /> 已读
          </button>
          <button onClick={() => onBatchMarkSeen(false)} className={actionBtn} title="标记未读">
            <Mail className="w-3.5 h-3.5" /> 未读
          </button>
          <button onClick={onBatchMove} className={actionBtn} title="移动">
            <FolderInput className="w-3.5 h-3.5" /> 移动
          </button>
          <button onClick={onBatchDelete} className={`${actionBtn} text-destructive`} title="删除">
            <Trash2 className="w-3.5 h-3.5" /> 删除
          </button>
          <button onClick={onClearSelection} className="p-1 rounded-md hover:bg-accent transition-colors ml-auto" title="取消">
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
                key={`${m.accountId || 'a'}:${m.uid}`}
                onClick={() => (selectionMode ? onToggleSelect(m.uid) : onSelect(m))}
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
    </div>
  );
};

export default MailList;
