import { z } from "zod";

// Patrones de turno observados en la operación real (FLUJO_NEGOCIO.md §1).
// Igual que en servilion-web/src/features/workers/schemas/worker-schema.ts:
// es una lista de apoyo para el selector, no una restricción del backend
// (`shift` es texto libre), así que un turno fuera de esta lista no se rechaza.
export const SHIFT_PATTERNS = [
  "4X3",
  "4X4",
  "5X2",
  "7X7",
  "10X10",
  "14X14",
  "15X15",
] as const;

export const workerSchema = z.object({
  company_id: z.number().min(1, "Selecciona una empresa."),
  badge_code: z.string().min(1, "El código/credencial es obligatorio."),
  full_name: z.string().min(1, "El nombre es obligatorio."),
  national_id: z.string(),
  // Reemplaza a los antiguos `camp`/`room` de texto libre: apunta a una
  // habitación real, que es lo que la app móvil escanea al entregar.
  current_room_id: z.number().nullable(),
  shift: z.string(),
  position: z.string(),
  area: z.string(),
  phone: z.string(),
});

export type WorkerFormValues = z.infer<typeof workerSchema>;
