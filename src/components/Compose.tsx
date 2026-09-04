import React, { useState } from 'react';
import { X, Send, Loader2, Save } from 'lucide-react';
import type { AccountMeta, Credential, MailDetail, ComposeMail, Draft } from '../types';
import * as emailService from '../services/emailService';
import * as draftService from '../services/draftService';
import { generateId } from '../utils/id';
import { formatAddress, formatFullDate } from '../utils/format';
import { plainTextToHtml, htmlToPlainText } from '../utils/html';
import RichTextEditor from './RichTextEditor';

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
  const [subject, setSubject] = useState(() => {
    if (draft) return draft.subject;
    if (mode === 'new' || !source) return '';
    const s = source.subject || '';
    if (mode === 'reply') return s.startsWith('Re:') ? s : `Re: ${s}`;
    return s.startsWith('Fwd:') ? s : `Fwd: ${s}`;
  });
  const [bodyHtml, setBodyHtml] = useState(() => (draft ? draft.bodyHtml : buildInitialHtml(mode, source)));
  const [sending, setSending] = useState(false);

  const fromLine = `${account.displayName || account.email} <${account.email}>`;

  const handleSaveDraft = () => {
    const d: Draft = {
      id: draft?.id ?? generateId('draft'),
      accountId: account.id,
      to,
      cc,
      subject: subject.trim(),
      bodyHtml,
      updatedAt: Date.now(),
    };
    draftService.upsertDraft(d);
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

    const plain = htmlToPlainText(bodyHtml);
    const sigPlain = account.signature ? `\n\n--\n${account.signature}` : '';
    const sigHtml = account.signature
      ? `<div style="margin-top:12px;color:#666;font-size:13px">--<br>${plainTextToHtml(account.signature)}</div>`
      : '';

    const mail: ComposeMail = {
      from: fromLine,
      to: to.split(',').map((s) => s.trim()).filter(Boolean),
      cc: cc ? cc.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      subject: subject.trim(),
      text: plain + sigPlain,
      html: bodyHtml + sigHtml,
      inReplyTo: mode === 'reply' ? (source?.messageId ?? undefined) : undefined,
      references: mode === 'reply' ? (source?.messageId ?? undefined) : undefined,
    };

    setSending(true);
    try {
      await emailService.sendMessage(account, credential, mail);
      if (draft) draftService.deleteDraft(draft.id);
      addToast('发送成功', 'success');
      onSent();
    } catch (e) {
      addToast((e as Error).message, 'error');
    } finally {
      setSending(false);
    }
  };

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
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-accent transition-colors" title="关闭">
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
          <input value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} placeholder="多个地址用逗号分隔" />
        </div>
        <div>
          <label className={labelCls}>抄送</label>
          <input value={cc} onChange={(e) => setCc(e.target.value)} className={inputCls} placeholder="多个地址用逗号分隔" />
        </div>
        <div>
          <label className={labelCls}>主题 *</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>正文</label>
          <RichTextEditor html={bodyHtml} onChange={setBodyHtml} minHeight={220} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border">
        <button
          onClick={handleSaveDraft}
          disabled={sending}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          存草稿
        </button>
        <button
          onClick={handleSend}
          disabled={sending}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-colors disabled:opacity-60"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          发送
        </button>
      </div>
    </div>
  );
};

export default Compose;
