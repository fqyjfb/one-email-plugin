import React, { useMemo } from 'react';
import { Reply, Forward, Trash2, MailOpen, Loader2, Mail, FolderInput } from 'lucide-react';
import DOMPurify from 'dompurify';
import type { AttachmentMeta, MailDetail } from '../types';
import { formatAddress, formatAddressList, formatFullDate } from '../utils/format';
import AttachmentBar from './AttachmentBar';

interface MailReaderProps {
  detail: MailDetail | null;
  loading: boolean;
  onReply: (detail: MailDetail) => void;
  onForward: (detail: MailDetail) => void;
  onDelete: (detail: MailDetail) => void;
  onMarkUnread: (detail: MailDetail) => void;
  onMove: (detail: MailDetail) => void;
  onDownloadAttachment: (att: AttachmentMeta) => void;
}

const MailReader: React.FC<MailReaderProps> = ({
  detail,
  loading,
  onReply,
  onForward,
  onDelete,
  onMarkUnread,
  onMove,
  onDownloadAttachment,
}) => {
  const cleanHtml = useMemo(() => {
    if (!detail?.html) return '';
    return DOMPurify.sanitize(detail.html, {
      FORBID_TAGS: ['img', 'iframe', 'script', 'style', 'link', 'video', 'audio', 'object', 'embed'],
      FORBID_ATTR: ['src', 'srcset', 'style', 'onclick', 'onerror', 'onload'],
    });
  }, [detail?.html]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
        <Mail className="w-10 h-10 mb-3 opacity-40" />
        <p className="text-sm">选择一封邮件开始阅读</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-lg font-semibold mb-3">{detail.subject || '(无主题)'}</h2>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 text-sm">
            <div className="text-muted-foreground">
              发件人：<span className="text-foreground">{formatAddress(detail.from)}</span>
            </div>
            {detail.to && detail.to.length > 0 && (
              <div className="text-muted-foreground">收件人：{formatAddressList(detail.to)}</div>
            )}
            {detail.cc && detail.cc.length > 0 && (
              <div className="text-muted-foreground">抄送：{formatAddressList(detail.cc)}</div>
            )}
            <div className="text-xs text-muted-foreground mt-1">{formatFullDate(detail.date)}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onReply(detail)} className="p-2 rounded-md hover:bg-accent transition-colors" title="回复">
              <Reply className="w-4 h-4" />
            </button>
            <button onClick={() => onForward(detail)} className="p-2 rounded-md hover:bg-accent transition-colors" title="转发">
              <Forward className="w-4 h-4" />
            </button>
            <button onClick={() => onMarkUnread(detail)} className="p-2 rounded-md hover:bg-accent transition-colors" title="标为未读">
              <MailOpen className="w-4 h-4" />
            </button>
            <button onClick={() => onMove(detail)} className="p-2 rounded-md hover:bg-accent transition-colors" title="移动到">
              <FolderInput className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(detail)} className="p-2 rounded-md hover:bg-accent text-destructive transition-colors" title="删除">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <AttachmentBar attachments={detail.attachments} onDownload={onDownloadAttachment} />

      <div className="flex-1 overflow-auto">
        {cleanHtml ? (
          <iframe
            title="邮件正文"
            className="w-full h-full border-0 bg-white dark:bg-gray-900"
            sandbox=""
            srcDoc={cleanHtml}
          />
        ) : (
          <pre className="whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed font-sans text-foreground">
            {detail.text || '(无正文)'}
          </pre>
        )}
      </div>
    </div>
  );
};

export default MailReader;
