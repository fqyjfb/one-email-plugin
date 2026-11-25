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
  Languages,
  KeyRound,
  Copy,
  Eye,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import type { AttachmentMeta, MailDetail } from '../types';
import { formatAddress, formatAddressList, formatFullDate } from '../utils/format';
import { maskCode } from '../utils/codePrivacy';
import { useCodePrivacy } from '../hooks/useCodePrivacy';
import AttachmentBar from './AttachmentBar';
import { openExternal } from '../services/externalService';
import type { MailTranslation } from '../hooks/useMailTranslation';

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
  /** 当前邮件译文（null = 未翻译） */
  translation?: MailTranslation | null;
  translating?: boolean;
  /** 勾选框状态：true 显示译文替换原文，false 显示原文 */
  showTranslated?: boolean;
  onToggleTranslated?: (show: boolean) => void;
  /** 复制验证码（验证码条按钮） */
  onCopyCode?: (code: string) => void;
  /** 验证码隐私遮蔽：0=始终显示；>0 时打开 N 秒后掩码，可查看 15 秒 */
  codeHideSeconds?: number;
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
  translation = null,
  translating = false,
  showTranslated = false,
  onToggleTranslated,
  onCopyCode,
  codeHideSeconds = 0,
}) => {
  // A9 远程图片按需加载：默认严格策略，切换邮件复位
  const [showRemote, setShowRemote] = useState(false);
  useEffect(() => {
    setShowRemote(false);
  }, [detail?.uid]);

  // 验证码隐私遮蔽（hook 必须在所有早退分支之前调用）
  const privacy = useCodePrivacy(detail, codeHideSeconds);
  // 遮蔽时对 HTML 原文做掩码后再净化，避免验证码从正文漏出
  const bodyHtml = privacy.hidden ? privacy.maskedHtml ?? '' : detail?.html ?? '';

  const hasImg = useMemo(() => /<img\b/i.test(bodyHtml), [bodyHtml]);

  const cleanHtml = useMemo(() => {
    if (!bodyHtml) return '';
    if (!showRemote) {
      return DOMPurify.sanitize(bodyHtml, {
        FORBID_TAGS: ['img', 'iframe', 'script', 'style', 'link', 'video', 'audio', 'object', 'embed'],
        FORBID_ATTR: ['src', 'srcset', 'style', 'onclick', 'onerror', 'onload'],
      });
    }
    return DOMPurify.sanitize(bodyHtml, {
      // 放行远程图片时仍禁：脚本/iframe/object/embed 及行内事件
      FORBID_TAGS: ['iframe', 'script', 'style', 'link', 'video', 'audio', 'object', 'embed'],
      FORBID_ATTR: ['style', 'onclick', 'onerror', 'onload'],
      // 仅放行 http/https/mailto/tel，禁 data:/javascript:
      ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:)/i,
    });
  }, [bodyHtml, showRemote]);

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
  const otpCode = detail.code;
  const rawSubject = showTranslated && translation?.subject ? translation.subject : detail.subject || '(无主题)';
  const displaySubject = privacy.hidden && otpCode ? maskCode(rawSubject, otpCode) : rawSubject;

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-lg font-semibold mb-3">{displaySubject}</h2>
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
        {/* 验证码条：识别到验证码时显示；隐私遮蔽时掩码并提供「查看 15 秒」（移植自 daozai） */}
        {otpCode && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm">
            <KeyRound className="w-4 h-4 shrink-0 text-green-600" />
            <span className="text-green-700">验证码</span>
            {privacy.hidden ? (
              <>
                <span className="font-mono font-semibold tracking-wider text-green-800">••••••</span>
                <button
                  onClick={privacy.reveal}
                  className="ml-auto inline-flex items-center gap-1 rounded border border-green-300 bg-white px-2 py-0.5 text-xs text-green-700 hover:bg-green-100 transition-colors"
                  title="临时查看 15 秒"
                >
                  <Eye className="w-3 h-3" /> 查看 15 秒
                </button>
              </>
            ) : (
              <>
                <span className="font-mono font-semibold tracking-wider text-green-800 select-all">{otpCode}</span>
                {onCopyCode && (
                  <button
                    onClick={() => onCopyCode(otpCode)}
                    className="ml-auto inline-flex items-center gap-1 rounded border border-green-300 bg-white px-2 py-0.5 text-xs text-green-700 hover:bg-green-100 transition-colors"
                    title="复制验证码"
                  >
                    <Copy className="w-3 h-3" /> 复制
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {/* 译文开关：翻译中或已有译文时显示；勾选替换原文，取消恢复原文 */}
        {(translating || translation) && (
          <label className="mt-3 inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/50 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-primary cursor-pointer m-0"
              checked={showTranslated}
              disabled={translating || !translation}
              onChange={(e) => onToggleTranslated?.(e.target.checked)}
            />
            {translating ? (
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                正在翻译邮件…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5" />
                显示译文（取消勾选恢复原文）
              </span>
            )}
          </label>
        )}
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

      <div className="flex-1 overflow-auto mail-content-area">
        {showTranslated && translation ? (
          <div
            className={`${CONTENT_CLASS} px-5 py-4 text-sm leading-relaxed text-foreground break-words whitespace-pre-wrap`}
          >
            {(privacy.hidden && otpCode ? maskCode(translation.body || '', otpCode) : translation.body) || '(无正文)'}
          </div>
        ) : cleanHtml ? (
          <div
            ref={contentRef}
            onClick={handleContentClick}
            className={`${CONTENT_CLASS} px-5 py-4 text-sm leading-relaxed text-foreground break-words`}
            dangerouslySetInnerHTML={{ __html: cleanHtml }}
          />
        ) : (
          <pre className="whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed font-sans text-foreground">
            {(privacy.hidden ? privacy.maskedText : detail.text) || '(无正文)'}
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
