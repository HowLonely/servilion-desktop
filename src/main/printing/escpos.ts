import {
  asciiText,
  formatDate,
  formatDateTime,
  formatWeight,
  SEPARATOR,
  truncate,
} from "./text";
import { receiptScanCode } from "./zpl";

import type { PrinterConfig, ReceiptPrintJob, WeighPrintJob } from "../../shared/types";

/**
 * ESC/POS — *Epson Standard Code for Point Of Sale*.
 *
 * Es el juego de comandos de las impresoras de **boleta** de Epson (serie TM) y
 * el estándar de facto de ese tipo de máquina: Bixolon, Citizen, Star y la
 * clonería genérica traen emulación ESC/POS porque el software de punto de venta
 * lo asume. No es un dialecto de ZPL ni compite con él: son máquinas distintas.
 * Una de boleta corta papel continuo y no pega nada; una etiquetera conoce el
 * troquel de cada etiqueta.
 *
 * Dos advertencias que decidieron cómo está escrito esto:
 *
 * 1. **Los adhesivos por prenda no tienen sentido acá.** Se emiten igual —cada
 *    código en su trozo de papel con su corte— porque una estación mal
 *    configurada tiene que sacar algo legible en vez de nada, pero el adhesivo
 *    lavable se pega a la ropa y este papel no. Lo que ESC/POS sí hace bien es
 *    la boleta, que es un documento y no un adhesivo.
 * 2. **El QR depende del modelo.** Los símbolos 2D viven en el grupo `GS ( k`,
 *    que las TM modernas implementan y los modelos viejos o los clones baratos
 *    no. Cuando falta, la impresora ignora la secuencia sin devolver error: sale
 *    la boleta sin QR. Por eso el payload va SIEMPRE también en texto grande
 *    debajo, para que la entrega se pueda tipear.
 */

const ESC = "\x1b";
const GS = "\x1d";

/** Nº de columnas del papel en fuente A: 80 mm son 48; 58 mm, 32. */
function columns(printer: PrinterConfig): number {
  return printer.labelWidthMm >= 70 ? 48 : 32;
}

const init = `${ESC}@`; // reinicia estado: alineación, tamaño y negrita heredados
const alignLeft = `${ESC}a\x00`;
const alignCenter = `${ESC}a\x01`;
const boldOn = `${ESC}E\x01`;
const boldOff = `${ESC}E\x00`;

/**
 * Tamaño del carácter: `GS ! n`, con el ancho en el nibble alto y el alto en el
 * bajo. Multiplicadores de 1 a 8; 1,1 es el tamaño normal.
 */
function size(width: number, height: number): string {
  const w = Math.min(8, Math.max(1, width)) - 1;
  const h = Math.min(8, Math.max(1, height)) - 1;
  return `${GS}!${String.fromCharCode((w << 4) | h)}`;
}

const normal = size(1, 1);

/** Corte parcial con avance, para que el papel salga por encima de la cuchilla. */
const cut = `${GS}V\x42\x00`;

function feed(lines: number): string {
  return `${ESC}d${String.fromCharCode(Math.min(255, Math.max(0, lines)))}`;
}

function rule(printer: PrinterConfig): string {
  return `${"-".repeat(columns(printer))}\n`;
}

/** Etiqueta a la izquierda y valor a la derecha, rellenando con espacios. */
function row(printer: PrinterConfig, label: string, value: string): string {
  const total = columns(printer);
  const left = asciiText(label);
  const right = asciiText(value);
  const gap = Math.max(1, total - left.length - right.length);
  return `${left}${" ".repeat(gap)}${right}\n`;
}

function centered(printer: PrinterConfig, value: string): string {
  return `${truncate(asciiText(value), columns(printer))}\n`;
}

/**
 * Código de barras Code 128.
 *
 * Se usa la forma con largo explícito (`GS k 73 n`) y no la terminada en NUL,
 * porque esta última corta el dato en el primer byte cero y no admite validar
 * el largo. El `{B` inicial selecciona el juego de caracteres B, que es el que
 * cubre mayúsculas, dígitos y guion — todo lo que llevan nuestros códigos.
 */
