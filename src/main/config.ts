import { readFileSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";

import { app } from "electron";

import type { PrinterConfig, StationConfig } from "../shared/types";

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

// Etiquetera por defecto: sin configurar. Las medidas son las de un rollo
// estandar de 50 x 25 mm a 203 dpi, que es lo mas comun en etiquetado de
// prendas; se ajustan en Ajustes sin recompilar, porque cada planta compra el
// rollo que consigue. El lenguaje parte en ZPL porque es el de facto de las
// etiqueteras, que es la impresora que la app no puede dejar de tener.
function defaultPrinter(): PrinterConfig {
  return {
    transport: "none",
    language: "zpl",
    host: "",
    port: 9100,
    device: "",
    labelWidthMm: 50,
    labelHeightMm: 25,
    dpi: 203,
  };
}

// Impresora de boleta por defecto: sin configurar, para que la boleta salga por
// la etiquetera como hasta ahora. Si la estacion tiene una TM colgada aparte, se
// configura acá y las medidas por defecto ya son las de un rollo de 80 mm.
function defaultReceiptPrinter(): PrinterConfig {
  return {
    ...defaultPrinter(),
    language: "escpos",
    labelWidthMm: 80,
  };
}

function defaults(): StationConfig {
  return {
    serverUrl: DEFAULT_SERVER_URL,
    stationName: hostname(),
    launchAtLogin: false,
    kioskMode: false,
    touchMode: false,
    printer: defaultPrinter(),
    receiptPrinter: defaultReceiptPrinter(),
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
      // Las impresoras se fusionan campo a campo: un config.json escrito por una
      // version anterior no las trae —o trae la etiquetera sin `language`, que es
      // el caso de todas las instalaciones previas a este ajuste— y el spread de
      // arriba las dejaria a medias.
      printer: { ...defaultPrinter(), ...(raw.printer ?? {}) },
      receiptPrinter: { ...defaultReceiptPrinter(), ...(raw.receiptPrinter ?? {}) },
    };
  } catch {
    // Primer arranque, o archivo corrupto: se parte de los valores por defecto.
    cached = defaults();
  }
  return cached;
}

export function setConfig(patch: Partial<StationConfig>): StationConfig {
  const current = getConfig();
  const next: StationConfig = { ...current, ...patch };
  next.serverUrl = normalizeServerUrl(next.serverUrl);
  // Idem al leer: guardar solo `transport` no debe borrar el resto del bloque.
  next.printer = { ...current.printer, ...(patch.printer ?? {}) };
  next.receiptPrinter = { ...current.receiptPrinter, ...(patch.receiptPrinter ?? {}) };
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
