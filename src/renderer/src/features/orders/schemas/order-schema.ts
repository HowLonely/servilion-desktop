import { z } from "zod";

// La OT física admite prendas fuera del catálogo preimpreso: el trabajador las
// escribe a mano y Antofagasta debe poder digitalizarlas igual
// (FLUJO_NEGOCIO.md §7). Por eso una línea vale con tipo de prenda del catálogo
// O con nombre libre, pero no sin ninguno de los dos.
export const orderItemSchema = z
  .object({
    garment_type_id: z.number().nullable(),
    custom_name: z.string(),
    quantity: z.number().min(1, "La cantidad debe ser al menos 1."),
  })
  .refine(
    (item) => (item.garment_type_id ?? 0) > 0 || item.custom_name.trim() !== "",
    {
      message: "Selecciona una prenda del catálogo o escribe su nombre.",
      path: ["custom_name"],
    },
  );

export const orderSchema = z.object({
  order_number: z.string().min(1, "El número de OT es obligatorio."),
  worker_id: z.number().min(1, "Selecciona un trabajador."),
  // Pesaje del que sale esta guía. Null cuando el morral no pasó por la
  // báscula: es la excepción (equipo caído, morral traspapelado), no un error.
  weigh_in_id: z.number().nullable(),
  ticket_number: z.string(),
  shift: z.string(),
  weight_kg: z.number().nullable(),
  received_at: z.string().min(1, "La fecha de recepción es obligatoria."),
  observations: z.string(),
  // `reference` no está: el ref lo emite el servidor (lo hereda del pesaje, o
  // lo saca de su contador bloqueado). Mandarlo desde acá era la vía por la que
  // un cliente podía proponer un ref duplicado; el backend ya no lo acepta.
  control_code: z.string(),
  items: z.array(orderItemSchema).min(1, "Agrega al menos una prenda."),
});

export type OrderFormValues = z.infer<typeof orderSchema>;

export const statusUpdateSchema = z.object({
  status: z.string().min(1),
  note: z.string(),
});

export type StatusUpdateFormValues = z.infer<typeof statusUpdateSchema>;
