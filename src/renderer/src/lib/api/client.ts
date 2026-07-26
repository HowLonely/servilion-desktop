import createClient from "openapi-fetch";

import type { paths } from "./schema";

// El renderer no habla con el servidor: habla con el proceso main, que es quien
// tiene los tokens y hace el HTTP real (ver src/main/session.ts). Para que los
// hooks de datos sean idénticos a los del panel web, ese puente se disfraza de
// `fetch` y se le entrega a openapi-fetch.
//
// El origen `servilion.local` es ficticio y solo existe para que la URL sea
// parseable: main lo ignora y usa el servidor configurado en el equipo.
const BRIDGE_ORIGIN = "http://servilion.local";

/** Cabecera con la que main marca "no llegué al servidor" (ver main/api.ts). */
export const OFFLINE_HEADER = "x-servilion-offline";

async function bridgeFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const request = new Request(input, init);
  const url = new URL(request.url);

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const body = request.method === "GET" || request.method === "HEAD"
    ? null
    : await request.text();

  const response = await window.servilion.api.request({
    path: `${url.pathname}${url.search}`,
    method: request.method,
    headers,
    body: body || null,
  });

  return new Response(response.body, {
    status: response.status,
    headers: {
      ...response.headers,
      ...(response.offline ? { [OFFLINE_HEADER]: "1" } : {}),
    },
  });
}

export const api = createClient<paths>({
  baseUrl: BRIDGE_ORIGIN,
  fetch: bridgeFetch,
});
