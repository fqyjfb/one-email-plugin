// 三栏布局宽度管理：state + localStorage 持久化 + 鼠标拖动监听
// 参考 file-manager-plugin 的实现思路，将 state + listener 集中到 hook 内供多处复用

import { useCallback, useEffect, useRef, useState } from 'react';

export interface PanelWidths {
  sidebar: number;
  maillist: number;
}

export const DEFAULT_WIDTHS: PanelWidths = { sidebar: 220, maillist: 360 };

const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 480;
const MAILLIST_MIN = 240;
const MAILLIST_MAX = 720;
const STORAGE_KEY = 'toolbox.one-email.layout';

type PanelKey = keyof PanelWidths;

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/** 从 localStorage 读出合法宽度，缺字段或异常均回退默认 */
function loadWidths(): PanelWidths {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDTHS;
    const parsed = JSON.parse(raw) as Partial<PanelWidths>;
    return {
      sidebar:
        typeof parsed.sidebar === 'number'
          ? clamp(parsed.sidebar, SIDEBAR_MIN, SIDEBAR_MAX)
          : DEFAULT_WIDTHS.sidebar,
      maillist:
        typeof parsed.maillist === 'number'
          ? clamp(parsed.maillist, MAILLIST_MIN, MAILLIST_MAX)
          : DEFAULT_WIDTHS.maillist,
    };
  } catch {
    return DEFAULT_WIDTHS;
  }
}

/**
 * 三栏布局的拖拽宽度管理
 * @param containerRef 三栏容器的 ref（用于计算偏移起点）
 * @returns widths：当前两个面板的宽度；startDrag(panel)：给 splitter 绑定 onMouseDown
 */
export function useResizableWidths(containerRef: React.RefObject<HTMLElement | null>) {
  const [widths, setWidths] = useState<PanelWidths>(loadWidths);

  // 拖动用 ref 而非 state：避免每次 mousemove 触发 re-render，启动 mousedown 也无需走 setState
  const draggingRef = useRef<PanelKey | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // 持久化：write-back useEffect，localStorage 写入失败忽略（私密模式等）
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
    } catch {
      /* noop */
    }
  }, [widths]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const key = draggingRef.current;
      if (!key || !containerRef.current) return;
      const dx = e.clientX - startXRef.current;
      const start = startWidthRef.current;
      const min = key === 'sidebar' ? SIDEBAR_MIN : MAILLIST_MIN;
      const max = key === 'sidebar' ? SIDEBAR_MAX : MAILLIST_MAX;
      // 两个手柄均位于各自面板的右侧，方向一致：向右拖（dx > 0）→ 面板变宽
      const next = clamp(start + dx, min, max);
      setWidths((w) => (w[key] === next ? w : { ...w, [key]: next }));
    },
    [containerRef],
  );

  const handleMouseUp = useCallback(() => {
    draggingRef.current = null;
    document.body.style.cursor = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // 组件卸载兜底恢复 cursor
      document.body.style.cursor = '';
    };
  }, [handleMouseMove, handleMouseUp]);

  const startDrag = useCallback(
    (key: PanelKey) => (e: React.MouseEvent) => {
      draggingRef.current = key;
      startXRef.current = e.clientX;
      startWidthRef.current = widths[key];
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    },
    [widths],
  );

  return { widths, startDrag };
}
