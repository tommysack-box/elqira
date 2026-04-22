import type { Request, Response } from '../../types';
import type { Language } from '../../types';

export interface DebugRootCause {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

interface DebugFix {
  description: string;
}

export interface DebugResponseResult {
  summary: string;
  rootCauses: DebugRootCause[];
  suggestedFixes: DebugFix[];
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildDebugSummary(request: Request | null, response: Response, language: Language): string {
  const requestLabel = request?.title ?? 'request';
  const isItalian = language === 'it';

  if (response.statusCode === 0) {
    return isItalian
      ? `La richiesta "${requestLabel}" non ha ricevuto risposta dal server. Ciò indica un errore di rete, un timeout o un host non raggiungibile.`
      : `The request "${requestLabel}" received no response from the server. This indicates a network error, timeout, or unreachable host.`;
  }

  if (response.statusCode >= 500) {
    return isItalian
      ? `La richiesta "${requestLabel}" ha restituito un errore server HTTP ${response.statusCode} ${response.statusText}. Il server ha ricevuto la richiesta ma ha incontrato un problema interno durante l'elaborazione.`
      : `The request "${requestLabel}" returned a server error HTTP ${response.statusCode} ${response.statusText}. The server received the request but encountered an internal problem during processing.`;
  }

  if (response.statusCode >= 400) {
    return isItalian
      ? `La richiesta "${requestLabel}" ha restituito HTTP ${response.statusCode} ${response.statusText}. Il server ha rifiutato la richiesta per problemi rilevabili lato client come autenticazione, autorizzazione, validazione o risorsa non trovata.`
      : `The request "${requestLabel}" returned HTTP ${response.statusCode} ${response.statusText}. The server rejected the request due to client-detectable issues such as authentication, authorization, validation, or missing resource.`;
  }

  return isItalian
    ? `La richiesta "${requestLabel}" ha restituito HTTP ${response.statusCode} ${response.statusText}.`
    : `The request "${requestLabel}" returned HTTP ${response.statusCode} ${response.statusText}.`;
}

function getRootCausesForStatus(
  statusCode: number,
  body: unknown,
  language: Language
): DebugRootCause[] {
  const isItalian = language === 'it';

  if (statusCode === 0) {
    return [
      {
        title: isItalian ? 'Errore di rete o host non raggiungibile' : 'Network error or unreachable host',
        description: isItalian
          ? 'Il client non ha ricevuto nessuna risposta. Possibili cause: il server è offline, il dominio non è risolvibile o una policy CORS blocca la risposta in-browser.'
          : 'The client received no response at all. Possible causes: the server is offline, the domain is unresolvable, or a browser CORS policy is blocking the response.',
        severity: 'high',
      },
      {
        title: isItalian ? 'Timeout della connessione' : 'Connection timeout',
        description: isItalian
          ? 'La connessione potrebbe essere scaduta prima che il server rispondesse. Verifica la raggiungibilità di rete e aumenta il timeout se necessario.'
          : 'The connection may have timed out before the server responded. Check network reachability and consider increasing the timeout threshold.',
        severity: 'medium',
      },
    ];
  }

  if (statusCode === 400) {
    return [
      {
        title: isItalian ? 'Request malformata o payload non valido' : 'Malformed request or invalid payload',
        description: isItalian
          ? 'Il server non ha compreso la richiesta. Controlla il Content-Type, la struttura del body JSON e i campi obbligatori.'
          : 'The server could not understand the request. Check the Content-Type header, JSON body structure, and required fields.',
        severity: 'high',
      },
      {
        title: isItalian ? 'Parametri query o header non validi' : 'Invalid query parameters or headers',
        description: isItalian
          ? 'Uno o più parametri query o header potrebbero non rispettare il formato atteso dall\'API.'
          : 'One or more query parameters or headers might not match the expected format for this API.',
        severity: 'medium',
      },
    ];
  }

  if (statusCode === 401) {
    return [
      {
        title: isItalian ? 'Credenziali di autenticazione mancanti o non valide' : 'Missing or invalid authentication credentials',
        description: isItalian
          ? 'La richiesta richiede autenticazione. Verifica che il token Authorization (Bearer, Basic o API Key) sia presente e valido.'
          : 'The request requires authentication. Verify that the Authorization token (Bearer, Basic, or API Key) is present and valid.',
        severity: 'high',
      },
      {
        title: isItalian ? 'Token scaduto o revocato' : 'Expired or revoked token',
        description: isItalian
          ? 'Il token potrebbe essere scaduto. Effettua un token refresh e riprova la chiamata.'
          : 'The token may have expired. Perform a token refresh and retry the request.',
        severity: 'high',
      },
    ];
  }

  if (statusCode === 403) {
    const bodyStr = JSON.stringify(body ?? '').toLowerCase();
    const scopeHint = bodyStr.includes('scope') || bodyStr.includes('permission') || bodyStr.includes('insuffi');
    return [
      {
        title: isItalian ? 'Permessi insufficienti' : 'Insufficient permissions',
        description: isItalian
          ? `L'identità autenticata non dispone dei permessi necessari per eseguire questa operazione. ${scopeHint ? 'Il body della risposta suggerisce un problema con gli scope OAuth o i permessi RBAC.' : 'Verifica ruoli, policy e scope assegnati all\'utente o al client.'}`
          : `The authenticated identity does not have the required permissions for this operation. ${scopeHint ? 'The response body hints at an OAuth scope or RBAC permission issue.' : 'Check the roles, policies, and scopes assigned to the user or client.'}`,
        severity: 'high',
      },
      {
        title: isItalian ? 'Risorsa protetta o accesso negato dalla policy' : 'Protected resource or policy-denied access',
        description: isItalian
          ? 'Un middleware di autorizzazione (API gateway, RBAC, ACL) ha bloccato la richiesta prima che raggiungesse la logica applicativa.'
          : 'An authorization middleware (API gateway, RBAC, ACL) blocked the request before it reached the application logic.',
        severity: 'medium',
      },
    ];
  }

  if (statusCode === 404) {
    return [
      {
        title: isItalian ? 'Risorsa non trovata' : 'Resource not found',
        description: isItalian
          ? 'L\'endpoint o la risorsa richiesta non esiste. Controlla il percorso URL, gli ID di risorsa e la versione dell\'API.'
          : 'The requested endpoint or resource does not exist. Check the URL path, resource IDs, and API version.',
        severity: 'high',
      },
      {
        title: isItalian ? 'Variabili nel path non sostituite' : 'Unresolved path variables',
        description: isItalian
          ? 'Uno o più segmenti del path potrebbero contenere placeholder non sostituiti (es. :id, {userId}).'
          : 'One or more path segments might contain unresolved placeholders (e.g., :id, {userId}).',
        severity: 'medium',
      },
    ];
  }

  if (statusCode === 422) {
    return [
      {
        title: isItalian ? 'Errore di validazione semantica' : 'Semantic validation error',
        description: isItalian
          ? 'Il server ha ricevuto un payload sintatticamente corretto ma con valori semanticamente non validi. Esamina i dettagli dell\'errore nel body della risposta.'
          : 'The server received a syntactically correct payload but with semantically invalid values. Examine the error details in the response body.',
        severity: 'high',
      },
    ];
  }

  if (statusCode === 429) {
    return [
      {
        title: isItalian ? 'Limite di rate superato' : 'Rate limit exceeded',
        description: isItalian
          ? 'Hai superato il numero massimo di richieste consentite in un intervallo di tempo. Attendi l\'intervallo indicato nell\'header Retry-After prima di riprovare.'
          : 'You have exceeded the maximum number of requests allowed in a time window. Wait for the interval indicated in the Retry-After header before retrying.',
        severity: 'high',
      },
    ];
  }

  if (statusCode >= 500) {
    return [
      {
        title: isItalian ? 'Errore interno del server' : 'Internal server error',
        description: isItalian
          ? 'Il server ha incontrato una condizione inattesa. Controlla i log applicativi lato server per stack trace o eccezioni non gestite.'
          : 'The server encountered an unexpected condition. Check server-side application logs for stack traces or unhandled exceptions.',
        severity: 'high',
      },
      {
        title: isItalian ? 'Servizio dipendente non disponibile' : 'Dependent service unavailable',
        description: isItalian
          ? 'Il server potrebbe aver ricevuto un errore da un servizio downstream (database, cache, microservizio esterno). Un codice 503 spesso indica questo scenario.'
          : 'The server may have received an error from a downstream service (database, cache, external microservice). A 503 status often indicates this scenario.',
        severity: 'medium',
      },
    ];
  }

  return [
    {
      title: isItalian ? 'Risposta non attesa' : 'Unexpected response',
      description: isItalian
        ? `Lo status code ${statusCode} non corrisponde a un pattern di errore comune. Consulta la documentazione dell'API per interpretare il significato specifico di questo codice.`
        : `Status code ${statusCode} does not match a common error pattern. Consult the API documentation to interpret the specific meaning of this code.`,
      severity: 'medium',
    },
  ];
}

function getSuggestedFixes(
  statusCode: number,
  request: Request | null,
  language: Language
): DebugFix[] {
  const isItalian = language === 'it';
  const hasAuth = (request?.headers ?? []).some(
    (h) => h.enabled && h.key.toLowerCase() === 'authorization'
  );

  if (statusCode === 0) {
    return [
      {
        description: isItalian
          ? 'Verifica che il server sia in esecuzione e raggiungibile dalla rete corrente.'
          : 'Verify that the server is running and reachable from the current network.',
      },
      {
        description: isItalian
          ? 'Controlla le policy CORS del server se stai effettuando chiamate cross-origin dal browser.'
          : 'Check the server CORS policy if you are making cross-origin calls from the browser.',
      },
    ];
  }

  if (statusCode === 401) {
    const fixes: DebugFix[] = [
      {
        description: isItalian
          ? 'Aggiorna il token di autenticazione e aggiungi l\'header Authorization alla richiesta.'
          : 'Refresh the authentication token and add the Authorization header to the request.',
      },
    ];
    if (!hasAuth) {
      fixes.unshift({
        description: isItalian
          ? "L'header Authorization è assente nella request corrente. Aggiungilo prima di inviare la richiesta."
          : 'The Authorization header is missing from the current request. Add it before sending.',
      });
    }
    return fixes;
  }

  if (statusCode === 403) {
    return [
      {
        description: isItalian
          ? 'Verifica che il token includa gli scope OAuth necessari per questa operazione (es. write:resource).'
          : 'Ensure the token includes the required OAuth scopes for this operation (e.g., write:resource).',
      },
      {
        description: isItalian
          ? 'Controlla le policy RBAC e ACL associate all\'utente o al client corrente.'
          : "Check RBAC policies and ACLs associated with the current user or client.",
      },
    ];
  }

  if (statusCode === 404) {
    return [
      {
        description: isItalian
          ? 'Controlla il path URL e sostituisci eventuali placeholder con valori reali (es. /users/:id → /users/123).'
          : 'Check the URL path and replace any placeholders with real values (e.g., /users/:id → /users/123).',
      },
      {
        description: isItalian
          ? "Verifica la versione dell'API nell'URL (es. /v1/ vs /v2/) e che il resource ID sia corretto."
          : 'Verify the API version in the URL (e.g., /v1/ vs /v2/) and that the resource ID is correct.',
      },
    ];
  }

  if (statusCode >= 500) {
    return [
      {
        description: isItalian
          ? 'Controlla i log del server per eccezioni non gestite o errori di connessione al database.'
          : 'Check server logs for unhandled exceptions or database connection errors.',
      },
      {
        description: isItalian
          ? 'Riprova la richiesta dopo qualche secondo. Se il problema persiste, contatta il team responsabile del servizio.'
          : 'Retry the request after a few seconds. If the issue persists, contact the team responsible for the service.',
      },
    ];
  }

  return [
    {
      description: isItalian
        ? 'Consulta la documentazione dell\'API per informazioni specifiche su questo codice di errore.'
        : 'Consult the API documentation for specific information about this error code.',
    },
  ];
}

export function debugResponse(
  request: Request | null,
  response: Response,
  language: Language = 'en'
): DebugResponseResult {
  const body = parseJson(response.body);

  return {
    summary: buildDebugSummary(request, response, language),
    rootCauses: getRootCausesForStatus(response.statusCode, body, language),
    suggestedFixes: getSuggestedFixes(response.statusCode, request, language),
  };
}
