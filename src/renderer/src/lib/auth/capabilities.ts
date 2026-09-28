import type { SessionUser } from "@shared/types";

/**
 * Qué puede hacer un usuario en esta terminal.
 *
 * La fuente de verdad es el backend. Estos son los roles que `orders/api.py`
 * exige de verdad (`authentication/permissions.py:user_has_role` deja pasar
 * siempre a ADMIN):
 *
 *   POST /api/weighing/                      → PESAJE, SUPERVISOR
 *   POST /api/weighing/{id}/void             → PESAJE, SUPERVISOR
 *   POST /api/orders/                        → DIGITADOR_OT, SUPERVISOR
 *   POST /api/orders/{id}/packing/scan       → DIGITADOR_EMPAQUE, SUPERVISOR
 *   POST /api/orders/{id}/packing/finish     → DIGITADOR_EMPAQUE, SUPERVISOR
 *   POST /api/orders/{id}/dispatch           → DIGITADOR_EMPAQUE, SUPERVISOR
 *   POST /api/orders/{id}/incomplete/resolve → DIGITADOR_EMPAQUE, SUPERVISOR
 *   POST /api/hospitality/dispatches         → DIGITADOR_EMPAQUE
 *   GET  /api/hospitality/balances           → cualquier usuario autenticado
 *
 * El equivalente en el panel web es `components/layout/nav-config.ts`. Son dos
 * repositorios distintos, así que la matriz está duplicada a propósito: si
 * cambian los permisos del backend, hay que tocar los dos archivos.
 */
export const WEIGHING_ROLES = ["ADMIN", "SUPERVISOR", "PESAJE"] as const;
export const DIGITIZE_ROLES = ["ADMIN", "SUPERVISOR", "DIGITADOR_OT"] as const;
export const PACKING_ROLES = ["ADMIN", "SUPERVISOR", "DIGITADOR_EMPAQUE"] as const;
// Mismos roles que empaque: el backend exige lo mismo para /dispatch que para
// /scan/packing, aunque viven en módulos distintos de esta terminal.
export const DISPATCH_ROLES = ["ADMIN", "SUPERVISOR", "DIGITADOR_EMPAQUE"] as const;

// Hotelería es un stock rotativo: de la planta solo sale el despacho de lencería
// limpia hacia la faena, y lo hace el mismo puesto que despacha los morrales.
// El reparto y el retiro ocurren en faena (app móvil) y el conteo de inventario
// es del administrador en la web. El supervisor entra solo a consultar saldos.
export const LINEN_DISPATCH_ROLES = ["ADMIN", "DIGITADOR_EMPAQUE"] as const;
export const LINEN_VIEW_ROLES = ["ADMIN", "SUPERVISOR", "DIGITADOR_EMPAQUE"] as const;

// Consulta de histórico: guías y trabajadores. DIGITADOR_EMPAQUE y PESAJE
// quedan fuera a propósito — su trabajo empieza y termina en el morral que
// tienen al frente, no en navegar el histórico completo de la operación.
export const HISTORY_ROLES = ["ADMIN", "SUPERVISOR", "DIGITADOR_OT"] as const;

// Crear, editar y desactivar trabajadores es catálogo, y el catálogo es lo
// único que separa a ADMIN de SUPERVISOR en todo el sistema (ver USUARIOS.md
// §2). Los demás roles de HISTORY_ROLES solo consultan.
export const WORKER_MANAGE_ROLES = ["ADMIN"] as const;

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
  PESAJE: "Pesaje",
  DIGITADOR_OT: "Digitador de OT",
  DIGITADOR_EMPAQUE: "Digitador de Empaque",
};

/**
 * Las estaciones de trabajo que ofrece la app de escritorio.
 *
 * Las tres primeras son las de Antofagasta, en el orden en que tocan el morral:
 * la báscula lo pesa y lo etiqueta al llegar sucio, la digitalización pasa la
 * OT física al sistema, y el empaque valida el morral limpio antes de
 * despacharlo.
 *
 * `hospitality` va aparte y al final porque es OTRO servicio, no otra pantalla
 * del mismo: lo que entra es lencería a granel del campamento —sin trabajador,
 * sin habitación y sin entrega individual— y separarla evita que alguien
 * registre sábanas como si fueran la ropa de una persona, que es exactamente lo
 * que hacía el sistema antiguo.
 */
export type Station =
  | "weighing"
  | "digitize"
  | "packing"
  | "dispatch"
  | "hospitality"
  | "history";

export const STATION_LABELS: Record<Station, string> = {
  weighing: "Pesaje y etiquetado",
  digitize: "Digitalizar OT",
  packing: "Empaque y revisión",
  dispatch: "Despacho",
  hospitality: "Lencería de hotelería",
  history: "Consultar histórico",
};

export type Capabilities = {
  canWeigh: boolean;
  canDigitize: boolean;
  canPack: boolean;
  /** Despachar a faena un morral ya cerrado (Completo o Incompleto). */
  canDispatch: boolean;
  /** Despachar lencería limpia de la planta a la faena de un cliente de hotelería. */
  canDispatchLinen: boolean;
  /** Consultar los saldos de lencería por campamento. */
  canViewLinen: boolean;
  /** Consultar el histórico de guías y trabajadores. */
  canViewHistory: boolean;
  /** Crear, editar y desactivar trabajadores. Sin esto, solo se consulta. */
  canManageWorkers: boolean;
  /** Estaciones disponibles, en el orden en que se muestran en el menú. */
  stations: Station[];
};

export function capabilitiesOf(user: SessionUser | null): Capabilities {
  const role = user?.role ?? "";
  const canWeigh = (WEIGHING_ROLES as readonly string[]).includes(role);
  const canDigitize = (DIGITIZE_ROLES as readonly string[]).includes(role);
  const canPack = (PACKING_ROLES as readonly string[]).includes(role);
  const canDispatch = (DISPATCH_ROLES as readonly string[]).includes(role);
  const canDispatchLinen = (LINEN_DISPATCH_ROLES as readonly string[]).includes(role);
  const canViewLinen = (LINEN_VIEW_ROLES as readonly string[]).includes(role);
  const canViewHistory = (HISTORY_ROLES as readonly string[]).includes(role);
  const canManageWorkers = (WORKER_MANAGE_ROLES as readonly string[]).includes(role);

  const stations: Station[] = [];
  if (canWeigh) stations.push("weighing");
  if (canDigitize) stations.push("digitize");
  if (canPack) stations.push("packing");
  if (canDispatch) stations.push("dispatch");
  if (canViewLinen) stations.push("hospitality");
  if (canViewHistory) stations.push("history");

  return {
    canWeigh,
    canDigitize,
    canPack,
    canDispatch,
    canDispatchLinen,
    canViewLinen,
    canViewHistory,
    canManageWorkers,
    stations,
  };
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function fullName(user: SessionUser): string {
  const name = `${user.first_name} ${user.last_name}`.trim();
  return name || user.username;
}
