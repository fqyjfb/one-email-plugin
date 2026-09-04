import React from 'react';
import { Plus, Pencil, Trash2, Mail, FileText, Inbox } from 'lucide-react';
import type { AccountMeta, Folder as FolderMeta } from '../types';
import { folderDisplayName, folderIcon } from '../utils/folderIcon';
import { UNIFIED_ID } from '../store/useUnifiedStore';

interface SidebarProps {
  accounts: AccountMeta[];
  currentAccountId: string | null;
  folders: FolderMeta[];
  currentFolder: string;
  unread: Record<string, number>;
  onSelectAccount: (id: string) => void;
  onSelectUnified: () => void;
  onSwitchFolder: (path: string) => void;
  onAddAccount: () => void;
  onEditAccount: (account: AccountMeta) => void;
  onDeleteAccount: (account: AccountMeta) => void;
  onOpenDrafts: () => void;
}

function initialOf(name: string): string {
  return (name || '?').trim().charAt(0).toUpperCase();
}

const Sidebar: React.FC<SidebarProps> = ({
  accounts,
  currentAccountId,
  folders,
  currentFolder,
  unread,
  onSelectAccount,
  onSelectUnified,
  onSwitchFolder,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onOpenDrafts,
}) => {
  const currentAccount = accounts.find((a) => a.id === currentAccountId) || null;
  const unifiedActive = currentAccountId === UNIFIED_ID;
  const unifiedUnread = accounts.reduce((sum, acc) => sum + (unread[acc.id] ?? 0), 0);

  return (
    <aside className="w-[220px] shrink-0 flex flex-col border-r border-border bg-background">
      <div className="flex items-center justify-end px-4 py-3 border-b border-border">
        <button
          onClick={onAddAccount}
          className="p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-colors"
          title="添加账号"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {/* 统一收件箱入口 */}
        {accounts.length > 0 && (
          <div
            onClick={onSelectUnified}
            className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
              unifiedActive ? 'bg-accent' : 'hover:bg-accent/60'
            }`}
          >
            <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-blue-600 text-white">
              <Inbox className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm">统一收件箱</div>
            </div>
            {unifiedUnread > 0 && (
              <span
                className="shrink-0 min-w-[18px] h-[18px] px-1.5 flex items-center justify-center rounded-full bg-blue-600 text-white text-xs font-medium"
                title="未读数"
              >
                {unifiedUnread > 99 ? '99+' : unifiedUnread}
              </span>
            )}
          </div>
        )}

        {accounts.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            还没有账号
            <button onClick={onAddAccount} className="block mx-auto mt-2 text-primary hover:underline">
              ＋ 添加第一个邮箱
            </button>
          </div>
        )}

        {accounts.map((acc) => {
          const active = acc.id === currentAccountId;
          return (
            <div key={acc.id}>
              <div
                onClick={() => onSelectAccount(acc.id)}
                className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                  active ? 'bg-accent' : 'hover:bg-accent/60'
                }`}
              >
                <span
                  className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-xs font-semibold text-white"
                  style={{ backgroundColor: '#2563eb' }}
                >
                  {initialOf(acc.displayName || acc.email)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate" title={acc.email}>
                    {acc.displayName || acc.email}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{acc.email}</div>
                </div>
                {(unread[acc.id] ?? 0) > 0 && (
                  <span
                    className="shrink-0 min-w-[18px] h-[18px] px-1.5 flex items-center justify-center rounded-full bg-blue-600 text-white text-xs font-medium"
                    title="未读数"
                  >
                    {(unread[acc.id] ?? 0) > 99 ? '99+' : unread[acc.id]}
                  </span>
                )}
                <div className="hidden group-hover:flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditAccount(acc);
                    }}
                    className="p-1 rounded hover:bg-background transition-colors"
                    title="编辑"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteAccount(acc);
                    }}
                    className="p-1 rounded hover:bg-background text-destructive transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 当前账号的文件夹树 */}
              {active && !unifiedActive && (
                <div className="pl-5 pr-2 pb-1">
                  {folders.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => onSwitchFolder(f.path)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                        f.path === currentFolder
                          ? 'bg-accent text-foreground'
                          : 'text-muted-foreground hover:bg-accent/60'
                      }`}
                    >
                      {folderIcon(f)}
                      <span className="truncate" title={f.path}>{folderDisplayName(f)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-border py-1.5 px-3 space-y-0.5">
        <button
          onClick={onOpenDrafts}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
        >
          <FileText className="w-4 h-4" />
          草稿箱
        </button>
        <div className="px-2 text-xs text-muted-foreground flex items-center gap-1">
          <Mail className="w-3 h-3" /> IMAP / SMTP
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
