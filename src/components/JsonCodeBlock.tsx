import { useMemo, useRef, useState } from 'react';

type JsonCodeBlockProps = {
  raw: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  errorOffsets?: number[];
  onScrollPositionChange?: (top: number) => void;
};

export type JsonValidationIssue = {
  message: string;
  offset: number;
};

type TokenType =
  | '{'
  | '}'
  | '['
  | ']'
  | ':'
  | ','
  | 'string'
  | 'number'
  | 'true'
  | 'false'
  | 'null';

type Token = {
  type: TokenType;
  offset: number;
  end: number;
};

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function isDigit(char: string) {
  return char >= '0' && char <= '9';
}

function tokenizeJson(raw: string, issues: JsonValidationIssue[]): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < raw.length) {
    const char = raw[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if ('{}[]:,'.includes(char)) {
      tokens.push({ type: char as TokenType, offset: index, end: index + 1 });
      index += 1;
      continue;
    }

    if (char === '"') {
      const start = index;
      index += 1;
      let closed = false;

      while (index < raw.length) {
        const current = raw[index];

        if (current === '\\') {
          index += 2;
          continue;
        }

        if (current === '"') {
          closed = true;
          index += 1;
          break;
        }

        if (current === '\n' || current === '\r') {
          break;
        }

        index += 1;
      }

      if (!closed) {
        issues.push({ message: 'Unterminated string', offset: start });
      }

      tokens.push({ type: 'string', offset: start, end: index });
      continue;
    }

    if (char === '-' || isDigit(char)) {
      const start = index;
      if (char === '-') index += 1;

      while (index < raw.length && isDigit(raw[index])) index += 1;
      if (raw[index] === '.') {
        index += 1;
        while (index < raw.length && isDigit(raw[index])) index += 1;
      }
      if (raw[index] === 'e' || raw[index] === 'E') {
        index += 1;
        if (raw[index] === '+' || raw[index] === '-') index += 1;
        while (index < raw.length && isDigit(raw[index])) index += 1;
      }

      tokens.push({ type: 'number', offset: start, end: index });
      continue;
    }

    if (raw.startsWith('true', index)) {
      tokens.push({ type: 'true', offset: index, end: index + 4 });
      index += 4;
      continue;
    }

    if (raw.startsWith('false', index)) {
      tokens.push({ type: 'false', offset: index, end: index + 5 });
      index += 5;
      continue;
    }

    if (raw.startsWith('null', index)) {
      tokens.push({ type: 'null', offset: index, end: index + 4 });
      index += 4;
      continue;
    }

    issues.push({ message: `Unexpected character "${char}"`, offset: index });
    index += 1;
  }

  return tokens;
}

function uniqueIssues(issues: JsonValidationIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.offset}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getJsonValidationIssues(raw: string): JsonValidationIssue[] {
  if (raw.trim().length === 0) return [];

  const issues: JsonValidationIssue[] = [];
  const tokens = tokenizeJson(raw, issues);
  let cursor = 0;

  const current = () => tokens[cursor];
  const advance = () => {
    cursor += 1;
  };
  const atEnd = () => cursor >= tokens.length;
  const isValueToken = (token?: Token) => Boolean(token && ['{', '[', 'string', 'number', 'true', 'false', 'null'].includes(token.type));

  const parseValue = (): void => {
    const token = current();

    if (!token) {
      issues.push({ message: 'Expected a value', offset: raw.length > 0 ? raw.length - 1 : 0 });
      return;
    }

    if (token.type === '{') {
      parseObject();
      return;
    }

    if (token.type === '[') {
      parseArray();
      return;
    }

    if (['string', 'number', 'true', 'false', 'null'].includes(token.type)) {
      advance();
      return;
    }

    issues.push({ message: 'Expected a value', offset: token.offset });
    advance();
  };

  const parseObject = (): void => {
    const open = current();
    advance();

    if (current()?.type === '}') {
      advance();
      return;
    }

    while (!atEnd()) {
      const keyToken = current();
      if (!keyToken) break;

      if (keyToken.type !== 'string') {
        if (keyToken.type === '}') {
          advance();
          return;
        }

        issues.push({ message: 'Expected a property name', offset: keyToken.offset });
        advance();
        continue;
      }

      advance();

      if (current()?.type !== ':') {
        const nextToken = current();
        const between = raw.slice(keyToken.end, nextToken?.offset ?? keyToken.end).trim();
        if (between.length === 0) {
          issues.push({ message: 'Missing colon after property name', offset: nextToken?.offset ?? keyToken.offset });
        }
      } else {
        advance();
      }

      parseValue();

      if (current()?.type === ',') {
        const commaToken = current()!;
        advance();

        if (current()?.type === '}') {
          issues.push({ message: 'Trailing comma in object', offset: commaToken.offset });
          advance();
          return;
        }

        continue;
      }

      if (current()?.type === '}') {
        advance();
        return;
      }

      if (!atEnd()) {
        issues.push({ message: 'Missing comma between properties', offset: current()!.offset });
        continue;
      }
    }

    issues.push({ message: 'Missing closing brace', offset: open?.offset ?? 0 });
  };

  const parseArray = (): void => {
    const open = current();
    advance();

    if (current()?.type === ']') {
      advance();
      return;
    }

    while (!atEnd()) {
      parseValue();

      if (current()?.type === ',') {
        const commaToken = current()!;
        advance();

        if (current()?.type === ']') {
          issues.push({ message: 'Trailing comma in array', offset: commaToken.offset });
          advance();
          return;
        }

        continue;
      }

      if (current()?.type === ']') {
        advance();
        return;
      }

      if (!atEnd()) {
        issues.push({ message: 'Missing comma between array items', offset: current()!.offset });
        if (!isValueToken(current())) {
          advance();
        }
        continue;
      }
    }

    issues.push({ message: 'Missing closing bracket', offset: open?.offset ?? 0 });
  };

  parseValue();

  while (!atEnd()) {
    issues.push({ message: 'Unexpected trailing token', offset: current()!.offset });
    advance();
  }

  return uniqueIssues(issues);
}

