// 邮件翻译服务 - 复用 ToolBox 工具中心「在线翻译」同一公共 API（60s）
// 桌面端直连（接口已返回 Access-Control-Allow-Origin: *），主源失败自动切换备源，
// 主备地址与 ToolBox/src/services/baseApi.ts 的默认值保持一致

const PRIMARY_URL = 'https://60s.fqy-jfb.workers.dev/v2';
const FALLBACK_URL = 'https://60s.viki.moe/v2';

const REQUEST_TIMEOUT = 15000;
// 单段最大字符数：GET 请求 URL 长度保护，按段落切分，超长段落硬切
const CHUNK_LIMIT = 3000;

interface TranslateResponse {
  code: number;
  message: string;
  data?: { target: { text: string } };
}

export interface TranslateLanguage {
  code: string;
  label: string;
}

// 目标语言选项；auto 由接口判定：源语言为中文则译英文，否则译中文（即默认中英互译）
export const TRANSLATE_LANGUAGES: TranslateLanguage[] = [
  { code: 'auto', label: '中英互译（自动）' },
  { code: 'en', label: '英语' },
  { code: 'zh-CHS', label: '中文（简体）' },
  { code: 'zh-CHT', label: '中文（繁体）' },
  { code: 'ja', label: '日语' },
  { code: 'ko', label: '韩语' },
  { code: 'fr', label: '法语' },
  { code: 'de', label: '德语' },
  { code: 'ru', label: '俄语' },
  { code: 'es', label: '西班牙语' },
  { code: 'pt', label: '葡萄牙语' },
  { code: 'it', label: '意大利语' },
  { code: 'ar', label: '阿拉伯语' },
  { code: 'th', label: '泰语' },
  { code: 'vi', label: '越南语' },
  { code: 'id', label: '印度尼西亚语' },
  { code: 'hi', label: '印地语' },
  { code: 'tr', label: '土耳其语' },
];

async function fetchOnce(baseUrl: string, text: string, to: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const query = `text=${encodeURIComponent(text)}&from=auto&to=${encodeURIComponent(to)}`;
    const res = await fetch(`${baseUrl}/fanyi?${query}`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`翻译服务异常（${res.status}）`);
    const data = (await res.json()) as TranslateResponse;
    if (data.code !== 200 || !data.data) throw new Error(data.message || '翻译失败');
    return data.data.target.text;
  } finally {
    clearTimeout(timer);
  }
}

/** 调单个源，失败后由上层切备源 */
async function requestWithFallback(text: string, to: string): Promise<string> {
  try {
    return await fetchOnce(PRIMARY_URL, text, to);
  } catch (primaryErr) {
    try {
      return await fetchOnce(FALLBACK_URL, text, to);
    } catch {
      throw primaryErr instanceof Error ? primaryErr : new Error('翻译失败');
    }
  }
}

/** 按段落聚合切分，尽量不切断句子；超长段落硬切 */
function splitChunks(text: string): string[] {
  if (text.length <= CHUNK_LIMIT) return [text];
  const chunks: string[] = [];
  let buffer = '';
  const push = (s: string) => {
    if (s) chunks.push(s);
  };
  for (const paragraph of text.split('\n')) {
    if (paragraph.length > CHUNK_LIMIT) {
      if (buffer) {
        push(buffer);
        buffer = '';
      }
      for (let i = 0; i < paragraph.length; i += CHUNK_LIMIT) {
        push(paragraph.slice(i, i + CHUNK_LIMIT));
      }
      continue;
    }
    if (buffer.length + paragraph.length + 1 > CHUNK_LIMIT) {
      push(buffer);
      buffer = paragraph;
    } else {
      buffer = buffer ? `${buffer}\n${paragraph}` : paragraph;
    }
  }
  push(buffer);
  return chunks;
}

/**
 * 翻译文本（源语言自动检测）。长文自动分段逐段翻译后按换行拼接。
 * @param to 目标语言代码，默认 auto（中英互译）
 */
export async function translateText(text: string, to: string = 'auto'): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const chunks = splitChunks(trimmed);
  const results: string[] = [];
  for (const chunk of chunks) {
    results.push(await requestWithFallback(chunk, to));
  }
  return results.join('\n');
}
