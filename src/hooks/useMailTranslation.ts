import { useCallback, useEffect, useRef, useState } from 'react';
import type { MailDetail, ToastMessage } from '../types';
import { translateText } from '../services/translateService';
import { htmlToPlainText } from '../utils/html';

export interface MailTranslation {
  subject: string;
  body: string;
}

type ToastType = ToastMessage['type'];
type AddToast = (message: string, type?: ToastType) => void;

const LANG_STORAGE_KEY = 'toolbox.one-email.translateLang';
const DEFAULT_LANG = 'auto';

const mailIdentity = (detail: MailDetail) => `${detail.accountId ?? 'local'}:${detail.uid}`;

/** 提取待翻译正文：优先纯文本部分，无则从 HTML 去标签 */
function extractBody(detail: MailDetail): string {
  const text = detail.text?.trim();
  if (text) return text;
  return detail.html ? htmlToPlainText(detail.html).trim() : '';
}

/**
 * 当前打开邮件的翻译状态：
 * - 点击头部翻译按钮后翻译主题 + 正文，完成自动切换到译文视图
 * - 勾选框控制译文/原文切换；同一邮件同一语言的翻译结果内存缓存，不重复请求
 * - 切换邮件或目标语言时复位视图；请求带序号防竞态，过期响应直接丢弃
 */
export function useMailTranslation(detail: MailDetail | null, addToast: AddToast) {
  const [targetLang, setTargetLangState] = useState<string>(() => {
    try {
      return localStorage.getItem(LANG_STORAGE_KEY) || DEFAULT_LANG;
    } catch {
      return DEFAULT_LANG;
    }
  });
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState<MailTranslation | null>(null);
  const [showTranslated, setShowTranslated] = useState(false);

  const detailRef = useRef(detail);
  detailRef.current = detail;
  const cacheRef = useRef(new Map<string, MailTranslation>());
  const reqSeqRef = useRef(0);

  // 切换邮件：复位译文视图（缓存保留，再次点翻译即时呈现）
  const identity = detail ? mailIdentity(detail) : null;
  useEffect(() => {
    reqSeqRef.current += 1;
    setTranslating(false);
    setTranslation(null);
    setShowTranslated(false);
  }, [identity]);

  const setTargetLang = useCallback((lang: string) => {
    setTargetLangState(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    // 语言变更后旧译文不再适用：作废旧请求并回到原文视图
    reqSeqRef.current += 1;
    setTranslating(false);
    setTranslation(null);
    setShowTranslated(false);
  }, []);

  const translateCurrent = useCallback(async () => {
    const current = detailRef.current;
    if (!current) {
      addToast('请先打开一封邮件', 'info');
      return;
    }
    const lang = targetLang;
    const cacheKey = `${mailIdentity(current)}:${lang}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setTranslation(cached);
      setShowTranslated(true);
      return;
    }

    const subject = current.subject?.trim() || '';
    const body = extractBody(current);
    if (!subject && !body) {
      addToast('该邮件没有可翻译的内容', 'info');
      return;
    }

    const seq = ++reqSeqRef.current;
    setTranslating(true);
    try {
      const [translatedSubject, translatedBody] = await Promise.all([
        subject ? translateText(subject, lang) : Promise.resolve(''),
        body ? translateText(body, lang) : Promise.resolve(''),
      ]);
      if (seq !== reqSeqRef.current) return; // 已切换邮件/语言，丢弃过期结果
      const result: MailTranslation = { subject: translatedSubject, body: translatedBody };
      cacheRef.current.set(cacheKey, result);
      setTranslation(result);
      setShowTranslated(true);
    } catch (e) {
      if (seq !== reqSeqRef.current) return;
      addToast(e instanceof Error ? e.message : '翻译失败，请稍后重试', 'error');
    } finally {
      if (seq === reqSeqRef.current) setTranslating(false);
    }
  }, [targetLang, addToast]);

  const toggleShowTranslated = useCallback((show: boolean) => {
    setShowTranslated(show);
  }, []);

  return {
    targetLang,
    setTargetLang,
    translating,
    translation,
    showTranslated,
    translateCurrent,
    toggleShowTranslated,
  };
}
