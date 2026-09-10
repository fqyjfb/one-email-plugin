import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Reply,
  Forward,
  Trash2,
  MailOpen,
  Loader2,
  Mail,
  FolderInput,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import type { AttachmentMeta, MailDetail } from '../types';
import { formatAddress, formatAddressList, formatFullDate } from '../utils/format';
import AttachmentBar from './AttachmentBar';
import { openExternal } from '../services/externalService';

interface MailReaderProps {
  detail: MailDetail | null;
  loading: boolean;
  onReply: (detail: MailDetail) => void;
  onForward: (detail: MailDetail) => void;
  onDelete: (detail: MailDetail) => void;
  onMarkUnread: (detail: MailDetail) => void;
  onMove: (detail: MailDetail) => void;
  onDownloadAttachment: (att: AttachmentMeta) => void;
  /** 上一封 / 下一封导航（不传则不渲染按钮） */
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

/** 邮件正文容器 CSS scope：避免选择器污染主页面其它元素 */
const CONTENT_CLASS = 'oep-content';

const MailReader: React.FC<MailReaderProps> = ({
  detail,
  loading,
  onReply,
  onForward,
  onDelete,
  onMarkUnread,
  onMove,
  onDownloadAttachment,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}) => {
  // A9 远程图片按需加载：默认严格策略，切换邮件复位
  const [showRemote, setShowRemote] = useState(false);
  useEffect(() => {
    setShowRemote(false);
  }, [detail?.uid]);

  const hasImg = useMemo(() => /<img\b/i.test(detail?.html || ''), [detail?.html]);

  const cleanHtml = useMemo(() => {
    if (!detail?.html) return '';
    if (!showRemote) {
      return DOMPurify.sanitize(detail.html, {
        FORBID_TAGS: ['img', 'iframe', 'script', 'style', 'link', 'video', 'audio', 'object', 'embed'],
        FORBID_ATTR: ['src', 'srcset', 'style', 'onclick', 'onerror', 'onload'],
      });
    }
    return DOMPurify.sanitize(detail.html, {
      // 放行远程图片时仍禁：脚本/iframe/object/embed 及行内事件
      FORBID_TAGS: ['iframe', 'script', 'style', 'link', 'video', 'audio', 'object', 'embed'],
      FORBID_ATTR: ['style', 'onclick', 'onerror', 'onload'],
      // 仅放行 http/https/mailto/tel，禁 data:/javascript:
      ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:)/i,
    });
  }, [detail?.html, showRemote]);

  /** 邮件正文容器 ref（用于 onClick 拦截链接） */
  const contentRef = useRef<HTMLDivElement>(null);

  /**
   * 正文内 <a> 点击拦截：阻止浏览器默认跳转，转交外部浏览器打开
   * 锚点（#xxx）放行以保留原生滚动行为；javascript 已被 DOMPurify 过滤为兜底
   */
  const handleContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement)?.closest('a');
    if (!(a instanceof HTMLAnchorElement)) return;
    const href = a.getAttribute('href') || '';
    if (!href) return;
    // 锚点跳转让浏览器原生处理
    if (href.startsWith('#')) return;
    // 兜底：DOMPurify 已通过 ALLOWED_URI_REGEXP 剥离 javascript:/data:，这里二次守护
    if (/^\s*javascript:/i.test(href)) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    void openExternal(href);
  }, []);

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

  const showNav = onPrev || onNext;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-lg font-semibold mb-3">{detail.subject || '(无主题)'}</h2>
        {/* 邮件头信息：发件人/收件人/抄送/日期 */}
        <div className="text-sm">
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
        {/* 操作按钮：日期下方独立成行（图 + 文字） */}
        <div className="flex items-center flex-wrap gap-1.5 mt-3">
          {showNav && (
            <>
              <button
                onClick={onPrev}
                disabled={!hasPrev}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-accent text-xs disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                title="上一封"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                <span>上一封</span>
              </button>
              <button
                onClick={onNext}
                disabled={!hasNext}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-accent text-xs disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                title="下一封"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                <span>下一封</span>
              </button>
              <div className="w-px h-4 bg-border mx-0.5" aria-hidden="true" />
            </>
          )}
          <button onClick={() => onReply(detail)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-accent text-xs transition-colors" title="回复发件人">
            <Reply className="w-3.5 h-3.5" />
            <span>回复</span>
          </button>
          <button onClick={() => onForward(detail)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-accent text-xs transition-colors" title="转发">
            <Forward className="w-3.5 h-3.5" />
            <span>转发</span>
          </button>
          <button onClick={() => onMarkUnread(detail)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-accent text-xs transition-colors" title="标为未读">
            <MailOpen className="w-3.5 h-3.5" />
            <span>标为未读</span>
          </button>
          <button onClick={() => onMove(detail)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-accent text-xs transition-colors" title="移动到">
            <FolderInput className="w-3.5 h-3.5" />
            <span>移动</span>
          </button>
          <button onClick={() => onDelete(detail)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-accent text-destructive text-xs transition-colors" title="删除">
            <Trash2 className="w-3.5 h-3.5" />
            <span>删除</span>
          </button>
        </div>
      </div>

      <AttachmentBar attachments={detail.attachments} onDownload={onDownloadAttachment} />

      {/* 远程图片按需加载：仅在含 <img 且未放行时显示提示按钮 */}
      {hasImg && !showRemote && (
        <div className="px-5 py-2 border-b border-border bg-muted/30">
          <button
            onClick={() => setShowRemote(true)}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            title="可能暴露您的 IP 给发件人"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            显示远程图片
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
        {cleanHtml ? (
          <div
            ref={contentRef}
            onClick={handleContentClick}
            className={`${CONTENT_CLASS} px-5 py-4 text-sm leading-relaxed text-foreground break-words`}
            dangerouslySetInnerHTML={{ __html: cleanHtml }}
          />
        ) : (
          <pre className="whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed font-sans text-foreground">
            {detail.text || '(无正文)'}
          </pre>
        )}
      </div>

      {/* 内容容器 scope 样式：scoped 到 .oep-content，避免污染主页面其它 img/a */}
      <style>{`
        .${CONTENT_CLASS} img { max-width: 100% !important; height: auto !important; display: block; }
        .${CONTENT_CLASS} a { color: var(--primary, #2563eb); text-decoration: none; }
        .${CONTENT_CLASS} a:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
};

export default MailReader;
