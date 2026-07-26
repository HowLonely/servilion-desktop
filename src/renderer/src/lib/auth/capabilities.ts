import type { SessionUser } from "@shared/types";

/**
 * Qué puede hacer un usuario en esta terminal.
 *
 * La fuente de verdad es el backend. Estos son los roles que `orders/api.py`
 * exige de verdad (`authentication/permissions.py:user_has_role` deja pasar
 * siempre a ADMIN):
 *
 *   POST /api/orders/                        → DIGITADOR_OT, SUPERVISOR
 *   POST /api/orders/{id}/packing/scan       → DIGITADOR_EMPAQUE, SUPERVISOR
 *   POST /api/orders/{id}/packing/finish     → DIGITADOR_EMPAQUE, SUPERVISOR
 *   POST /api/orders/{id}/incomplete/resolve → DIGITADOR_EMPAQUE, SUPERVISOR
 *
 * El equivalente en el panel web es `components/layout/nav-config.ts`. Son dos
 * repositorios distintos, así que la matriz está duplicada a propósito: si
 * cambian los permisos del backend, hay que tocar los dos archivos.
 */
export const DIGITIZE_ROLES = ["ADMIN", "SUPERVISOR", "DIGITADOR_OT"] as const;
export const PACKING_ROLES = ["ADMIN", "SUPERVISOR", "DIGITADOR_EMPAQUE"] as const;

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
  DIGITADOR_OT: "Digitador de OT",
  DIGITADOR_EMPAQUE: "Digitador de Empaque",
};

/** Las dos estaciones de trabajo que ofrece la app de escritorio. */
export type Station = "digitize" | "packing";

export const STATION_LABELS: Record<Station, string> = {
  digitize: "Digitalizar OT",
  packing: "Empaque y revisión",
};

export type Capabilities = {
  canDigitize: boolean;
  canPack: boolean;
  /** Estaciones disponibles, en el orden en que se muestran en el menú. */
  stations: Station[];
};

export function capabilitiesOf(user: SessionUser | null): Capabilities {
  const role = user?.role ?? "";
  const canDigitize = (DIGITIZE_ROLES as readonly string[]).includes(role);
  const canPack = (PACKING_ROLES as readonly string[]).includes(role);

  const stations: Station[] = [];
  if (canDigitize) stations.push("digitize");
  if (canPack) stations.push("packing");

  return { canDigitize, canPack, stations };
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function fullName(user: SessionUser): string {
  const name = `${user.first_name} ${user.last_name}`.trim();
  return name || user.username;
}