function code128(data: string, heightDots: number, moduleWidth = 2): string {
  const payload = `{B${asciiText(data)}`;
  return [
    `${GS}h${String.fromCharCode(Math.min(255, Math.max(1, heightDots)))}`,
    `${GS}w${String.fromCharCode(Math.min(6, Math.max(2, moduleWidth)))}`,
    `${GS}H\x00`, // sin texto bajo el código: ya lo imprimimos nosotros, más grande
    `${GS}k\x49${String.fromCharCode(payload.length)}${payload}`,
    "\n",
  ].join("");
}

/**
 * Código QR, con los cinco comandos del grupo 2D.
 *
 * `GS ( k pL pH cn fn ...` donde `pL/pH` es el largo en dos bytes (bajo, alto)
 * contando la cabecera `cn fn`. `cn=49` es la familia QR; las funciones son
 * 165 (modelo), 167 (tamaño de módulo), 169 (corrección de error), 180 (cargar
 * datos) y 181 (imprimir lo cargado).
 */
function qr(data: string, moduleSize = 6): string {
  const payload = asciiText(data);
  const length = payload.length + 3;
  const pL = String.fromCharCode(length & 0xff);
  const pH = String.fromCharCode((length >> 8) & 0xff);
  const module = String.fromCharCode(Math.min(16, Math.max(1, moduleSize)));

  return [
    `${GS}(k\x04\x00\x31\x41\x32\x00`, // fn 165: modelo 2
    `${GS}(k\x03\x00\x31\x43${module}`, // fn 167: tamaño de módulo
    // fn 169: corrección de error M (15%). El QR de la boleta no se lava ni se
    // pega a nada —a diferencia de la etiqueta de prenda, que va en H—, así que
    // no hace falta gastar un cuarto del símbolo en redundancia.
    `${GS}(k\x03\x00\x31\x45\x31`,
    `${GS}(k${pL}${pH}\x31\x50\x30${payload}`, // fn 180: cargar datos
    `${GS}(k\x03\x00\x31\x51\x30`, // fn 181: imprimir
    "\n",
  ].join("");
}

/**
 * Línea de origen: faena, empresa y, si corresponde, la marca de contratista.
 *
 * Se recortan faena y empresa; "CONTRATISTA" no. Es lo único de esta línea que
 * cambia una decisión —dice que el morral no es del mandante de la faena aunque
 * se lave y se facture bajo su cliente—, así que si algo no cabe se corta el
 * nombre, nunca la marca. Truncar la línea entera dejaba "... - CO.".
 */
function originLine(
  printer: PrinterConfig,
  parts: { faena: string; company_name: string; is_contractor: boolean },
): string {
  const origin = [asciiText(parts.faena), asciiText(parts.company_name)]
    .filter(Boolean)
    .join(SEPARATOR);
  if (!parts.is_contractor) return truncate(origin, columns(printer));

  const mark = `${SEPARATOR}CONTRATISTA`;
  return `${truncate(origin, Math.max(1, columns(printer) - mark.length))}${mark}`;
}

/**
 * Los adhesivos y el ticket maestro de un pesaje, en papel de boleta.
 *
 * Cada unidad sale en su propio trozo cortado, que es lo más cerca del adhesivo
 * que este papel puede estar. El maestro va al final por lo mismo que en ZPL:
 * queda arriba en la pila y es lo primero que el operador toma.
 */
