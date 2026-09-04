import React from 'react';
import type { Folder as FolderMeta } from '../types';
import Modal from './Modal';
import { folderDisplayName, folderIcon } from '../utils/folderIcon';

interface MoveFolderModalProps {
  isOpen: boolean;
  folders: FolderMeta[];
  currentFolder: string;
  onClose: () => void;
  onPick: (path: string) => void;
}

const MoveFolderModal: React.FC<MoveFolderModalProps> = ({
  isOpen,
  folders,
  currentFolder,
  onClose,
  onPick,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="移动到文件夹" size="md">
      <div className="max-h-[50vh] overflow-y-auto space-y-0.5">
        {folders.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">暂无可用文件夹</div>
        )}
        {folders.map((f) => {
          const disabled = f.path === currentFolder;
          return (
            <button
              key={f.path}
              onClick={() => onPick(f.path)}
              disabled={disabled}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                disabled
                  ? 'text-muted-foreground opacity-50 cursor-not-allowed'
                  : 'hover:bg-accent/60 text-foreground'
              }`}
            >
              {folderIcon(f)}
              <span className="truncate" title={f.path}>{folderDisplayName(f)}</span>
              {disabled && <span className="ml-auto text-xs text-muted-foreground">当前</span>}
            </button>
          );
        })}
      </div>
    </Modal>
  );
};

export default MoveFolderModal;
