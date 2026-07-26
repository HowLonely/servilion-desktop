import { getConfig } from "./config";

import type { ApiResponse } from "../shared/types";

// Todo el tráfico HTTP hacia Django sale desde el proceso main, nunca desde el
// renderer. Dos razones:
//   1. Node no aplica la política de origen, así que no hace falta agregar la
//      app a CORS_ALLOWED_ORIGINS del backend.
//   2. El refresh token vive aquí (ver session.ts) y jamás cruza al renderer.

/** Corta la espera cuando el servidor está caído pero la IP responde. */
const REQUEST_TIMEOUT_MS = 20_000;

const OFFLINE_BODY = JSON.stringify({
  detail: "No hay conexión con el servidor de Servilion.",
});

// Se responde 503 (y no un status 0, que `Response` rechaza) para que el
// renderer lo trate como un error de API normal; el flag `offline` distingue
// "no llegué al servidor" de "el servidor dijo que no".
const OFFLINE_STATUS = 503;

function offlineResponse(): ApiResponse {
  return {
    status: OFFLINE_STATUS,
    headers: { "content-type": "application/json" },
    body: OFFLINE_BODY,
    offline: true,
  };
}

export type HttpOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string | null;
  /** Servidor a usar; por defecto el configurado. Los ajustes prueban otro. */
  serverUrl?: string;
  timeoutMs?: number;
};

/**
 * Petición HTTP cruda al backend. No sabe de tokens: quien los inyecta es
 * `session.ts`. Nunca lanza por problemas de red — los reporta como
 * `offline: true`, porque una terminal de digitación no debe ver un stack trace.
 */
export async function httpRequest(
  path: string,
  options: HttpOptions = {},
): Promise<ApiResponse> {
  const base = options.serverUrl ?? getConfig().serverUrl;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(`${base}${path}`, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body ?? undefined,
      signal: controller.signal,
    });

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      status: response.status,
      headers,
      body: await response.text(),
      offline: false,
    };
  } catch {
    // DNS, conexión rechazada, timeout: para el operador todo es "sin conexión".
    return offlineResponse();
  } finally {
    clearTimeout(timer);
  }
}

/** Igual que `httpRequest` pero parseando JSON, para uso interno de main. */
export async function httpJson<T>(
  path: string,
  options: HttpOptions = {},
): Promise<{ status: number; data: T | null; offline: boolean }> {
  const response = await httpRequest(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  let data: T | null = null;
  try {
    data = JSON.parse(response.body) as T;
  } catch {
    data = null;
  }

  return { status: response.status, data, offline: response.offline };
}
