/**
 * 验证码提取（移植自参考项目 daozai 的 src/otp.rs，v0.5.5）。
 *
 * 加权打分而不是单条正则：单正则会把订单号、金额、电话当验证码。
 * 规则参考 pulse-mail 的强/弱/负向词表与形状权重，中文关键词按国内邮件场景补齐；
 * 门槛 65 分——宁可漏，不可错。
 *
 * 纯函数、零 DOM / 零 Node 专属依赖，可在渲染层与主进程共用，也可用 node 原生
 * strip-types 直接单测（node src/utils/otp.test.ts）。
 */

export interface OtpCode {
  text: string;
  score: number;
}

/** 上岛门槛：低于这个分数只当作普通邮件。 */
export const OTP_THRESHOLD = 65;

// 所有正则统一带 g（供 matchAll 使用），test 前由 testRe 重置 lastIndex。
const STRONG = /[验驗][证證][码碼]|校[验驗][码碼]|[确確][认認][码碼]|[动動][态態](?:密)?[码碼]|安全[码碼]|登[录錄入][码碼]|激活[码碼]|一次性(?:密[码碼]|口令)|otp|one[-\s]?time\s+(?:code|password|passcode)|verification\s+code|security\s+code|auth(?:entication)?\s+code|passcode|\bcode\b|認証コード|인증번호/gi;

const WEAK = /登[录錄入陆陸]|[验驗][证證]|校[验驗]|身份|[确確][认認]|安全|sign[-\s]?in|log[-\s]?in|verify|verification|confirm|authenticate/gi;

const CANDIDATE = /(?:[A-Za-z]{1,3}-)?(?:\d{3,4}[- ]\d{3,4}|\d{4}-\d{4}|[A-Za-z0-9]{3,4}-[A-Za-z0-9]{3,4}|\d{4,8}|[A-Za-z0-9]{4,8})/g;

const CLOCK = /\d{1,2}:\d{2}/g;

// html_to_text 用
const SCRIPT_RE = /<(?:script|style)[^>]*>[\s\S]*?<\/(?:script|style)>/gi;
const TAGS_RE = /<[^>]+>/g;
const BREAK_RE = /<br\s*\/?>|<\/p>|<\/div>|<\/tr>|<\/li>|<\/h[1-6]>/gi;

// emphasized 用
const EMPHASIS_RE = /<(?:b|strong|h[1-6])[^>]*>([\s\S]*?)<\/(?:b|strong|h[1-6])>|<span[^>]*font-size:\s*(?:2\d|3\d|4\d)px[^>]*>([\s\S]*?)<\/span>/gi;

