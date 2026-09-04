import React from 'react';
import { Paperclip, Download } from 'lucide-react';
import type { AttachmentMeta } from '../types';
import { formatSize } from '../utils/format';

interface AttachmentBarProps {
  attachments: AttachmentMeta[];
  onDownload: (att: AttachmentMeta) => void;
}

const AttachmentBar: React.FC<AttachmentBarProps> = ({ attachments, onDownload }) => {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="border-t border-border px-5 py-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
        <Paperclip className="w-3.5 h-3.5" /> 附件 ({attachments.length})
      </div>
      <div className="flex flex-wrap gap-2">
        {attachments.map((att, i) => (
          <div
            key={`${att.filename}-${i}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-muted/50 text-sm"
          >
            <span className="truncate max-w-[240px]" title={att.filename}>
              {att.filename}
            </span>
            <span className="text-xs text-muted-foreground">{formatSize(att.size)}</span>
            <button
              onClick={() => onDownload(att)}
              className="p-0.5 rounded hover:bg-accent transition-colors"
              title="下载附件"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AttachmentBar;
