/**
 * 验证码隐私遮蔽（移植自参考项目 daozai 的 src/mail_privacy.rs）。
 *
 * 纯函数，无 React 依赖，可在渲染层与主进程共用，也可用 node 原生 strip-types 单测。
 * 遮蔽只影响展示，从不声明验证码已失效（Display privacy only）。
 */

const SEPARATOR = '[\\s\\-\\uFF0D\\u200B\\u200C\\u200D\\uFEFF\\u2060]*';
const MASK = '••••••';

const GAP_CHARS = ',，:：.。';
const ALLOWED_GAPS = ['', '的', 'is', 'will', '该验证码', '此验证码', '验证码', 'this code is', '请于', '请在'];

// 同句中显式有效期：有效(时间/期)?(为/是)? [:：]? N (秒/分钟/小时) | valid for N unit | expires in N unit | N unit 内有效/后失效
const LIFETIME_RE =
  /(?:有效(?:时间|期)?(?:为|是)?\s*[:：]?\s*|valid\s+for\s+|expires?\s+in\s+)([0-9]{1,3})\s*(秒(?:钟)?|分钟|小时|seconds?|minutes?|hours?)|([0-9]{1,3})\s*(秒(?:钟)?|分钟|小时)\s*(?:内有效|后失效)/gi;

function trimBoth(s: string): string {
  let start = 0;
  while (start < s.length && (/\s/.test(s[start]) || GAP_CHARS.indexOf(s[start]) !== -1)) start++;
  let end = s.length;
  while (end > start && (/\s/.test(s[end - 1]) || GAP_CHARS.indexOf(s[end - 1]) !== -1)) end--;
  return s.slice(start, end);
}

/** 把文本中出现的验证码（含全角 / 零宽 / 分隔符变体）替换为 ••••••。 */
export function maskCode(text: string, code: string): string {
  if (!code) return text;
  const chars = [...code].filter((c) => /^[A-Za-z0-9]$/.test(c));
  const pattern = chars
    .map((c) => {
      const fw = String.fromCodePoint(c.codePointAt(0)! + 0xfee0);
      return `[${c}${fw}]`;
    })
    .join(SEPARATOR);
  if (!pattern) return text.split(code).join(MASK);
  try {
    return text.replace(new RegExp(pattern, 'gi'), MASK);
  } catch {
    return text.split(code).join(MASK);
  }
}

/**
 * 仅接受与验证码同一句、无歧义的显式相对有效期（秒/分钟/小时，≤3600）。
 * 绝对日期、泛化的登录/会话时长、冲突值、含混散文一律回退为 null。
 */
export function parseExplicitLifetime(subject: string, body: string, code: string): number | null {
  if (!code) return null;
  const values: number[] = [];
  const sentences: string[] = [];
  for (const part of [subject, body]) {
    for (const s of part.split(/[。!！\n;；]/)) sentences.push(s);
  }
  for (const sentence of sentences) {
    if ([...sentence].length > 240) continue;
    if (sentence.indexOf(code) === -1) continue;
    const lower = sentence.toLowerCase();
    if (
      sentence.indexOf('验证码') === -1 &&
      lower.indexOf('verification code') === -1 &&
      lower.indexOf('one-time') === -1 &&
      lower.indexOf('otp') === -1
    ) {
      continue;
    }
    LIFETIME_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LIFETIME_RE.exec(sentence)) !== null) {
      const start = m.index;
      const before = sentence.slice(0, start);
      const idx = before.lastIndexOf(code);
      if (idx === -1) continue;
      const codeEnd = idx + code.length;
      const gap = trimBoth(sentence.slice(codeEnd, start)).toLowerCase();
      if (ALLOWED_GAPS.indexOf(gap) === -1) return null;
      const n = parseInt(m[1] ?? m[3], 10);
      const unit = (m[2] ?? m[4]).toLowerCase();
      let multiplier = 1;
      if (unit.startsWith('分') || unit.startsWith('minute')) multiplier = 60;
      else if (unit.startsWith('小') || unit.startsWith('hour')) multiplier = 3600;
      const seconds = n * multiplier;
      if (seconds === 0 || seconds > 3600) return null;
      values.push(seconds);
    }
  }
  if (values.length === 0) return null;
  const first = values[0];
  return values.every((v) => v === first) ? first : null;
}
