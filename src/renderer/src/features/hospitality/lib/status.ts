// Estados del lote de hotelería, replicados desde el backend
// (hospitality/models.py BatchStatus). Son tres y no seis como los de una guía:
// un lote no pasa por revisión ni empaque prenda por prenda, porque no tiene
// que volver completo a un dueño. Entra a granel, se lava y se devuelve al
// mandante; lo único que se controla es cuánto entró y cuánto salió.
//
// EN_PROCESO no tiene botón propio en la terminal: el backend mueve el lote ahí
// solo al registrar la primera cuenta de salida (`register_return_count`), que
// es el gesto físico real. El endpoint `/process` existe para quien quiera
// declararlo antes, y no hay ninguna estación que lo necesite.
export const BATCH_STATUSES = ["RECIBIDO", "EN_PROCESO", "DESPACHADO"] as const;

export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  RECIBIDO: "Recibido",
  EN_PROCESO: "En proceso",
  DESPACHADO: "Despachado",
};

export const BATCH_STATUS_TONES: Record<BatchStatus, string> = {
  RECIBIDO:
    "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  EN_PROCESO: "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300",
  DESPACHADO:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
};

export function batchStatusLabel(status: string): string {
  return BATCH_STATUS_LABELS[status as BatchStatus] ?? status;
}

export function batchStatusTone(status: string): string {
  return BATCH_STATUS_TONES[status as BatchStatus] ?? BATCH_STATUS_TONES.RECIBIDO;
}

/**
 * Umbral desde el cual una merma deja de ser ruido de conteo y merece
 * destacarse en rojo. Es un valor de partida para la demo, no una regla del
 * negocio: hay que confirmarlo con el mandante (nunca se midió antes, ver la
 * ausencia total de guías incompletas en nueve años de hotelería).
 *
 * El mismo valor está en `servilion-web/src/features/hospitality/lib/status.ts`.
 */
export const SHORTAGE_ALERT_RATE = 0.02;