export function buildWeighEscPos(job: WeighPrintJob, printer: PrinterConfig): string {
  const origin = originLine(printer, job);
  const labels = job.labels.map((label) =>
    [
      init,
      alignCenter,
      `${size(2, 2)}${boldOn}${asciiText(label.code)}\n${boldOff}${normal}`,
      code128(label.code, 60),
      `${origin}\n`,
      alignLeft,
      feed(1),
      cut,
    ].join(""),
  );

  const master = [
    init,
    alignCenter,
    "PESAJE - DIGITALIZAR\n",
    `${size(3, 3)}${boldOn}${asciiText(job.reference)}\n${boldOff}${normal}`,
    code128(job.reference, 80),
    feed(1),
    alignLeft,
    rule(printer),
    centered(printer, job.client_name),
    centered(printer, job.company_name),
    centered(printer, `${job.is_contractor ? "CONTRATISTA" : "MANDANTE"}${SEPARATOR}${job.faena}`),
    rule(printer),
    alignCenter,
    // Prendas y peso en cuerpo grande: son los dos números que el digitador
    // contrasta contra la OT física antes de tipear nada.
    `${size(2, 2)}${boldOn}${job.garment_count} PRENDAS\n${formatWeight(job.weight_kg)} KG\n${boldOff}${normal}`,
    alignLeft,
    rule(printer),
    `${formatDateTime(job.weighed_at)}\n`,
    `${asciiText(job.weighed_by_name)}\n`,
    feed(2),
    cut,
  ].join("");

  return [...labels, master].join("");
}

/**
 * La boleta del morral limpio. Es el documento para el que esta impresora sirve.
 *
 * Lleva los dos códigos por lo mismo que en ZPL: el de barras lo pistolea el
 * empaque para cerrar y despachar, y el QR lo lee la app de terreno al entregar
 * en la habitación. Ambos van además en texto, el de entrega en cuerpo grande,
 * porque en un modelo sin soporte 2D el QR simplemente no se imprime y la
 * entrega tiene que poder tipearse.
 */
export function buildReceiptEscPos(job: ReceiptPrintJob, printer: PrinterConfig): string {
  const scanCode = receiptScanCode(job);
  const destination =
    [asciiText(job.camp), asciiText(job.room)].filter(Boolean).join(SEPARATOR) || "SIN DESTINO";
  const origin = originLine(printer, job);
  return [
    init,
    alignCenter,
    "BOLETA - MORRAL LIMPIO\n",
    `${size(3, 3)}${boldOn}${asciiText(job.reference) || "S/REF"}\n${boldOff}${normal}`,
    code128(scanCode, 80),
    `${scanCode}\n`,
    "PISTOLEAR PARA CERRAR Y DESPACHAR\n",
    alignLeft,
    rule(printer),

    "TRABAJADOR\n",
    `${size(2, 2)}${boldOn}${truncate(asciiText(job.worker_name).toUpperCase(), Math.floor(columns(printer) / 2))}\n${boldOff}${normal}`,
    `${[job.national_id || "Sin RUT", job.shift && `Turno ${job.shift}`]
      .filter(Boolean)
      .map((part) => asciiText(String(part)))
      .join(SEPARATOR)}\n`,
    rule(printer),

    "ENTREGAR EN\n",
    `${size(2, 2)}${boldOn}${truncate(destination.toUpperCase(), Math.floor(columns(printer) / 2))}\n${boldOff}${normal}`,
    rule(printer),

    alignCenter,
    "CODIGO DE ENTREGA\n",
    qr(job.qr_payload),
    `${size(2, 2)}${boldOn}${asciiText(job.qr_payload) || "-"}\n${boldOff}${normal}`,
    `ENTREGA ${formatDate(job.promised_at)}\n`,
    alignLeft,
    rule(printer),

    row(printer, "N. OT", job.order_number ?? "S/N"),
    row(printer, "Control", job.control_code || "-"),
    row(printer, "Prendas", String(job.garment_count)),
    row(printer, "Peso", job.weight_kg !== null ? `${formatWeight(job.weight_kg)} kg` : "-"),
    rule(printer),

    "DETALLE DECLARADO\n",
    ...job.items.map((item) =>
      row(printer, truncate(asciiText(item.name), columns(printer) - 6), `x${item.quantity}`),
    ),
    rule(printer),
    `${origin}\n`,
    feed(2),
    cut,
  ].join("");
}
