import type { QueryParam } from '../../types';

interface UrlParamEntry {
  id: string;
  key: string;
  value: string;
  occurrence: number;
  absoluteIndex: number;
}

function buildSensitiveUrlParamId(key: string, occurrence: number): string {
  return `${encodeURIComponent(key)}::${occurrence}`;
}

export function extractUrlParamEntries(url: string): UrlParamEntry[] | null {
  if (!url.trim()) return [];

  try {
    const parsed = new URL(url);
    const occurrences = new Map<string, number>();

    return Array.from(parsed.searchParams.entries()).map(([key, value], absoluteIndex) => {
      const occurrence = occurrences.get(key) ?? 0;
      occurrences.set(key, occurrence + 1);

      return {
        id: buildSensitiveUrlParamId(key, occurrence),
        key,
        value,
        occurrence,
        absoluteIndex,
      };
    });
  } catch {
    return null;
  }
}

export function reconcileSensitiveUrlParamIds(
  sensitiveUrlParamIds: string[] | undefined,
  urlParams: UrlParamEntry[] | null
): string[] {
  if (!sensitiveUrlParamIds || sensitiveUrlParamIds.length === 0 || urlParams === null) {
    return sensitiveUrlParamIds ?? [];
  }

  const validIds = new Set(urlParams.map((param) => param.id));
  return sensitiveUrlParamIds.filter((id) => validIds.has(id));
}

export function sanitizeSensitiveUrlParams(
  url: string | undefined,
  sensitiveUrlParamIds: string[] | undefined
): string | undefined {
  if (!url) return url;
  if (!sensitiveUrlParamIds || sensitiveUrlParamIds.length === 0) return url;

  try {
    const parsed = new URL(url);
    const sensitiveIds = new Set(sensitiveUrlParamIds);
    const occurrences = new Map<string, number>();
    const sanitizedParams = new URLSearchParams();

    Array.from(parsed.searchParams.entries()).forEach(([key, value]) => {
      const occurrence = occurrences.get(key) ?? 0;
      const id = buildSensitiveUrlParamId(key, occurrence);
      occurrences.set(key, occurrence + 1);
      sanitizedParams.append(key, sensitiveIds.has(id) ? '' : value);
    });

    const serialized = sanitizedParams.toString();
    parsed.search = serialized ? `?${serialized}` : '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function buildOccurrenceByIndex(params: QueryParam[]): number[] {
  const occurrences = new Map<string, number>();

  return params.map((param) => {
    const key = param.key.trim();
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    return occurrence;
  });
}

export function deriveSensitiveUrlParamIds(params: QueryParam[]): string[] {
  const occurrencesByIndex = buildOccurrenceByIndex(params);

  return params.flatMap((param, index) => {
    const key = param.key.trim();
    if (!key || !param.sensitive) return [];
    return [buildSensitiveUrlParamId(key, occurrencesByIndex[index])];
  });
}

export function syncParamsWithUrl(url: string, params: QueryParam[]): QueryParam[] {
  const urlParams = extractUrlParamEntries(url);
  if (urlParams === null) return params;

  const occurrencesByIndex = buildOccurrenceByIndex(params);
  const existingById = new Map(
    params
      .map((param, index) => {
        const key = param.key.trim();
        if (!key) return null;

        return {
          id: buildSensitiveUrlParamId(key, occurrencesByIndex[index]),
          param,
        };
      })
      .filter((entry): entry is { id: string; param: QueryParam } => Boolean(entry))
      .map((entry) => [entry.id, entry.param])
  );

  return urlParams.map((param) => {
    const existing = existingById.get(param.id);
    return {
      key: param.key,
      value: param.value,
      enabled: existing?.enabled ?? true,
      sensitive: existing?.sensitive ?? false,
    };
  });
}

export function syncUrlWithParams(url: string, params: QueryParam[]): string {
  if (!url.trim()) return url;

  try {
    const parsed = new URL(url);
    const nextSearchParams = new URLSearchParams();

    params
      .filter((param) => param.enabled && param.key.trim())
      .forEach((param) => {
        nextSearchParams.append(param.key.trim(), param.value);
      });

    const serialized = nextSearchParams.toString();
    parsed.search = serialized ? `?${serialized}` : '';
    return parsed.toString();
  } catch {
    return url;
  }
}