// visible_html 用
const VH_TAG = /<\s*(\/?)\s*([a-z][a-z0-9:-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const VH_HIDDEN = /(?:^|\s)hidden(?:\s|=|\/|$)|\bstyle\s*=\s*["'][^"']*(?:display\s*:\s*none|mso-hide\s*:\s*all|visibility\s*:\s*hidden)[^"']*["']/gi;

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const QUOTE_CHARS = "\"'“”‘’「」`";

// ---------- 基础工具 ----------

function chars(s: string): string[] {
  return Array.from(s);
}

function charCount(s: string): number {
  return chars(s).length;
}

function lastChar(s: string): string | undefined {
  const a = chars(s);
  return a.length ? a[a.length - 1] : undefined;
}

function firstChar(s: string): string | undefined {
  const a = chars(s);
  return a.length ? a[0] : undefined;
}

function takeChars(s: string, n: number): string {
  return chars(s).slice(0, n).join('');
}

function before(text: string, at: number, n: number): string {
  return chars(text.slice(0, at)).slice(-n).join('');
}

function after(text: string, at: number, n: number): string {
  return chars(text.slice(at)).slice(0, n).join('');
}

function around(text: string, start: number, end: number, n: number): string {
  return before(text, start, n) + after(text, end, n);
}

function testRe(re: RegExp, s: string): boolean {
  re.lastIndex = 0;
  return re.test(s);
}

function has(win: string, words: readonly string[]): boolean {
  const lower = win.toLowerCase();
  for (let i = 0; i < words.length; i++) {
    if (lower.indexOf(words[i]) !== -1) return true;
  }
  return false;
}

function trimEndChars(s: string, chars: string): string {
  let i = s.length;
  while (i > 0 && chars.indexOf(s[i - 1]) !== -1) i--;
  return s.slice(0, i);
}

function trimStartChars(s: string, chars: string): string {
  let i = 0;
  while (i < s.length && chars.indexOf(s[i]) !== -1) i++;
  return s.slice(i);
}

function isAsciiAlnum(c: string | undefined): boolean {
  return c != null && /^[A-Za-z0-9]$/.test(c);
}

// ---------- 词表 ----------

const ORDER_WORDS: readonly string[] = [
  '订单', '单号', '快递', '运单', '物流', '包裹', '编号', '序号', '发票', '金额', '合计',
  '实付', '应付', '电话', '手机号', '会议号', '会议', '卡尾号', '尾号', '邮编', 'sku',
  '訂單', '單號', '快遞', '運單', '編號', '序號', '發票', '金額', '合計', '實付', '應付', '電話', '手機號', '會議', '尾號', '郵編',
  'order', 'track', 'invoice', 'amount', 'phone', 'meeting', 'card ending',
];

const MONEY_WORDS: readonly string[] = ['¥', '￥', '$', '€', '元', '价格', '金额', '合计', '实付', '应付', '價格', '金額', '合計', '實付', '應付'];

const PROMO_WORDS: readonly string[] = [
  '优惠', '折扣', '促销', '满减', '券', '红包', 'coupon', 'promo', 'discount', 'sale',
  '優惠', '促銷', '滿減', '紅包',
];

const EXPIRE_WORDS: readonly string[] = [
  '有效', '过期', '失效', 'expire', 'valid', 'minutes', '分钟', '小时内', '過期', '分鐘', '小時內',
];

const PROSE = new Set<string>([
  'please', 'verify', 'confirm', 'code', 'your', 'this', 'that', 'enter', 'click', 'continue',
  'account', 'email', 'password', 'security', 'valid', 'invalid', 'expired', 'expires', 'expire',
  'required', 'secret', 'secure', 'private', 'unique', 'ready', 'active', 'inactive', 'pending', 'sent', 'received',
  'request', 'requested', 'welcome', 'thanks', 'thank', 'regards', 'dear', 'hello', 'team',
  'support', 'help', 'here', 'open', 'login', 'signin', 'sign', 'will', 'soon', 'sample', 'example',
  'test', 'token', 'success', 'failure', 'correct', 'check', 'located', 'below', 'above',
  'copy', 'paste', 'next', 'back', 'cancel', 'close', 'submit', 'resend', 'retry', 'start', 'finish',
  'send', 'reset', 'refresh', 'change', 'update', 'updated', 'enabled', 'disabled', 'complete',
  'only', 'none', 'normal', 'unknown', 'missing', 'allowed', 'denied', 'blocked',
  'google', 'github', 'openai', 'apple', 'amazon',
]);

// ---------- 归一化 ----------

/** 全角转半角、去零宽字符、全角空格归一。 */
function normalize(s: string): string {
  let out = '';
  for (const c of s) {
    const cp = c.codePointAt(0)!;
    if (cp === 0x200b || cp === 0x200c || cp === 0x200d || cp === 0xfeff || cp === 0x2060) continue;
    if (cp === 0x3000) { out += ' '; continue; }
    if (cp >= 0xff01 && cp <= 0xff5e) { out += String.fromCodePoint(cp - 0xfee0); continue; }
    out += c;
  }
  return out;
}

// ---------- 纯字母验证码 ----------

/** 纯字母只接受明确的验证码字段，不能靠标题、大小写或强调样式累积成高分。 */
function alphabeticCodeAt(
  hay: string,
  start: number,
  end: number,
  text: string,
  emph: readonly string[],
): boolean {
  const core = text.replace(/[- ]/g, '');
  if (core.length < 4 || core.length > 8) return false;
  if (!/^[A-Za-z]+$/.test(core)) return false;
  if (PROSE.has(core.toLowerCase())) return false;

  const prefix = before(hay, start, 64);
  const matches = Array.from(prefix.matchAll(STRONG)).filter((m) => {
    if (m[0].toLowerCase() === 'code') return false;
    const prevCh = lastChar(prefix.slice(0, m.index!));
    const nextCh = firstChar(prefix.slice(m.index! + m[0].length));
    if (isAsciiAlnum(prevCh) || isAsciiAlnum(nextCh)) return false;
    return true;
  });
  const label = matches.length ? matches[matches.length - 1] : undefined;
  if (!label) return false;

  const rawGap = prefix.slice(label.index! + label[0].length);
  const gap = trimEndChars(trimEndChars(rawGap.trim(), QUOTE_CHARS).trim(), ':：=').trim().toLowerCase();
  if (gap !== '' && gap !== 'is' && gap !== '为' && gap !== '為' && gap !== '是') return false;

  const tail = trimStartChars(trimStartChars(hay.slice(end), QUOTE_CHARS), ' \t');
  if (tail.startsWith('@') || tail.startsWith('/') || tail.startsWith('\\') || tail.startsWith('_') || tail.startsWith('-')) {
    return false;
  }
  if (tail.startsWith('.') && tail.length > 1 && isAsciiAlnum(tail[1])) return false;

  const terminal = tail.length === 0 || '\r\n.,，。;；!！)）'.indexOf(tail[0]) !== -1;

  const lineStartIdx = hay.slice(0, start).lastIndexOf('\n');
  const lineStart = lineStartIdx === -1 ? 0 : lineStartIdx + 1;
  const lineEndIdx = hay.indexOf('\n', end);
  const lineEnd = lineEndIdx === -1 ? hay.length : lineEndIdx;
  const lineText = hay.slice(lineStart, lineEnd).trim();
  const ownLine = trimEndChars(lineText, QUOTE_CHARS) === text;
  const exactEmphasis = emph.some((e) => e.trim() === text);

  if (!terminal && !exactEmphasis) return false;
  if (rawGap.indexOf('\n') !== -1) {
    if (!ownLine && !exactEmphasis) return false;
  } else if (
    rawGap.indexOf(':') === -1 &&
    rawGap.indexOf('：') === -1 &&
    rawGap.indexOf('=') === -1 &&
    !(gap !== '' && chars(core).filter((b) => /[A-Z]/.test(b)).length >= 2) &&
    !exactEmphasis
  ) {
    return false;
  }

  return (
    !has(around(hay, start, end, 6), MONEY_WORDS) &&
    !has(before(hay, start, 20), ORDER_WORDS) &&
    !has(after(hay, end, 8), ORDER_WORDS) &&
    !has(around(hay, start, end, 40), PROMO_WORDS)
  );
}

// ---------- 打分 ----------

function scoreAt(
  hay: string,
  start: number,
  end: number,
  text: string,
  subjectEnd: number,
  emph: readonly string[],
): [number, boolean] | undefined {
  const core = chars(text).filter((c) => /[A-Za-z0-9]/.test(c)).join('');
  const digits = chars(core).filter((c) => /[0-9]/.test(c)).length;
  const letters = chars(core).filter((c) => /[A-Za-z]/.test(c)).length;
  if (digits === 0) return undefined;

  const mixed = letters > 0;
  const separated = text.indexOf('-') !== -1 || text.indexOf(' ') !== -1;
  const len = charCount(core);

  let score: number;
  if (mixed) {
    if (len < 5) return undefined;
    if (len === 6) score = 20;
    else if (separated) score = 22;
    else score = 14;
  } else {
    switch (len) {
      case 6: score = separated ? 28 : 30; break;
      case 7:
      case 8: score = separated ? 22 : 18; break;
      case 5: score = 20; break;
      case 4: score = 16; break;
      default: return undefined;
    }
  }

  const b40 = before(hay, start, 40);
  const b250 = before(hay, start, 250);
  const b60 = before(hay, start, 60);
  const a40 = after(hay, end, 40);

  // ---- 硬丢弃：URL / 邮箱 / 日期时间 / 电话 / 订单金额卡号 ----
  let left = 0;
  for (let i = start - 1; i >= 0; i--) {
    if (/\s/.test(hay[i])) { left = i + 1; break; }
  }
  let right = hay.length;
  for (let i = end; i < hay.length; i++) {
    if (/\s/.test(hay[i])) { right = i; break; }
  }
  const token = hay.slice(left, right);
  const tl = token.toLowerCase();
  if (tl.indexOf('http') !== -1 || tl.indexOf('www.') !== -1 || token.indexOf('/') !== -1 || token.indexOf('@') !== -1) {
    return undefined;
  }

  const dateWin = around(hay, start, end, 6);
  if (
    has(dateWin, ['年', '月', '日', '有效期至']) ||
    testRe(CLOCK, dateWin) ||
    testRe(CLOCK, before(hay, start, 8))
  ) {
    return undefined;
  }
  if (has(around(hay, start, end, 6), MONEY_WORDS)) return undefined;
  if (has(before(hay, start, 20), ORDER_WORDS) || has(after(hay, end, 8), ORDER_WORDS)) return undefined;

  // 4 位年份：直接判负，掉到门槛以下
  if (len === 4 && !mixed) {
    const y = parseInt(core, 10);
    if (!Number.isNaN(y) && y >= 1900 && y <= 2100) score -= 35;
  }

  // ---- 正向信号 ----
  const strongBefore = testRe(STRONG, b40);
  if (strongBefore) score += 40;
  else if (testRe(STRONG, b250)) score += 22;
  else if (testRe(WEAK, b60)) score += 15;
  if (testRe(STRONG, a40)) score += 28;

  const lineStartIdx = hay.slice(0, start).lastIndexOf('\n');
  const lineStart = lineStartIdx === -1 ? 0 : lineStartIdx + 1;
  const lineEndIdx = hay.indexOf('\n', start);
  const lineEnd = lineEndIdx === -1 ? hay.length : lineEndIdx;
  let line = hay.slice(lineStart, lineEnd).trim();
  line = trimEndChars(line, '。，,.!！、;；').trim();
  const ownLine = line === text;
  const colon = /:\s*$/.test(hay.slice(0, start).trimEnd());
  const charPos = charCount(hay.slice(0, start));
  const inSubject = charPos < subjectEnd;
  const isEmph = emph.some((e) => e.indexOf(text) !== -1);

  if (mixed && !(ownLine || colon || inSubject || isEmph)) return undefined;

  if (ownLine) score += 15;
  if (colon) score += 10;
  if (inSubject) score += 15;
  if (isEmph) score += 25;
  if (has(b40, ['验证码是', '验证码为', '校验码是', '驗證碼是', '驗證碼為', '校驗碼是', 'code is', 'code:'])) score += 5;
  if (has(a40, EXPIRE_WORDS) || has(b60, EXPIRE_WORDS)) score += 5;
  if (has(around(hay, start, end, 40), PROMO_WORDS)) score -= 30;

  const strongSignal = strongBefore || testRe(STRONG, a40) || inSubject || isEmph || ownLine || colon;
  return [score, strongSignal];
}

// ---------- 主入口 ----------

/**
 * 从主题 + 正文里挑出最像验证码的一个；`emphasized` 是 HTML 里加粗/大字号片段的纯文本。
 * 移植自 daozai `otp::extract`。
 */
export function extractOtp(
  subject: string,
  body: string,
  emphasized: readonly string[],
): OtpCode | null {
  const normSubject = normalize(subject);
  const normBody = normalize(takeChars(body, 6000));
  const hay = normSubject + '\n' + normBody;
  const subjectEnd = charCount(normSubject) + 1;
  const emph = emphasized.map((s) => normalize(s));

  let best: { score: number; pos: number; inSubject: boolean; code: OtpCode } | undefined;
  let alphabetic: OtpCode | undefined;
  let alphabeticAmbiguous = false;

  for (const m of hay.matchAll(CANDIDATE)) {
    const start = m.index!;
    const end = start + m[0].length;
    const prev = lastChar(hay.slice(0, start));
    const next = firstChar(hay.slice(end));
    // 只认 ASCII 字母数字边界：中文紧贴验证码是常态，不能当边界外丢弃。
    if (isAsciiAlnum(prev) || isAsciiAlnum(next)) continue;

    const text = m[0];
    if (/^[A-Za-z -]+$/.test(text)) {
      if (alphabeticCodeAt(hay, start, end, text, emph)) {
        if (alphabetic) {
          if (alphabetic.text !== text) alphabeticAmbiguous = true;
        } else {
          alphabetic = { text, score: OTP_THRESHOLD };
        }
      }
      continue;
    }

    const got = scoreAt(hay, start, end, text, subjectEnd, emph);
    if (!got) continue;
    const [score, strongSignal] = got;
    // 没有强信号就不算验证码：宁可不显示，也不能把订单号、金额放大展示。
    if (!strongSignal) continue;

    const charPos = charCount(hay.slice(0, start));
    const inSubject = charPos < subjectEnd;
    let better = false;
    if (!best) better = true;
    else {
      better =
        score > best.score ||
        (score === best.score && inSubject && !best.inSubject) ||
        (score === best.score && inSubject === best.inSubject && charPos < best.pos);
    }
    if (better) best = { score, pos: charPos, inSubject, code: { text, score } };
  }

  if (best && best.code.score >= OTP_THRESHOLD) return best.code;
  if (alphabeticAmbiguous) return null;
  return alphabetic ?? null;
}

// ---------- HTML 辅助（移植自 daozai mail_format） ----------

/** HTML 实体解码（移植自 daozai `mail_format::decode`）。 */
function decodeHtmlEntities(text: string): string {
  let out = '';
  let rest = text;
  while (true) {
    const idx = rest.indexOf('&');
    if (idx === -1) break;
    out += rest.slice(0, idx);
    const tail = rest.slice(idx);
    const end = tail.slice(0, 11).indexOf(';');
    if (end === -1) {
      out += '&';
      rest = tail.slice(1);
      continue;
    }
    const entity = tail.slice(1, end);
    let ch: string | undefined;
    switch (entity) {
      case 'nbsp': case '#160': case 'ensp': case 'emsp': case 'thinsp': case '#8194': case '#8195': case '#8201':
        ch = ' '; break;
      case 'amp': ch = '&'; break;
      case 'lt': ch = '<'; break;
      case 'gt': ch = '>'; break;
      case 'quot': ch = '"'; break;
      case 'apos': case '#39': ch = "'"; break;
      case 'middot': case '#183': case 'bull': case '#8226': ch = '·'; break;
      case 'mdash': ch = '—'; break;
      case 'ndash': ch = '–'; break;
      case 'hellip': ch = '…'; break;
      case 'copy': ch = '©'; break;
      case 'reg': ch = '®'; break;
      case 'zwnj': ch = '\u200c'; break;
      case 'zwj': ch = '\u200d'; break;
      case 'shy': ch = '\u00ad'; break;
      default: {
        let cp: number | undefined;
        if (entity.startsWith('#x') || entity.startsWith('#X')) {
          cp = parseInt(entity.slice(2), 16);
        } else if (entity.startsWith('#')) {
          cp = parseInt(entity.slice(1), 10);
        }
        if (cp != null && !Number.isNaN(cp) && cp >= 0 && cp <= 0x10ffff) {
          ch = String.fromCodePoint(cp);
        }
      }
    }
    if (ch != null) {
      out += ch;
      rest = tail.slice(end + 1);
    } else {
      out += '&';
      rest = tail.slice(1);
    }
  }
  out += rest;
  return out;
}

/** 跳过隐藏块（display:none / hidden / mso-hide:all），移植自 daozai `mail_format::visible_html`。 */
function visibleHtml(html: string): string {
  let out = '';
  const stack: string[] = [];
  let cursor = 0;
  for (const cap of html.matchAll(VH_TAG)) {
    const hit = cap[0];
    const name = cap[2].toLowerCase();
    const attrs = cap[3] || '';
    const isClose = cap[1] === '/';
    if (stack.length === 0) out += html.slice(cursor, cap.index!);
    if (isClose) {
      const at = stack.lastIndexOf(name);
      if (at !== -1) stack.length = at;
      else if (stack.length === 0) out += hit;
    } else {
      const skip = stack.length > 0 || testRe(VH_HIDDEN, attrs);
      if (!skip) out += hit;
      if (skip && !attrs.trimEnd().endsWith('/') && !VOID_TAGS.has(name)) {
        stack.push(name);
      }
    }
    cursor = cap.index! + hit.length;
  }
  if (stack.length === 0) out += html.slice(cursor);
  return out;
}

/** HTML → 纯文本：去脚本样式、块级标签转换行、解常见实体、压缩空白。 */
export function htmlToText(html: string): string {
  const visible = visibleHtml(html);
  let s = visible.replace(SCRIPT_RE, ' ');
  s = s.replace(BREAK_RE, '\n');
  s = s.replace(TAGS_RE, '');
  s = decodeHtmlEntities(s);
  let out = '';
  for (const raw of s.split('\n')) {
    const t = raw.split(/\s+/).filter((x) => x.length > 0).join(' ');
    if (t.length > 0) {
      out += t;
      out += '\n';
    }
  }
  return out;
}

/** HTML 里被「当码呈现」的片段：加粗、标题、大字号 span。 */
export function extractEmphasized(html: string): string[] {
  const result: string[] = [];
  for (const cap of html.matchAll(EMPHASIS_RE)) {
    const inner = cap[1] != null ? cap[1] : cap[2];
    const text = htmlToText(inner).trim();
    if (text.length > 0) result.push(text);
  }
  return result;
}

/**
 * 便捷入口：给定邮件主题与正文（纯文本或 HTML），返回验证码或 null。
 * 渲染层/主进程通用。若已知正文是 HTML，会自动转纯文本并提取强调片段。
 */
export function extractOtpFromMail(opts: {
  subject: string;
  text?: string | null;
  html?: string | null;
}): string | null {
  const subject = opts.subject || '';
  const emphasized: string[] = opts.html ? extractEmphasized(opts.html) : [];
  // 优先纯文本；没有再用 HTML 转纯文本。
  let body = opts.text || '';
  if (!body.trim() && opts.html) body = htmlToText(opts.html);
  const code = extractOtp(subject, body, emphasized);
  return code ? code.text : null;
}
