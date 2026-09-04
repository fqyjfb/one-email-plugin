// 文件夹新建 / 重命名输入框（两种模式复用同一弹窗）
import React, { useEffect, useRef, useState } from 'react';
import type { Folder as FolderMeta } from '../types';
import Modal from './Modal';
import { leafName } from '../utils/folderTree';

interface FolderNameModalProps {
  isOpen: boolean;
  /** 传入表示重命名该文件夹；为 null 表示新建 */
  folder: FolderMeta | null;
  /** 新建时的父路径（根层级为 null） */
  parentPath: string | null;
  onClose: () => void;
  /** 返回 null 表示成功并关闭，返回文案表示失败（保留弹窗展示错误） */
  onSubmit: (name: string) => Promise<string | null>;
}

const FolderNameModal: React.FC<FolderNameModalProps> = ({
  isOpen,
  folder,
  parentPath,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  const isRename = !!folder;
  const initial = isRename ? leafName(folder) : '';

  // 每次打开重置为初始名并清空错误（依赖具体路径，避免切换目标后残留旧值）
  useEffect(() => {
    if (!isOpen) return;
    setName(initial);
    setError(null);
    submitting.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initial]);

  const submit = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('请输入文件夹名称');
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    const err = await onSubmit(trimmed);
    submitting.current = false;
    if (err) setError(err);
    else onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRename ? '重命名文件夹' : parentPath ? '新建子文件夹' : '新建文件夹'}
      confirmText={isRename ? '保存' : '创建'}
      cancelText="取消"
      size="sm"
      onConfirm={() => void submit(name)}
      onCancel={onClose}
    >
      <div className="space-y-2">
        <input
          autoFocus
          value={name}
          maxLength={64}
          placeholder="文件夹名称"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit(name);
          }}
          className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/40"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        {!isRename && parentPath && (
          <p className="text-xs text-muted-foreground truncate">创建于：{parentPath}</p>
        )}
      </div>
    </Modal>
  );
};

export default FolderNameModal;
