import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Loader2, Save, Paperclip, Trash2 } from 'lucide-react';
import type { AccountMeta, Credential, MailDetail, ComposeMail, Draft } from '../types';
import * as emailService from '../services/emailService';
import * as draftService from '../services/draftService';
import { generateId } from '../utils/id';
import { formatAddress, formatFullDate, formatSize } from '../utils/format';
import { plainTextToHtml, htmlToPlainText } from '../utils/html';
import { isValidEmail, splitAddresses } from '../utils/validate';
import RichTextEditor from './RichTextEditor';
import Modal from './Modal';

export type ComposeMode = 'new' | 'reply' | 'forward';

interface ComposeProps {
  account: AccountMeta;
  credential: Credential;
  mode: ComposeMode;
  source: MailDetail | null;
  draft?: Draft | null;
  onClose: () => void;
  onSent: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

// 附件本地态（保留 ArrayBuffer + 元信息；发送时转 ComposeMail.attachments）
interface LocalAttachment {
  filename: string;
  size: number;
  contentType: string;
  content: ArrayBuffer;
}

function quoteText(detail: MailDetail): string {
  const body = detail.text || '';
  const quoted = body
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  return `\n\n在 ${formatFullDate(detail.date)}，${formatAddress(detail.from)} 写道：\n${quoted}`;
}

function buildInitialHtml(mode: ComposeMode, source: MailDetail | null): string {
  if (mode === 'reply' && source) return plainTextToHtml(quoteText(source));
  if (mode === 'forward' && source) {
    const head = `\n\n---------- 转发的邮件 ----------\n发件人: ${formatAddress(source.from)}\n日期: ${formatFullDate(source.date)}\n主题: ${source.subject}\n\n`;
    return plainTextToHtml(head + (source.text || ''));
  }
  return '';
}

const Compose: React.FC<ComposeProps> = ({
  account,
  credential,
  mode,
  source,
  draft = null,
  onClose,
  onSent,
  addToast,
}) => {
  const [to, setTo] = useState(() => {
    if (draft) return draft.to;
    return mode === 'reply' && source ? (source.from?.address || '') : '';
  });
  const [cc, setCc] = useState(() => (draft ? draft.cc : ''));
  // A7 密送：历史草稿可能无 bcc 字段
  const [bcc, setBcc] = useState(() => (draft?.bcc || ''));
  const [subject, setSubject] = useState(() => {
    if (draft) return draft.subject;
    if (mode === 'new' || !source) return '';
    const s = source.subject || '';
    if (mode === 'reply') return s.startsWith('Re:') ? s : `Re: ${s}`;
    return s.startsWith('Fwd:') ? s : `Fwd: ${s}`;
  });
  const [bodyHtml, setBodyHtml] = useState(() => (draft ? draft.bodyHtml : buildInitialHtml(mode, source)));
  const [sending, setSending] = useState(false);
  // A1 附件
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  // A2 弃用确认
  const [showDiscard, setShowDiscard] = useState(false);

  // A5 自动草稿：保存/发送后用「上次已保存快照」做脏判定
  const [draftId, setDraftId] = useState<string | null>(draft?.id ?? null);
  const skipFirstRef = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef({ to, cc, bcc, subject, bodyHtml });

  const fromLine = `${account.displayName || account.email} <${account.email}>`;

  // 统一快照 / 脏检测（A2 + A5 共用）
  const snapshot = () => ({ to, cc, bcc, subject, bodyHtml });
  const isDirty = () => JSON.stringify(snapshot()) !== JSON.stringify(savedRef.current);
  const markSaved = () => {
    savedRef.current = snapshot();
  };

  // A2 关闭：脏则二次确认
  const requestClose = () => {
    if (isDirty()) setShowDiscard(true);
    else onClose();
  };

  // A1 附件
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // 允许重复选同一文件
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () =>
        setAttachments((prev) => [
          ...prev,
          {
            filename: f.name,
            size: f.size,
            contentType: f.type,
            content: reader.result as ArrayBuffer,
          },
        ]);
      reader.onerror = () => addToast(`读取失败：${f.name}`, 'error');
      reader.readAsArrayBuffer(f);
    });
  };
  const removeAttachment = (idx: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== idx));

  // A5 手动存草稿（与自动保存共用 upsertDraft）
  const handleSaveDraft = () => {
    const d: Draft = {
      id: draftId ?? draft?.id ?? generateId('draft'),
      accountId: account.id,
      to,
      cc,
      bcc,
      subject: subject.trim(),
      bodyHtml,
      updatedAt: Date.now(),
    };
    draftService.upsertDraft(d);
    setDraftId(d.id);
    markSaved();
    addToast('草稿已保存', 'success');
  };

  const handleSend = async () => {
    if (!to.trim()) {
      addToast('请填写收件人', 'warning');
      return;
    }
    if (!subject.trim()) {
      addToast('请填写主题', 'warning');
      return;
    }

    // A8 邮箱格式校验（三处共用 splitAddresses / isValidEmail）
    const toAddrs = splitAddresses(to);
    const ccAddrs = cc ? splitAddresses(cc) : [];
    const bccAddrs = bcc ? splitAddresses(bcc) : [];
    const invalid = [...toAddrs, ...ccAddrs, ...bccAddrs].filter((a) => !isValidEmail(a));
    if (invalid.length) {
      addToast(`存在无效邮箱地址：${invalid.join('、')}`, 'warning');
      return;
    }

    const plain = htmlToPlainText(bodyHtml);
    const sigPlain = account.signature ? `\n\n--\n${account.signature}` : '';
    const sigHtml = account.signature
      ? `<div style="margin-top:12px;color:#666;font-size:13px">--<br>${plainTextToHtml(account.signature)}</div>`
      : '';

    const mail: ComposeMail = {
      from: fromLine,
      to: toAddrs,
      cc: ccAddrs.length ? ccAddrs : undefined,
      bcc: bccAddrs.length ? bccAddrs : undefined,
      subject: subject.trim(),
      text: plain + sigPlain,
      html: bodyHtml + sigHtml,
      inReplyTo: mode === 'reply' ? (source?.messageId ?? undefined) : undefined,
      references: mode === 'reply' ? (source?.messageId ?? undefined) : undefined,
      // A1 附件：无附件时为 undefined，保持旧行为
      attachments: attachments.length
        ? attachments.map(({ filename, content, contentType }) => ({
            filename,
            content,
            contentType: contentType || undefined,
          }))
        : undefined,
    };

    setSending(true);
    try {
      await emailService.sendMessage(account, credential, mail);
      // 发送成功后按 draftId 删除（兼容自动草稿与手动草稿）
      if (draftId) draftService.deleteDraft(draftId);
      addToast('发送成功', 'success');
      onSent();
    } catch (e) {
      addToast((e as Error).message, 'error');
    } finally {
      setSending(false);
    }
  };

  // A5 自动存草稿：2s 防抖，发送中跳过；首次渲染不重写（避免覆盖打开的草稿）
  useEffect(() => {
    if (skipFirstRef.current) {
      skipFirstRef.current = false;
      return;
    }
    if (sending) return;
    const timer = window.setTimeout(() => {
      const d: Draft = {
        id: draftId ?? generateId('draft'),
        accountId: account.id,
        to,
        cc,
        bcc,
        subject: subject.trim(),
        bodyHtml,
        updatedAt: Date.now(),
      };
      draftService.upsertDraft(d);
      setDraftId(d.id);
      markSaved();
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [to, cc, bcc, subject, bodyHtml, sending]);

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring';
  const labelCls = 'block text-xs text-muted-foreground mb-1';

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <span className="font-semibold text-sm">
          {mode === 'new' ? '写邮件' : mode === 'reply' ? '回复' : '转发'}
          {draft && <span className="ml-2 text-xs font-normal text-muted-foreground">（草稿）</span>}
        </span>
        <button onClick={requestClose} className="p-1.5 rounded-md hover:bg-accent transition-colors" title="关闭">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        <div>
          <label className={labelCls}>发件人</label>
          <div className="text-sm text-muted-foreground">{fromLine}</div>
        </div>
        <div>
          <label className={labelCls}>收件人 *</label>
          <input value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} placeholder="多个地址用逗号或分号分隔" />
        </div>
        <div>
          <label className={labelCls}>抄送</label>
          <input value={cc} onChange={(e) => setCc(e.target.value)} className={inputCls} placeholder="多个地址用逗号或分号分隔" />
        </div>
        <div>
          <label className={labelCls}>密送</label>
          <input value={bcc} onChange={(e) => setBcc(e.target.value)} className={inputCls} placeholder="多个地址用逗号或分号分隔" />
        </div>
        <div>
          <label className={labelCls}>主题 *</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
        </div>

        {/* A1 附件列表：每项可单独移除 */}
        {attachments.length > 0 && (
          <div>
            <label className={labelCls}>附件 ({attachments.length})</label>
            <div className="flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <div
                  key={`${a.filename}-${i}`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-muted/50 text-sm"
                >
                  <span className="truncate max-w-[240px]" title={a.filename}>
                    {a.filename}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatSize(a.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="p-0.5 rounded hover:bg-accent text-destructive transition-colors"
                    title="移除附件"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className={labelCls}>正文</label>
          <RichTextEditor html={bodyHtml} onChange={setBodyHtml} minHeight={220} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border">
        <div className="flex items-center gap-2">
          {/* A1 添加附件按钮：触发隐藏 file input */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={sending}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-60"
            title="添加附件"
          >
            <Paperclip className="w-4 h-4" />
            附件
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFiles}
          />
          <button
            onClick={handleSaveDraft}
            disabled={sending}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            存草稿
          </button>
        </div>
        <button
          onClick={handleSend}
          disabled={sending}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-colors disabled:opacity-60"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          发送
        </button>
      </div>

      {/* A2 关闭前未保存确认（复用 Modal 组件） */}
      <Modal
        isOpen={showDiscard}
        onClose={() => setShowDiscard(false)}
        onCancel={() => setShowDiscard(false)}
        onConfirm={() => {
          setShowDiscard(false);
          onClose();
        }}
        title="放弃编辑？"
        confirmText="放弃"
        cancelText="继续编辑"
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          当前编辑内容尚未发送或保存草稿，关闭后无法恢复。
        </p>
      </Modal>
    </div>
  );
};

export default Compose;
