import type { BrowserWindow } from "electron";

import { httpRequest } from "./api";

import type { ServerStatus } from "../shared/types";

// El operador tiene que enterarse de que el servidor se cayó ANTES de digitar
// una OT completa, no al presionar Guardar. Por eso la cabecera lleva un
// indicador permanente alimentado por este sondeo.

const PING_INTERVAL_MS = 15_000;
const PING_TIMEOUT_MS = 5_000;

export const SERVER_STATUS_CHANNEL = "server:status";

let current: ServerStatus = "checking";
let timer: NodeJS.Timeout | null = null;

export function getServerStatus(): ServerStatus {
  return current;
}

/**
 * `/api/docs` responde sin autenticación, así que sirve para saber si el
 * servidor está vivo sin depender de que la sesión siga siendo válida.
 */
async function ping(): Promise<ServerStatus> {
  const response = await httpRequest("/api/docs", { timeoutMs: PING_TIMEOUT_MS });
  return response.offline ? "offline" : "online";
}

export async function checkNow(window: BrowserWindow | null): Promise<ServerStatus> {
  const next = await ping();
  if (next !== current) {
    current = next;
    window?.webContents.send(SERVER_STATUS_CHANNEL, current);
  }
  return current;
}

export function startHealthMonitor(window: BrowserWindow): void {
  stopHealthMonitor();
  void checkNow(window);
  timer = setInterval(() => void checkNow(window), PING_INTERVAL_MS);
}

export function stopHealthMonitor(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Fuerza un sondeo inmediato, ej. tras cambiar el servidor en Ajustes. */
export function resetStatus(): void {
  current = "checking";
}
