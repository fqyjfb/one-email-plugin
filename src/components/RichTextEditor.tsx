import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  RemoveFormatting,
} from 'lucide-react';

interface RichTextEditorProps {
  html: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

// 富文本编辑器：contentEditable + 工具栏（基于 document.execCommand）
// 采用「非受控」方式：仅初始化时写入一次 innerHTML，之后以 onInput 回调 innerHTML，
// 避免受控 contentEditable 常见的光标跳动问题。
const RichTextEditor: React.FC<RichTextEditorProps> = ({
  html,
  onChange,
  placeholder = '在此输入邮件正文…',
  minHeight = 240,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(!html);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html) {
      ref.current.innerHTML = html;
      setIsEmpty(!html);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const text = el.innerText || '';
    setIsEmpty(!text.trim());
    onChange(el.innerHTML);
  }, [onChange]);

  const exec = useCallback(
    (cmd: string, value?: string) => {
      ref.current?.focus();
      document.execCommand(cmd, false, value);
      emit();
    },
    [emit],
  );

  const btnCls =
    'p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors';
  const mousedown = (cmd: string, value?: string) => (e: React.MouseEvent) => {
    e.preventDefault(); // 防止 contentEditable 失焦
    exec(cmd, value);
  };

  return (
    <div className="border border-input rounded-md overflow-hidden bg-background">
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border bg-muted/30">
        <button type="button" className={btnCls} title="加粗" onMouseDown={mousedown('bold')}>
          <Bold className="w-4 h-4" />
        </button>
        <button type="button" className={btnCls} title="斜体" onMouseDown={mousedown('italic')}>
          <Italic className="w-4 h-4" />
        </button>
        <button type="button" className={btnCls} title="下划线" onMouseDown={mousedown('underline')}>
          <Underline className="w-4 h-4" />
        </button>
        <button type="button" className={btnCls} title="删除线" onMouseDown={mousedown('strikeThrough')}>
          <Strikethrough className="w-4 h-4" />
        </button>
        <span className="w-px h-4 bg-border mx-1" />
        <button type="button" className={btnCls} title="无序列表" onMouseDown={mousedown('insertUnorderedList')}>
          <List className="w-4 h-4" />
        </button>
        <button type="button" className={btnCls} title="有序列表" onMouseDown={mousedown('insertOrderedList')}>
          <ListOrdered className="w-4 h-4" />
        </button>
        <button type="button" className={btnCls} title="引用" onMouseDown={mousedown('formatBlock', 'blockquote')}>
          <Quote className="w-4 h-4" />
        </button>
        <span className="w-px h-4 bg-border mx-1" />
        <button type="button" className={btnCls} title="清除格式" onMouseDown={mousedown('removeFormat')}>
          <RemoveFormatting className="w-4 h-4" />
        </button>
      </div>

      <div className="relative">
        {isEmpty && (
          <div className="absolute inset-0 px-3 py-2 text-sm text-muted-foreground pointer-events-none">
            {placeholder}
          </div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          className="px-3 py-2 text-sm leading-relaxed outline-none"
          style={{ minHeight }}
        />
      </div>
    </div>
  );
};

export default RichTextEditor;