function isJsonPrimitive(value: string): boolean {
  return /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value) || value === 'true' || value === 'false' || value === 'null';
}

function renderStandaloneValue(line: string, key: string) {
  const trimmed = line.trim();
  if (trimmed.length === 0) return <span key={key}>&nbsp;</span>;

  if ((trimmed.startsWith('"') && (trimmed.endsWith('"') || trimmed.endsWith('",')))
    || isJsonPrimitive(trimmed.replace(/,$/, ''))) {
    return (
      <span key={key} style={{ color: '#006b61', fontWeight: 700 }}>
        {line}
      </span>
    );
  }

  return <span key={key}>{line}</span>;
}

function renderJsonLine(line: string, key: string) {
  const match = line.match(/^(\s*)"([^"\\]*(?:\\.[^"\\]*)*)"(\s*:\s*)(.*)$/);
  if (!match) {
    return renderStandaloneValue(line, key);
  }

  const [, indent, propName, separator, rawValue] = match;
  const valueWithoutComma = rawValue.replace(/,$/, '');
  const hasTrailingComma = rawValue.endsWith(',');
  const isStringValue = valueWithoutComma.startsWith('"') && valueWithoutComma.endsWith('"');
  const isPrimitiveValue = isJsonPrimitive(valueWithoutComma);
  const valueStyle = isStringValue || isPrimitiveValue
    ? { color: '#006b61', fontWeight: 700 }
    : undefined;

  return (
    <span key={key}>
      {indent}
      <span style={{ color: '#2a14b4' }}>"{propName}"</span>
      {separator}
      <span style={valueStyle}>{valueWithoutComma}</span>
      {hasTrailingComma && <span style={valueStyle}>,</span>}
    </span>
  );
}

function findMatchingBrace(raw: string, offset: number | null): number[] {
  if (offset === null || offset < 0 || offset >= raw.length) return [];

  const char = raw[offset];
  const pairs: Record<string, string> = { '{': '}', '}': '{', '[': ']', ']': '[' };
  if (!(char in pairs)) return [];

  const isOpening = char === '{' || char === '[';
  const target = pairs[char];
  let depth = 0;

  if (isOpening) {
    for (let index = offset; index < raw.length; index += 1) {
      const current = raw[index];
      if (current === char) depth += 1;
      if (current === target) {
        depth -= 1;
        if (depth === 0) return [offset, index];
      }
    }
    return [offset];
  }

  for (let index = offset; index >= 0; index -= 1) {
    const current = raw[index];
    if (current === char) depth += 1;
    if (current === target) {
      depth -= 1;
      if (depth === 0) return [index, offset];
    }
  }

  return [offset];
}

function renderErrorHighlight(char: string, key: string) {
  return (
    <span
      key={key}
      style={{
        backgroundColor: 'rgba(186, 26, 26, 0.08)',
        color: '#ba1a1a',
        fontWeight: 700,
      }}
    >
      {char === ' ' ? '\u00a0' : char}
    </span>
  );
}

function renderBraceHighlight(char: string, key: string) {
  return (
    <span
      key={key}
      style={{
        backgroundColor: 'rgba(42, 20, 180, 0.12)',
        color: '#2a14b4',
        fontWeight: 700,
        borderRadius: '2px',
      }}
    >
      {char}
    </span>
  );
}

function renderEditableLine(line: string, startOffset: number, errorOffsets: Set<number>, braceOffsets: number[], key: string) {
  const relativeOffsets: number[] = [];
  for (const offset of errorOffsets) {
    if (offset >= startOffset && offset <= startOffset + line.length) {
      relativeOffsets.push(Math.min(Math.max(offset - startOffset, 0), line.length));
    }
  }
  const relativeBraceOffsets = braceOffsets
    .filter((offset) => offset >= startOffset && offset < startOffset + line.length)
    .map((offset) => offset - startOffset);

  if (relativeOffsets.length === 0 && relativeBraceOffsets.length === 0) {
    return renderJsonLine(line, key);
  }

  const errorHighlighted = new Set(relativeOffsets);
  const braceHighlighted = new Set(relativeBraceOffsets);
  const fragments: React.ReactNode[] = [];
  let segmentStart = 0;

  for (let index = 0; index <= line.length; index += 1) {
    const isError = errorHighlighted.has(index);
    const isBrace = braceHighlighted.has(index);
    const isHighlighted = isError || isBrace;

    if (isHighlighted && segmentStart < index) {
      fragments.push(renderJsonLine(line.slice(segmentStart, index), `${key}-segment-${segmentStart}`));
    }

    if (isHighlighted) {
      const char = index < line.length ? line[index] : ' ';
      fragments.push(
        isError
          ? renderErrorHighlight(char, `${key}-error-${index}`)
          : renderBraceHighlight(char, `${key}-brace-${index}`)
      );
      segmentStart = index + 1;
    }
  }

  if (segmentStart < line.length) {
    fragments.push(renderJsonLine(line.slice(segmentStart), `${key}-tail`));
  }

  return <span key={key}>{fragments}</span>;
}

export function getJsonLineCount(raw: string): number {
  return raw.split('\n').length;
}

export function JsonCodeBlock({
  raw,
  editable = false,
  onChange,
  onBlur,
  className = '',
  errorOffsets = [],
  onScrollPositionChange,
}: JsonCodeBlockProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeBraceOffset, setActiveBraceOffset] = useState<number | null>(null);
  const lines = useMemo(
    () => (editable ? raw.split('\n') : formatJson(raw).split('\n')),
    [editable, raw]
  );
  const lineStartOffsets = useMemo(() => {
    const offsets = new Array<number>(lines.length);
    let currentOffset = 0;

    for (let index = 0; index < lines.length; index += 1) {
      offsets[index] = currentOffset;
      currentOffset += lines[index].length + 1;
    }

    return offsets;
  }, [lines]);
  const errorOffsetSet = useMemo(() => new Set(errorOffsets), [errorOffsets]);
  const braceOffsets = useMemo(
    () => (editable ? findMatchingBrace(raw, activeBraceOffset) : []),
    [editable, raw, activeBraceOffset]
  );

  const syncScroll = (top: number, left: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = top;
    scrollRef.current.scrollLeft = left;
    onScrollPositionChange?.(top);
  };

  const syncBraceSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const caret = textarea.selectionStart;
    const direct = caret < raw.length ? raw[caret] : '';
    const previous = caret > 0 ? raw[caret - 1] : '';

    if ('{}[]'.includes(direct)) {
      setActiveBraceOffset(caret);
      return;
    }

    if ('{}[]'.includes(previous)) {
      setActiveBraceOffset(caret - 1);
      return;
    }

    setActiveBraceOffset(null);
  };

  const applyEdit = (
    nextValue: string,
    nextSelectionStart: number,
    nextSelectionEnd: number,
  ) => {
    onChange?.(nextValue);
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.selectionStart = nextSelectionStart;
      textareaRef.current.selectionEnd = nextSelectionEnd;
      syncBraceSelection();
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;

    const textarea = event.currentTarget;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const hasSelection = selectionStart !== selectionEnd;
    const selectedText = raw.slice(selectionStart, selectionEnd);
    const nextChar = raw[selectionEnd] ?? '';

    const wrapSelection = (open: string, close: string) => {
      event.preventDefault();
      const nextValue = `${raw.slice(0, selectionStart)}${open}${selectedText}${close}${raw.slice(selectionEnd)}`;
      applyEdit(nextValue, selectionStart + 1, selectionEnd + 1);
    };

    const insertPair = (open: string, close: string) => {
      event.preventDefault();
      const nextValue = `${raw.slice(0, selectionStart)}${open}${close}${raw.slice(selectionEnd)}`;
      applyEdit(nextValue, selectionStart + 1, selectionStart + 1);
    };

    if (event.key === '"' || event.key === '{' || event.key === '[') {
      if (hasSelection) {
        const close = event.key === '"' ? '"' : event.key === '{' ? '}' : ']';
        wrapSelection(event.key, close);
        return;
      }

      if (event.key === '"' && nextChar === '"') {
        event.preventDefault();
        applyEdit(raw, selectionStart + 1, selectionStart + 1);
        return;
      }

      if (event.key === '{') {
        insertPair('{', '}');
        return;
      }

      if (event.key === '[') {
        insertPair('[', ']');
        return;
      }

      insertPair('"', '"');
      return;
    }

    if ((event.key === '}' || event.key === ']' || event.key === '"') && !hasSelection && nextChar === event.key) {
      event.preventDefault();
      applyEdit(raw, selectionStart + 1, selectionStart + 1);
      return;
    }

    if (event.key !== 'Tab') return;

    event.preventDefault();

    if (!hasSelection) {
      const nextValue = `${raw.slice(0, selectionStart)}  ${raw.slice(selectionEnd)}`;
      applyEdit(nextValue, selectionStart + 2, selectionStart + 2);
      return;
    }

    const lineStart = raw.lastIndexOf('\n', selectionStart - 1) + 1;
    const lineEnd = raw.indexOf('\n', selectionEnd);
    const safeLineEnd = lineEnd === -1 ? raw.length : lineEnd;
    const selectedBlock = raw.slice(lineStart, safeLineEnd);
    const linesToIndent = selectedBlock.split('\n');

    let nextBlock = '';
    let nextSelectionStart = selectionStart;
    let nextSelectionEnd = selectionEnd;

    if (event.shiftKey) {
      let removedBeforeSelectionStart = 0;
      let removedTotal = 0;
      nextBlock = linesToIndent.map((line, index) => {
        if (line.startsWith('  ')) {
          if (index === 0) removedBeforeSelectionStart = 2;
          removedTotal += 2;
          return line.slice(2);
        }
        if (line.startsWith(' ')) {
          if (index === 0) removedBeforeSelectionStart = 1;
          removedTotal += 1;
          return line.slice(1);
        }
        return line;
      }).join('\n');
      nextSelectionStart = Math.max(lineStart, selectionStart - removedBeforeSelectionStart);
      nextSelectionEnd = Math.max(nextSelectionStart, selectionEnd - removedTotal);
    } else {
      nextBlock = linesToIndent.map((line) => `  ${line}`).join('\n');
      nextSelectionStart = selectionStart + 2;
      nextSelectionEnd = selectionEnd + (2 * linesToIndent.length);
    }

    const nextValue = `${raw.slice(0, lineStart)}${nextBlock}${raw.slice(safeLineEnd)}`;
    applyEdit(nextValue, nextSelectionStart, nextSelectionEnd);
  };

  if (editable) {
    return (
      <div className={`relative h-full ${className}`}>
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-auto p-4 pointer-events-none"
          aria-hidden="true"
        >
          <pre className="font-mono text-xs leading-5 whitespace-pre-wrap break-all [overflow-wrap:anywhere] text-[#464554]">
            {lines.map((line, index) => {
              return (
                <div key={`${index}-${line}`}>
                  {renderEditableLine(line, lineStartOffsets[index], errorOffsetSet, braceOffsets, `${index}-${line}`)}
                </div>
              );
            })}
          </pre>
        </div>
        <textarea
          ref={textareaRef}
          value={raw}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onBlur}
          onClick={syncBraceSelection}
          onKeyUp={syncBraceSelection}
          onKeyDown={handleKeyDown}
          onScroll={(e) => syncScroll(e.currentTarget.scrollTop, e.currentTarget.scrollLeft)}
          className="absolute inset-0 w-full h-full resize-none overflow-auto bg-transparent p-4 font-mono text-xs leading-5 text-transparent caret-[#191c1e] outline-none selection:bg-[#c3c0ff]/50"
          spellCheck={false}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <pre className="max-w-full font-mono text-xs leading-5 text-[#464554] whitespace-pre-wrap break-all [overflow-wrap:anywhere]">
        {lines.map((line, index) => (
          <div key={`${index}-${line}`}>{renderJsonLine(line, `${index}-${line}`)}</div>
        ))}
      </pre>
    </div>
  );
}
