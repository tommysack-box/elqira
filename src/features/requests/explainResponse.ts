import type { Request, Response } from '../../types';
import { translations } from '../../i18n/translations';
import type { Language } from '../../types';

export interface ExplainMetric {
  label: string;
  value: string;
  tone: 'good' | 'neutral' | 'warning';
  icon?: string;
}

export interface ExplainHighlight {
  label: string;
  badge: string;
  description: string;
}

export interface ExplainResponseResult {
  summary: string;
  statusSemantic: ExplainMetric;
  latencyTier: ExplainMetric;
  highlights: ExplainHighlight[];
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function tr(language: Language) {
  return translations[language];
}

function getLatencyMetric(duration: number, language: Language): ExplainMetric {
  const t = tr(language);
  if (duration <= 50) return { label: t.latencyTierLabel, value: `${duration}ms (${t.latencyOptimal})`, tone: 'good', icon: 'speed' };
  if (duration <= 250) return { label: t.latencyTierLabel, value: `${duration}ms (${t.latencyStable})`, tone: 'neutral', icon: 'speed' };
  return { label: t.latencyTierLabel, value: `${duration}ms (${t.latencySlow})`, tone: 'warning', icon: 'schedule' };
}

function getStatusMetric(response: Response, language: Language): ExplainMetric {
  const t = tr(language);
  if (response.statusCode >= 200 && response.statusCode < 300) {
    return { label: t.statusSemanticLabel, value: t.healthyResponse, tone: 'good' };
  }
  if (response.statusCode >= 400) {
    return { label: t.statusSemanticLabel, value: t.requestFailed, tone: 'warning' };
  }
  return { label: t.statusSemanticLabel, value: t.unexpectedState, tone: 'neutral' };
}

function describeValue(path: string, value: unknown, language: Language): ExplainHighlight {
  const isItalian = language === 'it';
  if (Array.isArray(value)) {
    return {
      label: path,
      badge: tr(language).badgeList,
      description: value.length === 0
        ? isItalian ? 'Questo array è presente ma al momento è vuoto.' : 'This array is present but currently empty.'
        : isItalian
          ? `Questo array contiene ${value.length} element${value.length === 1 ? 'o' : 'i'}, che probabilmente rappresentano record correlati restituiti dalla API.`
          : `This array contains ${value.length} item${value.length === 1 ? '' : 's'}, which likely represent related records returned by the API.`,
    };
  }

  if (value !== null && typeof value === 'object') {
    const size = Object.keys(value as Record<string, unknown>).length;
    return {
      label: path,
      badge: tr(language).badgeObject,
      description: isItalian
        ? `Questo oggetto raggruppa ${size} camp${size === 1 ? 'o' : 'i'} che appartengono alla stessa sezione della risposta.`
        : `This object groups ${size} field${size === 1 ? '' : 's'} that belong to the same response section.`,
    };
  }

  if (typeof value === 'boolean') {
    return {
      label: path,
      badge: tr(language).badgeBoolean,
      description: isItalian
        ? `Questo flag è attualmente ${value ? 'attivo' : 'disattivo'}, quindi funziona come interruttore di stato nella risposta.`
        : `This flag is currently ${value ? 'enabled' : 'disabled'}, so it acts as a state switch in the response.`,
    };
  }

  if (typeof value === 'number') {
    return {
      label: path,
      badge: tr(language).badgeNumber,
      description: isItalian
        ? `Questo valore numerico è ${value}. Probabilmente rappresenta limiti, saldi, contatori o altri stati misurabili.`
        : `This numeric value is ${value}. It likely drives limits, balances, counters, or other measurable state.`,
    };
  }

  return {
    label: path,
    badge: tr(language).badgeValue,
    description: isItalian
      ? `Questo campo vale attualmente "${String(value)}", e probabilmente rappresenta uno stato semantico o un identificatore restituito dalla API.`
      : `This field currently resolves to "${String(value)}", which is likely a semantic status or identifier returned by the API.`,
  };
}

function collectHighlights(data: unknown, language: Language, prefix = ''): ExplainHighlight[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];

  const entries = Object.entries(data as Record<string, unknown>);
  const direct = entries.slice(0, 2).map(([key, value]) => describeValue(`${prefix}${key}`, value, language));

  const nestedEntry = entries.find(([, value]) => value && typeof value === 'object');
  if (!nestedEntry) return direct;

  const [nestedKey, nestedValue] = nestedEntry;
  if (Array.isArray(nestedValue)) return [...direct, describeValue(`${prefix}${nestedKey}`, nestedValue, language)].slice(0, 3);

  return [...direct, ...collectHighlights(nestedValue, language, `${prefix}${nestedKey}.`)].slice(0, 3);
}

function buildSummary(request: Request | null, response: Response, body: unknown, language: Language): string {
  const requestLabel = request?.title ?? `${response.statusCode} response`;
  const isItalian = language === 'it';

  if (response.statusCode === 0) {
    return isItalian
      ? `La richiesta "${requestLabel}" non ha restituito una risposta HTTP valida. Il payload corrente rappresenta un errore di rete o di esecuzione, non dati di business.`
      : `The request "${requestLabel}" did not return a valid HTTP response. The current payload represents a network or execution error rather than business data.`;
  }

  if (response.statusCode >= 200 && response.statusCode < 300) {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const keys = Object.keys(body as Record<string, unknown>).slice(0, 3);
      if (keys.length > 0) {
        return isItalian
          ? `La richiesta "${requestLabel}" è stata completata con successo. La risposta restituisce dati strutturati incentrati su ${keys.join(', ')}, il che suggerisce che la API stia fornendo stato applicativo utile e non un semplice acknowledgement.`
          : `The request "${requestLabel}" completed successfully. The response returns structured data centered on ${keys.join(', ')}, which suggests the API is providing usable application state rather than a minimal acknowledgement.`;
      }
    }

    return isItalian
      ? `La richiesta "${requestLabel}" è stata completata con successo e la API ha restituito un body valido. Questo indica che il flusso corrente sta funzionando correttamente dal punto di vista del trasporto.`
      : `The request "${requestLabel}" completed successfully and the API returned a valid response body. This indicates the current flow is working as expected from the transport perspective.`;
  }

  return isItalian
    ? `La richiesta "${requestLabel}" ha restituito HTTP ${response.statusCode} ${response.statusText}. Questo significa che il server ha risposto, ma il payload corrente va interpretato come errore o esito di validazione, non come risultato di business riuscito.`
    : `The request "${requestLabel}" returned HTTP ${response.statusCode} ${response.statusText}. This means the server answered, but the current payload should be interpreted as an error or validation outcome rather than a successful business result.`;
}

export function explainResponse(request: Request | null, response: Response, language: Language = 'en'): ExplainResponseResult {
  const body = parseJson(response.body);

  return {
    summary: buildSummary(request, response, body, language),
    statusSemantic: getStatusMetric(response, language),
    latencyTier: getLatencyMetric(response.duration, language),
    highlights: collectHighlights(body, language).slice(0, 3),
  };
}
