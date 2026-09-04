// 侧栏右键菜单 —— 账号菜单 / 文件夹菜单的内容片段
// 定位、边界收敛与关闭逻辑由 Sidebar 统一处理，这里只负责菜单项渲染
import React from 'react';
import {
  Bell,
  BellOff,
  CheckCheck,
  ChevronRight,
  Copy,
  Eraser,
  FolderPlus,
  Palette,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import type { AccountMeta, Folder as FolderMeta } from '../types';
import { MARK_COLORS } from '../utils/accountType';

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  /** 危险操作（删除类）：文案标红 */
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  trailing?: React.ReactNode;
}

export function MenuItem({ icon, label, onClick, danger, disabled, title, trailing }: MenuItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : danger
            ? 'text-destructive hover:bg-accent'
            : 'hover:bg-accent'
      }`}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-0.5 border-t border-border/60" />;
}

interface AccountMenuContentProps {
  account: AccountMeta;
  colorPickerOpen: boolean;
  onToggleColorPicker: () => void;
  onClose: () => void;
  onCopyEmail?: (email: string) => void;
  onAddAccount: () => void;
  onEditAccount: (account: AccountMeta) => void;
  onDeleteAccount: (account: AccountMeta) => void;
  onSetAccountColor?: (id: string, color: string | null) => void;
}

export const AccountMenuContent: React.FC<AccountMenuContentProps> = ({
  account,
  colorPickerOpen,
  onToggleColorPicker,
  onClose,
  onCopyEmail,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onSetAccountColor,
}) => (
  <>
    {onCopyEmail && (
      <MenuItem
        icon={<Copy className="w-3.5 h-3.5" />}
        label="复制邮箱"
        title={account.email}
        onClick={() => {
          onClose();
          onCopyEmail(account.email);
        }}
      />
    )}
    <MenuItem
      icon={<Plus className="w-3.5 h-3.5" />}
      label="添加邮箱"
      onClick={() => {
        onClose();
        onAddAccount();
      }}
    />
    <MenuItem
      icon={<Pencil className="w-3.5 h-3.5" />}
      label="编辑"
      onClick={() => {
        onClose();
        onEditAccount(account);
      }}
    />

    {onSetAccountColor && (
      <>
        <MenuItem
          icon={<Palette className="w-3.5 h-3.5" />}
          label="标记颜色"
          onClick={onToggleColorPicker}
          trailing={
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform ${colorPickerOpen ? 'rotate-90' : ''}`}
            />
          }
        />
        {colorPickerOpen && (
          <div className="px-2 pb-1.5 pt-0.5 border-t border-border/60">
            <div className="grid grid-cols-4 gap-1.5 py-1.5">
              {MARK_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => {
                    onClose();
                    onSetAccountColor(account.id, c.value);
                  }}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                    account.color === c.value ? 'border-foreground' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSetAccountColor(account.id, null);
              }}
              className="w-full text-xs text-muted-foreground hover:bg-accent rounded px-2 py-1 text-left transition-colors"
            >
              清除标记
            </button>
          </div>
        )}
      </>
    )}

    <MenuDivider />
    <MenuItem
      icon={<Trash2 className="w-3.5 h-3.5" />}
      label="删除"
      danger
      onClick={() => {
        onClose();
        onDeleteAccount(account);
      }}
    />
  </>
);

interface FolderMenuContentProps {
  folder: FolderMeta;
  /** 含子文件夹：禁止删除，避免各服务端级联行为不一致 */
  hasChildren: boolean;
  onClose: () => void;
  onNewSubFolder: (parent: string) => void;
  onRename: (folder: FolderMeta) => void;
  onMarkAllSeen: (folder: FolderMeta) => void;
  onEmpty: (folder: FolderMeta) => void;
  onToggleSubscribe: (folder: FolderMeta) => void;
  onDelete: (folder: FolderMeta) => void;
}

export const FolderMenuContent: React.FC<FolderMenuContentProps> = ({
  folder,
  hasChildren,
  onClose,
  onNewSubFolder,
  onRename,
  onMarkAllSeen,
  onEmpty,
  onToggleSubscribe,
  onDelete,
}) => {
  // INBOX 为系统必需文件夹：不可改名 / 删除 / 取消订阅
  const isInbox = folder.path.toUpperCase() === 'INBOX';
  const subscribed = folder.subscribed;

  return (
    <>
      <div className="px-3 py-1 text-xs text-muted-foreground truncate" title={folder.path}>
        {folder.path}
      </div>
      <MenuDivider />
      <MenuItem
        icon={<FolderPlus className="w-3.5 h-3.5" />}
        label="新建子文件夹"
        onClick={() => {
          onClose();
          onNewSubFolder(folder.path);
        }}
      />
      <MenuItem
        icon={<Pencil className="w-3.5 h-3.5" />}
        label="重命名"
        disabled={isInbox}
        title={isInbox ? '收件箱不可重命名' : undefined}
        onClick={() => {
          onClose();
          onRename(folder);
        }}
      />
      <MenuItem
        icon={<CheckCheck className="w-3.5 h-3.5" />}
        label="全部标为已读"
        onClick={() => {
          onClose();
          onMarkAllSeen(folder);
        }}
      />
      <MenuItem
        icon={<Eraser className="w-3.5 h-3.5" />}
        label="清空文件夹"
        onClick={() => {
          onClose();
          onEmpty(folder);
        }}
      />
      <MenuItem
        icon={subscribed ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
        label={subscribed ? '取消订阅' : '订阅'}
        disabled={isInbox}
        title={isInbox ? '收件箱不可取消订阅' : subscribed ? '取消订阅后不在侧栏展示' : '重新在侧栏展示'}
        onClick={() => {
          onClose();
          onToggleSubscribe(folder);
        }}
      />
      <MenuDivider />
      <MenuItem
        icon={<Trash2 className="w-3.5 h-3.5" />}
        label="删除文件夹"
        danger
        disabled={isInbox || hasChildren}
        title={isInbox ? '收件箱不可删除' : hasChildren ? '请先删除子文件夹' : undefined}
        onClick={() => {
          onClose();
          onDelete(folder);
        }}
      />
    </>
  );
};
