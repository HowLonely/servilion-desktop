// Máquina de estados de la guía (LaundryOrder), replicada exactamente desde
// el backend (orders/models.py OrderStatus). No se inventan transiciones
// nuevas aquí: la validación real de qué transición es válida la hace el
// backend. RECIBIDA cubre desde que se digitaliza la guía hasta el primer
// pistoleo de empaque (no hay un evento físico propio de "en lavado"), y ya
// no existe un estado "despachada": no hay ningún pistoleo que represente
// "salió de planta", así que ese concepto quedó absorbido por COMPLETADA.
export const ORDER_STATUSES = [
  "RECIBIDA",
  "EN_REVISION",
  "INCOMPLETA",
  "COMPLETADA",
  "ENTREGADA",
  "COBRADA",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Transiciones que el staff puede declarar a mano con el botón "Marcar como X"
// (ver OrderStatusActions). RECIBIDA -> EN_REVISION, EN_REVISION/INCOMPLETA ->
// COMPLETADA no aparecen a propósito: el sistema las decide solo, como efecto
// de digitalizar la guía, de pistolear el empaque y de resolver una prenda
// faltante (encontrada o comprada). Solo queda manual el cobro, un acto
// administrativo sin ningún escaneo detrás.
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RECIBIDA: [],
  EN_REVISION: [],
  INCOMPLETA: [],
  COMPLETADA: ["ENTREGADA"],
  ENTREGADA: ["COBRADA"],
  COBRADA: [],
};

// Flujo 2 (entrega solo al cliente): el morral se entrega al mandante sin
// trazabilidad individual, así que la guía se cobra directo desde completada.
export const FLOW_2_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  COMPLETADA: ["COBRADA"],
};

export type DeliveryFlow = "FLUJO_1" | "FLUJO_2";

export const DELIVERY_FLOW_LABELS: Record<DeliveryFlow, string> = {
  FLUJO_1: "Flujo 1 · entrega en habitación",
  FLUJO_2: "Flujo 2 · entrega solo al cliente",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  RECIBIDA: "Recibida",
  EN_REVISION: "En revisión",
  INCOMPLETA: "Incompleta",
  COMPLETADA: "Completada",
  ENTREGADA: "Entregada",
  COBRADA: "Cobrada",
};

export const ORDER_STATUS_BADGE_VARIANT: Record<
  OrderStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  RECIBIDA: "secondary",
  EN_REVISION: "default",
  INCOMPLETA: "destructive",
  COMPLETADA: "outline",
  ENTREGADA: "outline",
  COBRADA: "secondary",
};

// Colores semánticos por estado para las insignias. Cada estado tiene un tono
// distintivo (fondo suave + texto + punto) que se lee de un vistazo en las
// tablas, coherente en modo claro y oscuro.
type StatusColor = { badge: string; dot: string };

export const ORDER_STATUS_COLORS: Record<OrderStatus, StatusColor> = {
  RECIBIDA: {
    badge:
      "bg-slate-100 text-slate-700 ring-slate-600/15 dark:bg-slate-400/10 dark:text-slate-300 dark:ring-slate-400/20",
    dot: "bg-slate-500",
  },
  EN_REVISION: {
    badge:
      "bg-indigo-50 text-indigo-700 ring-indigo-600/15 dark:bg-indigo-400/10 dark:text-indigo-300 dark:ring-indigo-400/20",
    dot: "bg-indigo-500",
  },
  INCOMPLETA: {
    badge:
      "bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20",
    dot: "bg-amber-500",
  },
  COMPLETADA: {
    badge:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20",
    dot: "bg-emerald-500",
  },
  ENTREGADA: {
    badge:
      "bg-teal-50 text-teal-700 ring-teal-600/15 dark:bg-teal-400/10 dark:text-teal-300 dark:ring-teal-400/20",
    dot: "bg-teal-500",
  },
  COBRADA: {
    badge:
      "bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/20",
    dot: "bg-violet-500",
  },
};

// Cómo se resolvió una prenda que faltó al empacar (ver MissingItemResolution
// en el backend): encontrada y pistoleada, o repuesta comprando una nueva.
export const RESOLUTION_TYPE_LABELS: Record<string, string> = {
  ENCONTRADA: "Encontrada",
  COMPRADA: "Comprada",
};

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function validNextStatuses(
  status: string,
  deliveryFlow: string = "FLUJO_1",
): OrderStatus[] {
  if (!isOrderStatus(status)) return [];
  const base = ORDER_STATUS_TRANSITIONS[status];
  if (deliveryFlow !== "FLUJO_2") return base;
  // En Flujo 2 la entrega en habitación no existe: se reemplaza por el cobro.
  const flow2 = FLOW_2_TRANSITIONS[status] ?? [];
  return [...base.filter((next) => next !== "ENTREGADA"), ...flow2];
}
