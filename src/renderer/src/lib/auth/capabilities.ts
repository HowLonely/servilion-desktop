import type { SessionUser } from "@shared/types";

/**
 * Qué puede hacer un usuario en esta terminal.
 *
 * La fuente de verdad es el backend: cada rol lleva una lista de permisos que
 * se edita en Configuración → Roles, y `/api/auth/me` devuelve los del usuario
 * (`user.permissions`). Aquí solo se traducen a estaciones. Los códigos son los
 * de `authentication/permissions.py::Perm`; el panel web usa los mismos.
 *
 * Ocultar un botón no es la defensa: el backend exige el mismo permiso en el
 * endpoint. Esto solo evita ofrecer algo que va a responder 403.
 */
export const PERM = {
  weighing: "weighing.operate",
  digitize: "orders.digitize",
  pack: "orders.pack",
  dispatch: "orders.dispatch",
  linenDispatch: "hospitality.dispatch",
  linenView: "hospitality.view",
  history: "history.view",
  catalog: "catalog.manage",
  workers: "workers.manage",
  users: "users.manage",
  sync: "sync.manage",
} as const;

/**
 * Las estaciones de trabajo que ofrece la app de escritorio.
 *
 * Las tres primeras son las de Antofagasta, en el orden en que tocan el morral:
 * la báscula lo pesa y lo etiqueta al llegar sucio, la digitalización pasa la
 * OT física al sistema, y el empaque valida el morral limpio antes de
 * despacharlo.
 *
 * `hospitality` va aparte porque es OTRO servicio, no otra pantalla del mismo:
 * lo que entra es lencería a granel del campamento —sin trabajador, sin
 * habitación y sin entrega individual—.
 *
 * `admin` (Configuración) no es un puesto de planta: es donde se administran
 * usuarios, roles y catálogo sin depender de internet, porque la terminal
 * trabaja contra el servidor local.
 */
export type Station =
  | "weighing"
  | "digitize"
  | "packing"
  | "dispatch"
  | "hospitality"
  | "history"
  | "admin";

export const STATION_LABELS: Record<Station, string> = {
  weighing: "Pesaje y etiquetado",
  digitize: "Digitalizar OT",
  packing: "Empaque y revisión",
  dispatch: "Despacho",
  hospitality: "Lencería de hotelería",
  history: "Consultar histórico",
  admin: "Configuración",
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
  /** Clientes, empresas, prendas, precios, faenas, campamentos y habitaciones. */
  canManageCatalog: boolean;
  /** Usuarios y roles. */
  canManageUsers: boolean;
  /** Estado e incidencias de la sincronización con la nube. */
  canManageSync: boolean;
  /** Estaciones disponibles, en el orden en que se muestran en el menú. */
  stations: Station[];
};

export function hasPermission(user: SessionUser | null, permission: string): boolean {
  return user?.permissions?.includes(permission) ?? false;
}

export function capabilitiesOf(user: SessionUser | null): Capabilities {
  const can = (permission: string): boolean => hasPermission(user, permission);

  const capabilities = {
    canWeigh: can(PERM.weighing),
    canDigitize: can(PERM.digitize),
    canPack: can(PERM.pack),
    canDispatch: can(PERM.dispatch),
    canDispatchLinen: can(PERM.linenDispatch),
    canViewLinen: can(PERM.linenView) || can(PERM.linenDispatch),
    canViewHistory: can(PERM.history) || can(PERM.workers),
    canManageWorkers: can(PERM.workers),
    canManageCatalog: can(PERM.catalog),
    canManageUsers: can(PERM.users),
    canManageSync: can(PERM.sync),
  };

  const stations: Station[] = [];
  if (capabilities.canWeigh) stations.push("weighing");
  if (capabilities.canDigitize) stations.push("digitize");
  if (capabilities.canPack) stations.push("packing");
  if (capabilities.canDispatch) stations.push("dispatch");
  if (capabilities.canViewLinen) stations.push("hospitality");
  if (capabilities.canViewHistory) stations.push("history");
  if (capabilities.canManageUsers || capabilities.canManageCatalog || capabilities.canManageSync) {
    stations.push("admin");
  }

  return { ...capabilities, stations };
}

/** Nombre visible del rol del usuario. */
export function roleLabel(user: SessionUser): string {
  return user.role_name || user.role;
}

export function fullName(user: SessionUser): string {
  const name = `${user.first_name} ${user.last_name}`.trim();
  return name || user.username;
}
