// HTTP execution service — sends the actual HTTP request
import type { Request, Response } from '../types';

export async function executeRequest(request: Request): Promise<Response> {
  const startTime = Date.now();

  // Build headers object (only enabled headers)
  const headersObj: Record<string, string> = {};
  request.headers
    .filter((h) => h.enabled && h.key.trim())
    .forEach((h) => {
      headersObj[h.key.trim()] = h.value;
    });

  const init: RequestInit = {
    method: request.method,
    headers: headersObj,
  };

  // Attach body for methods that support it
  if (['POST', 'PUT', 'PATCH'].includes(request.method) && request.body) {
    init.body = request.body;
  }

  const res = await fetch(request.url, init);
  const duration = Date.now() - startTime;

  // Read response body
  const body = await res.text();

  // Collect response headers
  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return {
    statusCode: res.status,
    statusText: res.statusText,
    duration,
    body,
    headers: responseHeaders,
    timestamp: new Date().toISOString(),
  };
}
