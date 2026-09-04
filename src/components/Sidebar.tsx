import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Mail, FileText, Inbox, Copy, Palette, ChevronDown, ChevronRight } from 'lucide-react';
import type { AccountMeta, Folder as FolderMeta } from '../types';
import { folderDisplayName, folderIcon } from '../utils/folderIcon';
import { groupAccountsByProvider, MARK_COLORS } from '../utils/accountType';
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
  /** 右键菜单中点击「复制邮箱」回调 */
  onCopyEmail?: (email: string) => void;
  /** 拖拽排序回调（传入该分组内新的账号 id 顺序） */
  onReorderAccounts?: (orderedIds: string[]) => void;
  /** 标记颜色回调（color 为 null 表示清除标记） */
  onSetAccountColor?: (id: string, color: string | null) => void;
}

function initialOf(name: string): string {
  return (name || '?').trim().charAt(0).toUpperCase();
}

interface ContextMenuState {
  x: number; // 容器内坐标（相对 Sidebar）
  y: number;
  account: AccountMeta;
}

interface DragState {
  id: string;
  group: string;
}

const MENU_MIN_WIDTH = 140;
const MENU_GAP = 4; // 距视口边距

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
  onCopyEmail,
  onReorderAccounts,
  onSetAccountColor,
}) => {
  const currentAccount = accounts.find((a) => a.id === currentAccountId) || null;
  const unifiedActive = currentAccountId === UNIFIED_ID;
  const unifiedUnread = accounts.reduce((sum, acc) => sum + (unread[acc.id] ?? 0), 0);

  // 按类型分组（组内按 order、组间按预设顺序）
  const groups = useMemo(() => groupAccountsByProvider(accounts), [accounts]);

  // 分组折叠状态（默认展开）
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = useCallback((key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // 拖拽状态
  const [drag, setDrag] = useState<DragState | null>(null);

  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  // 应用 clamp 后的实际渲染位置（首次渲染后根据测量尺寸修正）
  const [renderPos, setRenderPos] = useState<{ left: number; top: number } | null>(null);
  // 「标记颜色」子菜单展开态
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 关闭菜单
  const closeMenu = useCallback(() => {
    setMenu(null);
    setRenderPos(null);
    setColorPickerOpen(false);
  }, []);

  // 邮件行右键打开菜单
  const handleContextMenu = useCallback((e: React.MouseEvent, account: AccountMeta) => {
    e.preventDefault();
    e.stopPropagation();
    const host = sidebarRef.current;
    if (!host) return;
    const hostRect = host.getBoundingClientRect();
    const x = e.clientX - hostRect.left;
    const y = e.clientY - hostRect.top;
    setColorPickerOpen(false);
    setMenu({ x, y, account });
    setRenderPos(null); // 下次 useLayoutEffect 根据菜单尺寸重算
  }, []);

  // —— 拖拽排序 ——
  const handleDragStart = useCallback((e: React.DragEvent, acc: AccountMeta, groupKey: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', acc.id);
    setDrag({ id: acc.id, group: groupKey });
  }, []);

  const handleDragEnd = useCallback(() => setDrag(null), []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, target: AccountMeta, groupKey: string) => {
      e.preventDefault();
      if (!drag || drag.group !== groupKey || drag.id === target.id) {
        setDrag(null);
        return;
      }
      const group = groups.find((g) => g.key === groupKey);
      if (!group) {
        setDrag(null);
        return;
      }
      const rest = group.accounts.map((a) => a.id).filter((id) => id !== drag.id);
      const targetIndex = rest.indexOf(target.id);
      if (targetIndex < 0) {
        setDrag(null);
        return;
      }
      // 根据鼠标落点相对目标行中线，决定插入到目标之前还是之后
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const after = e.clientY - rect.top > rect.height / 2;
      rest.splice(after ? targetIndex + 1 : targetIndex, 0, drag.id);
      onReorderAccounts?.(rest);
      setDrag(null);
    },
    [drag, groups, onReorderAccounts],
  );

  // 首次渲染菜单后，根据真实测量尺寸 + 容器边界 clamp，避免溢出
  useLayoutEffect(() => {
    if (!menu) return;
    const host = sidebarRef.current;
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
  }, [menu, colorPickerOpen]);

  // 点击外部 / 按 ESC / 滚动 → 关闭
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    const onScroll = () => closeMenu();
    const onResize = () => closeMenu();
    const host = sidebarRef.current;
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

  // 从 menu 状态中取当前操作的 account（避免二次查找）
  const activeCtx = menu?.account || null;

  return (
    <aside ref={sidebarRef} className="relative w-[220px] shrink-0 flex flex-col border-r border-border bg-background">
      {/* 精简头部：标题 + 数量 */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-xs font-medium text-muted-foreground">邮箱账号</span>
        <span className="text-xs text-muted-foreground">{accounts.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto py-2 no-scrollbar">
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

        {/* 按邮箱类型分组 */}
        {groups.map((group) => {
          const isCollapsed = !!collapsed[group.key];
          return (
            <div key={group.key}>
              {/* 组头：点击展开/折叠 */}
              <div
                onClick={() => toggleGroup(group.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer select-none text-xs text-muted-foreground hover:bg-accent/60 transition-colors"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="flex-1 font-medium">{group.label}</span>
                <span className="text-[10px]">{group.accounts.length}</span>
              </div>

              {!isCollapsed &&
                group.accounts.map((acc) => {
                  const active = acc.id === currentAccountId;
                  return (
                    <div key={acc.id} className="relative">
                      <div
                        draggable
                        onClick={() => onSelectAccount(acc.id)}
                        onContextMenu={(e) => handleContextMenu(e, acc)}
                        onDragStart={(e) => handleDragStart(e, acc, group.key)}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, acc, group.key)}
                        className={`group flex items-center gap-2 pl-6 pr-3 py-2 cursor-pointer transition-colors ${
                          active ? 'bg-accent' : 'hover:bg-accent/60'
                        } ${drag?.id === acc.id ? 'opacity-50' : ''}`}
                      >
                        <span
                          className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-xs font-semibold text-white"
                          style={{ backgroundColor: acc.color || '#2563eb' }}
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
                      </div>

                      {/* 当前账号的文件夹树 */}
                      {active && !unifiedActive && (
                        <div className="pl-9 pr-2 pb-1">
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
          );
        })}
      </div>

      <div className="border-t border-border py-1.5 px-3 space-y-0.5 shrink-0">
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

      {/* 右键上下文菜单 */}
      {menu && activeCtx && (
        <div
          ref={menuRef}
          data-context-menu="sidebar-account"
          style={{
            left: renderPos ? renderPos.left : menu.x,
            top: renderPos ? renderPos.top : menu.y,
            minWidth: MENU_MIN_WIDTH,
            visibility: renderPos ? 'visible' : 'hidden',
            background: '#ffffff',
          }}
          className="absolute z-40 py-1 rounded-md border border-border bg-white dark:bg-gray-800 text-sm shadow-md"
        >
          {onCopyEmail && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeMenu();
                onCopyEmail(activeCtx.email);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors text-left"
              title={activeCtx.email}
            >
              <Copy className="w-3.5 h-3.5" />
              复制邮箱
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeMenu();
              onAddAccount();
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors text-left"
          >
            <Plus className="w-3.5 h-3.5" />
            添加邮箱
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeMenu();
              onEditAccount(activeCtx);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors text-left"
          >
            <Pencil className="w-3.5 h-3.5" />
            编辑
          </button>

          {/* 标记颜色子菜单 */}
          {onSetAccountColor && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setColorPickerOpen((v) => !v);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors text-left"
              >
                <Palette className="w-3.5 h-3.5" />
                标记颜色
                <ChevronRight
                  className={`w-3.5 h-3.5 ml-auto transition-transform ${colorPickerOpen ? 'rotate-90' : ''}`}
                />
              </button>
              {colorPickerOpen && (
                <div className="px-2 pb-1.5 pt-0.5 border-t border-border/60">
                  <div className="grid grid-cols-4 gap-1.5 py-1.5">
                    {MARK_COLORS.map((c) => (
                      <button
                        key={c.value}
                        title={c.label}
                        onClick={(e) => {
                          e.stopPropagation();
                          closeMenu();
                          onSetAccountColor(activeCtx.id, c.value);
                        }}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                          activeCtx.color === c.value ? 'border-foreground' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c.value }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeMenu();
                      onSetAccountColor(activeCtx.id, null);
                    }}
                    className="w-full text-xs text-muted-foreground hover:bg-accent rounded px-2 py-1 text-left transition-colors"
                  >
                    清除标记
                  </button>
                </div>
              )}
            </>
          )}

          <div className="my-0.5 border-t border-border/60" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeMenu();
              onDeleteAccount(activeCtx);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors text-left text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
            删除
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
