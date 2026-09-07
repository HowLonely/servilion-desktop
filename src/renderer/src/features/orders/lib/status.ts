// Máquina de estados de la guía (LaundryOrder), replicada exactamente desde
// el backend (orders/models.py OrderStatus). No se inventan transiciones
// nuevas aquí: la validación real de qué transición es válida la hace el
// backend. RECIBIDA cubre desde que se digitaliza la guía hasta el primer
// pistoleo de empaque (no hay un evento físico propio de "en lavado").
//
// INCOMPLETA y COMPLETA son las dos salidas del CIERRE del morral, no del
// despacho: dicen con qué quedó el morral, no dónde está. DESPACHADA es el
// paso siguiente y tiene su propio pistoleo, en el módulo Despacho — aparte
// de la mesa de empaque, que solo abre y cierra.
//
// COBRADA se retiró del flujo: el cobro es un acto administrativo fuera del
// sistema, sin ningún escaneo detrás. ENTREGADA (Flujo 1) y DESPACHADA
// (Flujo 2) son los estados terminales.
export const ORDER_STATUSES = [
  "RECIBIDA",
  "EN_REVISION",
  "INCOMPLETA",
  "COMPLETADA",
  "DESPACHADA",
  "ENTREGADA",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Transiciones que el staff puede declarar a mano con el botón "Marcar como X".
// RECIBIDA -> EN_REVISION, EN_REVISION/INCOMPLETA -> COMPLETADA y
// COMPLETADA/INCOMPLETA -> DESPACHADA no aparecen a propósito: el sistema las
// decide solo, como efecto de digitalizar la guía, de pistolear el empaque, de
// resolver una prenda faltante (encontrada o comprada) y de pistolear la
// boleta de un morral ya cerrado.
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RECIBIDA: [],
  EN_REVISION: [],
  INCOMPLETA: [],
  // Cerrado no es despachado: la entrega cuelga del despacho, no del cierre.
  COMPLETADA: [],
  DESPACHADA: ["ENTREGADA"],
  ENTREGADA: [],
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
  COMPLETADA: "Completa",
  DESPACHADA: "Despachada",
  ENTREGADA: "Entregada",
};

export const ORDER_STATUS_BADGE_VARIANT: Record<
  OrderStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  RECIBIDA: "secondary",
  EN_REVISION: "default",
  INCOMPLETA: "destructive",
  COMPLETADA: "outline",
  DESPACHADA: "outline",
  ENTREGADA: "outline",
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
  DESPACHADA: {
    badge:
      "bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/20",
    dot: "bg-sky-500",
  },
  ENTREGADA: {
    badge:
      "bg-teal-50 text-teal-700 ring-teal-600/15 dark:bg-teal-400/10 dark:text-teal-300 dark:ring-teal-400/20",
    dot: "bg-teal-500",
  },
};

// Cómo se resolvió una prenda que faltó al empacar (ver MissingItemResolution
// en el backend): encontrada y pistoleada, o repuesta comprando una nueva.
export const RESOLUTION_TYPE_LABELS: Record<string, string> = {
  ENCONTRADA: "Encontrada",
  COMPRADA: "Comprada",
};

// Estados desde los que el módulo Despacho puede sacar el morral: cerrado y
// sin despachar todavía (Incompleta/Completa), o ya Despachada con una prenda
// resuelta pendiente de su envío aparte. Espejo de `DISPATCHABLE_STATUSES` en
// orders/services.py — el backend vuelve a validar esto igual, esta lista es
// solo para no dejar pistolear algo que el servidor va a rechazar de todos modos.
export const DISPATCHABLE_ORDER_STATUSES: OrderStatus[] = [
  "INCOMPLETA",
  "COMPLETADA",
  "DESPACHADA",
];

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
  // En Flujo 2 la entrega en habitación no existe, así que DESPACHADA es
  // terminal: no hay transición manual siguiente.
  return base.filter((next) => next !== "ENTREGADA");
}
