import { readFileSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";

import { app } from "electron";

import type { StationConfig } from "../shared/types";

// Los ajustes se guardan en userData (no en el bundle) porque cada equipo
// apunta a su propio servidor y lleva su propio nombre de estación. Así el
// mismo instalador sirve para todas las terminales.
const CONFIG_FILE = "config.json";

const DEFAULT_SERVER_URL =
  process.env.SERVILION_API_URL ?? "http://localhost:8000";

let cached: StationConfig | null = null;

function configPath(): string {
  return join(app.getPath("userData"), CONFIG_FILE);
}

function defaults(): StationConfig {
  return {
    serverUrl: DEFAULT_SERVER_URL,
    stationName: hostname(),
    launchAtLogin: false,
    kioskMode: false,
  };
}

/** Quita la barra final para que `serverUrl + path` nunca produzca "//api". */
export function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function getConfig(): StationConfig {
  if (cached) return cached;

  try {
    const raw = JSON.parse(readFileSync(configPath(), "utf-8")) as Partial<StationConfig>;
    cached = {
      ...defaults(),
      ...raw,
      serverUrl: normalizeServerUrl(raw.serverUrl ?? DEFAULT_SERVER_URL),
    };
  } catch {
    // Primer arranque, o archivo corrupto: se parte de los valores por defecto.
    cached = defaults();
  }
  return cached;
}

export function setConfig(patch: Partial<StationConfig>): StationConfig {
  const next: StationConfig = { ...getConfig(), ...patch };
  next.serverUrl = normalizeServerUrl(next.serverUrl);
  cached = next;

  try {
    writeFileSync(configPath(), JSON.stringify(next, null, 2), "utf-8");
  } catch (error) {
    console.error("No se pudo guardar la configuración:", error);
  }

  applyLaunchAtLogin(next.launchAtLogin);
  return next;
}

/**
 * Registra (o quita) el arranque automático con Windows. Se usa la API del
 * sistema en vez de un acceso directo en la carpeta de Inicio porque sobrevive
 * a las actualizaciones de la app.
 */
export function applyLaunchAtLogin(enabled: boolean): void {
  if (!app.isPackaged) return; // en desarrollo registraría el ejecutable de Electron
  app.setLoginItemSettings({ openAtLogin: enabled, args: [] });
}
