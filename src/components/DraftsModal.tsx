import React from 'react';
import { Trash2, FileText } from 'lucide-react';
import type { Draft } from '../types';
import Modal from './Modal';
import { formatFullDate } from '../utils/format';

interface DraftsModalProps {
  isOpen: boolean;
  drafts: Draft[];
  onClose: () => void;
  onOpen: (draft: Draft) => void;
  onDelete: (id: string) => void;
}

const DraftsModal: React.FC<DraftsModalProps> = ({ isOpen, drafts, onClose, onOpen, onDelete }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="草稿箱" size="lg">
      <div className="max-h-[60vh] overflow-y-auto space-y-1">
        {drafts.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">暂无草稿</div>
        ) : (
          drafts.map((d) => (
            <div
              key={d.id}
              onClick={() => onOpen(d)}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent/60 cursor-pointer transition-colors"
            >
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{d.subject || '(无主题)'}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {d.to ? `收件人：${d.to}` : '（未填写收件人）'} · {formatFullDate(d.updatedAt)}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(d.id);
                }}
                className="hidden group-hover:block p-1 rounded hover:bg-background text-destructive transition-colors"
                title="删除草稿"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};

export default DraftsModal;
