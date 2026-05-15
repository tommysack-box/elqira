import { useMemo, useRef, useState } from 'react';

type JsonCodeBlockProps = {
  raw: string;
  editable?: boolean;
  selectable?: boolean;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  errorOffsets?: number[];
  onScrollPositionChange?: (top: number) => void;
  showLineNumbers?: boolean;
  collapsible?: boolean;
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

function tryParseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
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

type ReadonlyLine = {
  id: string;
  lineNumber: number;
  toggle?: React.ReactNode;
  content: React.ReactNode;
  collapsedCopyId?: string;
  collapsedCopyText?: string;
};

function renderReadonlyLine(
  line: ReadonlyLine,
  showToggleGutter: boolean,
) {
  return (
    <div key={line.id} className="flex items-start" data-collapsed-copy-id={line.collapsedCopyId}>
      {showToggleGutter && (
        <span className="w-7 shrink-0 select-none pr-2 text-center leading-5">
          {line.toggle ?? <span className="inline-block h-4 w-4" aria-hidden="true" />}
        </span>
      )}
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-all [overflow-wrap:anywhere]">{line.content}</span>
    </div>
  );
}

function renderReadonlyFallbackLines(lines: string[]): ReadonlyLine[] {
  return lines.map((line, index): ReadonlyLine => ({
    id: `${index}-${line}`,
    lineNumber: index + 1,
    content: renderJsonLine(line, `${index}-${line}`),
  }));
}

function isContainerValue(value: unknown): value is Record<string, unknown> | unknown[] {
  return Boolean(value) && typeof value === 'object';
}

function renderJsonKey(keyName: string) {
  return <span style={{ color: '#2a14b4' }}>"{keyName}"</span>;
}

function renderPrimitiveToken(value: string) {
  return <span style={{ color: '#006b61', fontWeight: 700 }}>{value}</span>;
}

function stringifyPrimitive(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === null) return 'null';
  return String(value);
}

function countRenderedJsonLines(value: unknown): number {
  if (!isContainerValue(value)) return 1;
  if (Array.isArray(value)) {
    if (value.length === 0) return 1;
    return 2 + value.reduce<number>((total, entry) => total + countRenderedJsonLines(entry), 0);
  }

  const entries = Object.values(value as Record<string, unknown>);
  if (entries.length === 0) return 1;
  return 2 + entries.reduce<number>((total, entry) => total + countRenderedJsonLines(entry), 0);
}

function buildExpandedJsonText(
  value: unknown,
  indentLevel: number,
  trailingComma: boolean,
  propertyName?: string,
): string {
  const indent = '  '.repeat(indentLevel);
  const propertyPrefix = propertyName !== undefined ? `${JSON.stringify(propertyName)}: ` : '';

  if (!isContainerValue(value)) {
    const primitive = stringifyPrimitive(value);
    return `${indent}${propertyPrefix}${primitive}${trailingComma ? ',' : ''}`;
  }

  const isArray = Array.isArray(value);
  const entries = isArray
    ? value.map((entry, index) => [String(index), entry] as const)
    : Object.entries(value as Record<string, unknown>);
  const openChar = isArray ? '[' : '{';
  const closeChar = isArray ? ']' : '}';

  if (entries.length === 0) {
    return `${indent}${propertyPrefix}${openChar}${closeChar}${trailingComma ? ',' : ''}`;
  }

  const lines = [`${indent}${propertyPrefix}${openChar}`];
  entries.forEach(([entryKey, entryValue], index) => {
    lines.push(buildExpandedJsonText(
      entryValue,
      indentLevel + 1,
      index < entries.length - 1,
      isArray ? undefined : entryKey,
    ));
  });
  lines.push(`${indent}${closeChar}${trailingComma ? ',' : ''}`);
  return lines.join('\n');
}

