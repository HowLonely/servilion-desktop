import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { getConfig } from "./config";
import { buildReceiptPayload, buildWeighPayload } from "./printing";

import type {
  PrintResult,
  PrinterConfig,
  ReceiptPrintJob,
  WeighPrintJob,
} from "../shared/types";

/**
 * Transporte hacia la etiquetera. El ZPL lo arma `./zpl`; aquí solo se decide
 * por dónde sale. Están separados porque el layout es logica pura y probable
 * sin Electron, mientras que esto toca sockets, puertos serie y el spooler.
 */

const execFileAsync = promisify(execFile);

const SEND_TIMEOUT_MS = 10_000;

async function sendTcp(payload: string, printer: PrinterConfig): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = new Socket();
    socket.setTimeout(SEND_TIMEOUT_MS);

    const fail = (error: Error): void => {
      socket.destroy();
      reject(error);
    };

    socket.once("error", fail);
    socket.once("timeout", () => fail(new Error("La impresora no respondió a tiempo.")));
    socket.connect(printer.port, printer.host, () => {
      socket.end(payload, "binary", () => resolve());
    });
  });
}

async function sendSerial(payload: string, printer: PrinterConfig): Promise<void> {
  // El puerto serie se abre como archivo. Se hace así y no con `serialport`
  // para no arrastrar un módulo nativo —que obliga a recompilar contra cada
  // versión de Electron— por un caso que en Windows se resuelve con un write.
  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(printer.device, { flags: "w" });
    stream.once("error", reject);
    stream.end(payload, "binary", () => resolve());
  });
}

async function sendWindows(payload: string, printer: PrinterConfig): Promise<void> {
  // `Out-Printer` pasaría por el driver y rasterizaría el ZPL como texto. La vía
  // cruda es copiar el archivo al recurso compartido, que es lo que hace el
  // spooler con una cola configurada como "generic / text only".
  const file = join(tmpdir(), `servilion-zpl-${Date.now()}.txt`);
  await writeFile(file, payload, "binary");
  try {
    await execFileAsync("cmd", ["/c", "copy", "/b", file, printer.device], {
      timeout: SEND_TIMEOUT_MS,
      windowsHide: true,
    });
  } finally {
    await unlink(file).catch(() => undefined);
  }
}

/**
 * Manda el ZPL a la etiquetera configurada.
 *
 * Devuelve el error en vez de lanzarlo: en la báscula, que falle la impresora
 * no puede parecerse a que falle el pesaje. El pesaje ya quedó guardado en el
 * servidor y sus etiquetas se reimprimen desde la lista del turno.
 */
export async function printWeighLabels(job: WeighPrintJob): Promise<PrintResult> {
  return send(getConfig().printer, (printer) => buildWeighPayload(job, printer));
}

/**
 * Imprime la boleta del morral limpio.
 *
 * Mismo criterio que el pesaje: el fallo se devuelve, no se lanza. El morral ya
 * quedó cerrado en el servidor y la boleta se reimprime; tratar "no imprimió"
 * como "no se cerró" haría que el operador volviera a pistolear un morral que
 * ya está listo.
 */
export async function printReceipt(job: ReceiptPrintJob): Promise<PrintResult> {
  return send(receiptPrinter(), (printer) => buildReceiptPayload(job, printer));
}

/**
 * Por dónde sale la boleta.
 *
 * Si el equipo tiene una impresora de boleta propia, por ahí; si no, por la
 * etiquetera. Es la diferencia entre una estación con una sola máquina y una
 * con la etiquetera para los adhesivos más una TM para los documentos, y no
 * tiene por qué notarse en quien aprieta el botón.
 */
function receiptPrinter(): PrinterConfig {
  const config = getConfig();
  return config.receiptPrinter.transport !== "none" ? config.receiptPrinter : config.printer;
}

/**
 * Arma el trabajo en el lenguaje de esa impresora y lo manda por su transporte.
 *
 * El layout no sabe por dónde sale ni el transporte sabe qué manda: eso permite
 * agregar un lenguaje nuevo tocando un archivo de `printing/` y nada más.
 */
async function send(
  printer: PrinterConfig,
  build: (printer: PrinterConfig) => string,
): Promise<PrintResult> {
  if (printer.transport === "none") {
    return {
      ok: false,
      detail: "No hay impresora configurada en este equipo (Ajustes → Impresoras).",
    };
  }

  const payload = build(printer);
  try {
    if (printer.transport === "tcp") await sendTcp(payload, printer);
    else if (printer.transport === "serial") await sendSerial(payload, printer);
    else await sendWindows(payload, printer);
    return { ok: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, detail };
  }
}
