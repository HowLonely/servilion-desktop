import { buildReceiptEpl, buildWeighEpl } from "./epl";
import { buildReceiptEscPos, buildWeighEscPos } from "./escpos";
import { buildReceiptZpl, buildWeighZpl } from "./zpl";

import type {
  PrinterConfig,
  PrinterLanguage,
  ReceiptPrintJob,
  WeighPrintJob,
} from "../../shared/types";

/**
 * Despacho por lenguaje. Cada uno vive en su archivo y no se conocen entre sí:
 * agregar un cuarto es un archivo nuevo, una entrada en `PRINTER_LANGUAGES`
 * (`shared/types.ts`) y dos líneas acá.
 */

/** El juego de etiquetas de un pesaje, en el lenguaje que hable la impresora. */
export function buildWeighPayload(job: WeighPrintJob, printer: PrinterConfig): string {
  const builders: Record<PrinterLanguage, (j: WeighPrintJob, p: PrinterConfig) => string> = {
    zpl: buildWeighZpl,
    escpos: buildWeighEscPos,
    epl: buildWeighEpl,
  };
  return builders[printer.language](job, printer);
}

/** La boleta del morral limpio, en el lenguaje que hable la impresora. */
export function buildReceiptPayload(job: ReceiptPrintJob, printer: PrinterConfig): string {
  const builders: Record<PrinterLanguage, (j: ReceiptPrintJob, p: PrinterConfig) => string> = {
    zpl: buildReceiptZpl,
    escpos: buildReceiptEscPos,
    epl: buildReceiptEpl,
  };
  return builders[printer.language](job, printer);
}