function buildReadonlyJsonLines(
  value: unknown,
  collapsedPaths: Set<string>,
  togglePath: (path: string) => void,
  activeBracePath: string | null,
  setActiveBracePath: (path: string | null) => void,
) {
  let nextLineNumber = 1;

  const allocateLineNumber = () => {
    const current = nextLineNumber;
    nextLineNumber += 1;
    return current;
  };

  const renderReadonlyBrace = (char: string, path: string) => {
    const isActive = activeBracePath === path;
    return (
      <button
        type="button"
        onClick={() => setActiveBracePath(isActive ? null : path)}
        className={`rounded px-[1px] transition-colors ${
          isActive
            ? 'bg-[#2a14b4]/14 text-[#2a14b4]'
            : 'text-inherit hover:bg-[#eceef0]'
        }`}
        aria-label="Highlight matching JSON braces"
      >
        {char}
      </button>
    );
  };

  const renderToggleChevron = (expanded: boolean) => (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-90' : 'rotate-0'}`}
    >
      <path
        d="M4 2.5L8 6L4 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const buildValueLines = (
    currentValue: unknown,
    path: string,
    indentLevel: number,
    trailingComma: boolean,
    propertyName?: string,
  ): ReadonlyLine[] => {
    const indent = '  '.repeat(indentLevel);
    const separator = propertyName !== undefined ? ': ' : '';
    const linePrefix = (
      <>
        {indent}
        {propertyName !== undefined && (
          <>
            {renderJsonKey(propertyName)}
            {separator}
          </>
        )}
      </>
    );

    if (!isContainerValue(currentValue)) {
      return [{
        id: `${path}-primitive`,
        lineNumber: allocateLineNumber(),
        content: (
          <span>
            {linePrefix}
            {renderPrimitiveToken(stringifyPrimitive(currentValue))}
            {trailingComma ? ',' : ''}
          </span>
        ),
      }];
    }

    const isArray = Array.isArray(currentValue);
    const entries = isArray
      ? currentValue.map((entry, index) => [String(index), entry] as const)
      : Object.entries(currentValue as Record<string, unknown>);
    const openChar = isArray ? '[' : '{';
    const closeChar = isArray ? ']' : '}';
    const isCollapsed = collapsedPaths.has(path);
    const isEmpty = entries.length === 0;
    const toggleButton = !isEmpty && (
      <button
        type="button"
        onClick={() => togglePath(path)}
        className="inline-flex h-5 w-5 select-none items-center justify-center rounded border border-[#c7c4d7]/30 bg-[#f7f9fb] text-[12px] font-bold text-[#464554] shadow-sm hover:border-[#2a14b4]/30 hover:bg-[#eceef0] hover:text-[#191c1e]"
        aria-label={isCollapsed ? 'Expand JSON section' : 'Collapse JSON section'}
      >
        {renderToggleChevron(!isCollapsed)}
      </button>
    );

    if (isEmpty) {
      return [{
        id: `${path}-collapsed`,
        lineNumber: allocateLineNumber(),
        toggle: toggleButton,
        content: (
          <span>
            {linePrefix}
            {renderReadonlyBrace(openChar, path)}
            {!isEmpty && <span className="select-none text-[#777586]">...</span>}
            {renderReadonlyBrace(closeChar, path)}
            {trailingComma ? ',' : ''}
          </span>
        ),
      }];
    }

    if (isCollapsed) {
      const totalLines = countRenderedJsonLines(currentValue);
      const collapsedCopyId = path;
      const collapsedCopyText = buildExpandedJsonText(
        currentValue,
        indentLevel,
        trailingComma,
        propertyName,
      );
      const lines: ReadonlyLine[] = [{
        id: `${path}-collapsed-open`,
        lineNumber: allocateLineNumber(),
        toggle: toggleButton,
        collapsedCopyId,
        collapsedCopyText,
        content: (
          <span>
            {linePrefix}
            {renderReadonlyBrace(openChar, path)}
            <span className="select-none text-[#777586]"> ...</span>
          </span>
        ),
      }];
      nextLineNumber += Math.max(totalLines - 2, 0);

      lines.push({
        id: `${path}-collapsed-close`,
        lineNumber: allocateLineNumber(),
        collapsedCopyId,
        collapsedCopyText,
        content: (
          <span>
            {'  '.repeat(indentLevel)}
            {renderReadonlyBrace(closeChar, path)}
            {trailingComma ? ',' : ''}
          </span>
        ),
      });

      return lines;
    }

    const lines: ReadonlyLine[] = [{
      id: `${path}-open`,
      lineNumber: allocateLineNumber(),
      toggle: toggleButton,
      content: (
        <span>
          {linePrefix}
          {renderReadonlyBrace(openChar, path)}
        </span>
      ),
    }];

    entries.forEach(([entryKey, entryValue], index) => {
      const childPath = `${path}.${entryKey}`;
      lines.push(...buildValueLines(
        entryValue,
        childPath,
        indentLevel + 1,
        index < entries.length - 1,
        isArray ? undefined : entryKey,
      ));
    });

    lines.push({
      id: `${path}-close`,
      lineNumber: allocateLineNumber(),
      content: (
        <span>
          {'  '.repeat(indentLevel)}
          {renderReadonlyBrace(closeChar, path)}
          {trailingComma ? ',' : ''}
        </span>
      ),
    });

    return lines;
  };

  return buildValueLines(value, '$', 0, false);
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
  selectable = false,
  onChange,
  onBlur,
  className = '',
  errorOffsets = [],
  onScrollPositionChange,
  showLineNumbers = false,
  collapsible = false,
}: JsonCodeBlockProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeBraceOffset, setActiveBraceOffset] = useState<number | null>(null);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => new Set());
  const [activeReadonlyBracePath, setActiveReadonlyBracePath] = useState<string | null>(null);
  const formattedRaw = useMemo(
    () => (editable ? raw : formatJson(raw)),
    [editable, raw]
  );
  const parsedReadonlyValue = useMemo(
    () => (editable ? null : tryParseJson(raw)),
    [editable, raw]
  );
  const lines = useMemo(() => formattedRaw.split('\n'), [formattedRaw]);
  const toggleCollapsedPath = (path: string) => {
    setCollapsedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };
  const readonlyRenderedLines = useMemo(() => {
    if (editable) return [];
    if (parsedReadonlyValue !== null && collapsible) {
      return buildReadonlyJsonLines(
        parsedReadonlyValue,
        collapsedPaths,
        toggleCollapsedPath,
        activeReadonlyBracePath,
        setActiveReadonlyBracePath,
      );
    }
    return renderReadonlyFallbackLines(lines);
  }, [
    activeReadonlyBracePath,
    collapsedPaths,
    collapsible,
    editable,
    lines,
    parsedReadonlyValue,
  ]);
  const collapsedCopyLookup = useMemo(() => {
    const entries: Array<[string, string]> = readonlyRenderedLines
      .filter((line) => line.collapsedCopyId && line.collapsedCopyText)
      .map((line) => [line.collapsedCopyId as string, line.collapsedCopyText as string]);
    return new Map(entries);
  }, [readonlyRenderedLines]);
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
  const handleReadonlyCopy = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const selection = window.getSelection()?.toString() ?? '';
    if (selection.length > 0) {
      const selectedFragment = window.getSelection()?.rangeCount
        ? window.getSelection()?.getRangeAt(0).cloneContents()
        : null;
      const collapsedIds = selectedFragment
        ? Array.from(selectedFragment.querySelectorAll('[data-collapsed-copy-id]'))
            .map((node) => node.getAttribute('data-collapsed-copy-id'))
            .filter((value): value is string => Boolean(value))
        : [];

      if (collapsedIds.length === 0) return;

      const uniqueIds = Array.from(new Set(collapsedIds));
      const expandedBlocks = uniqueIds
        .map((id) => collapsedCopyLookup.get(id))
        .filter((value): value is string => Boolean(value));

      if (expandedBlocks.length === 0) return;

      event.preventDefault();
      event.clipboardData.setData('text/plain', expandedBlocks.join('\n'));
      return;
    }
    event.preventDefault();
    event.clipboardData.setData('text/plain', formattedRaw);
  };

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

  const preventEdit = (e: React.FormEvent) => e.preventDefault();

  return (
    <div
      className={`${className}${selectable ? ' cursor-text outline-none caret-[#191c1e] selection:bg-[#c3c0ff]/50' : ''}`}
      onCopy={handleReadonlyCopy}
      contentEditable={selectable || undefined}
      suppressContentEditableWarning={selectable || undefined}
      onBeforeInput={selectable ? preventEdit : undefined}
      onDrop={selectable ? preventEdit : undefined}
      onPaste={selectable ? preventEdit : undefined}
      spellCheck={selectable ? false : undefined}
    >
      {!editable && showLineNumbers ? (
        <div className="flex min-h-full min-w-0">
          <div className="w-10 shrink-0 select-none border-r border-[#c7c4d7]/10 pr-2 text-right font-mono text-[10px] leading-5 text-[#c7c4d7]">
            {readonlyRenderedLines.map((line) => (
              <div key={`${line.id}-number`}>{line.lineNumber}</div>
            ))}
          </div>
          <div className="min-w-0 flex-1 pl-4">
            <div className="max-w-full font-mono text-xs leading-5 text-[#464554]">
              {readonlyRenderedLines.map((line) => renderReadonlyLine(line, true))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="max-w-full font-mono text-xs leading-5 text-[#464554]">
            {readonlyRenderedLines.map((line) => renderReadonlyLine(line, parsedReadonlyValue !== null && collapsible))}
          </div>
        </>
      )}
    </div>
  );
}
