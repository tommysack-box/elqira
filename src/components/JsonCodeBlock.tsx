import { useRef } from 'react';

type JsonCodeBlockProps = {
  raw: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  className?: string;
};

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
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
      <span key={key} style={{ color: 'var(--color-green-500)', fontWeight: 700 }}>
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
    ? { color: 'var(--color-green-500)', fontWeight: 700 }
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

export function getJsonLineCount(raw: string): number {
  return formatJson(raw).split('\n').length;
}

export function JsonCodeBlock({ raw, editable = false, onChange, onBlur, className = '' }: JsonCodeBlockProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const formatted = formatJson(raw);
  const lines = formatted.split('\n');

  const syncScroll = (top: number, left: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = top;
    scrollRef.current.scrollLeft = left;
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
            {lines.map((line, index) => (
              <div key={`${index}-${line}`}>{renderJsonLine(line, `${index}-${line}`)}</div>
            ))}
          </pre>
        </div>
        <textarea
          value={raw}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onBlur}
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
