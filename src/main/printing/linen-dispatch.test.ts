import { describe, expect, it } from "vitest";

import { buildLinenDispatchPayload } from "./index";

import type { LinenDispatchPrintJob, PrinterConfig, PrinterLanguage } from "../../shared/types";

const job: LinenDispatchPrintJob = {
  number: "HD-2026-0007",
  company_name: "Hotel Cordillera",
  faena: "Faena Horizonte",
  occurred_at: "2026-09-28T13:30:00.000Z",
  registered_by_name: "Demo Empaque",
  note: "",
  total_quantity: 70,
  lines: [
    { code: "SAB", name: "Sábana", quantity: 50 },
    { code: "TOA", name: "Toalla", quantity: 20 },
  ],
};

function printer(language: PrinterLanguage): PrinterConfig {
  return {
    transport: "tcp",
    language,
    host: "127.0.0.1",
    port: 9100,
    device: "",
    dpi: 203,
    labelWidthMm: 50,
    labelHeightMm: 30,
  };
}

describe("guía de despacho de lencería", () => {
  it.each(["zpl", "epl", "escpos"] as const)("lleva número, detalle y total en %s", (language) => {
    const payload = buildLinenDispatchPayload(job, printer(language));

    expect(payload).toContain("HD-2026-0007");
    expect(payload).toContain("GUIA DE DESPACHO - HOTELERIA");
    expect(payload).toContain("TOTAL 70 PIEZAS");
    // Sin tildes: la impresora recibe ASCII.
    expect(payload).toMatch(/SABANA|Sabana/);
    expect(payload).toMatch(/TOALLA|Toalla/);
  });

  it("alarga la etiqueta ZPL con cada tipo de lencería", () => {
    const heightOf = (lines: LinenDispatchPrintJob["lines"]): number =>
      Number(/\^LL(\d+)/.exec(buildLinenDispatchPayload({ ...job, lines }, printer("zpl")))?.[1]);

    const short = heightOf(job.lines.slice(0, 1));
    const long = heightOf([...job.lines, { code: "CUB", name: "Cubrecama", quantity: 5 }]);
    expect(long).toBeGreaterThan(short);
  });
});
