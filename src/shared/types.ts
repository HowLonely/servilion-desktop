// Contrato entre el proceso main, el preload y el renderer. Es el único
// módulo que comparten los tres, así que se mantiene sin dependencias.

/** Ajustes del equipo. Viven en `userData/config.json`, no en el bundle. */
export type StationConfig = {
  /** URL base del backend Django, ej. "http://192.168.1.10:8000". */
  serverUrl: string;
  /** Nombre visible de esta terminal, ej. "Digitación 1". Solo informativo. */
  stationName: string;
  /** Arrancar la app al iniciar sesión en Windows. */
  launchAtLogin: boolean;
  /** Pantalla completa sin barra de ventana (terminal dedicada). */
  kioskMode: boolean;
};

/** Espejo de `UserOut` del backend (authentication/schemas.py). */
export type SessionUser = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  phone: string;
  is_active: boolean;
};

export type SessionState =
  | { status: "authenticated"; user: SessionUser }
  | { status: "unauthenticated" };

/** Una petición del renderer al backend, tunelizada por IPC. */
export type ApiRequest = {
  /** Ruta relativa al servidor, ej. "/api/orders/?limit=25". */
  path: string;
  method: string;
  headers: Record<string, string>;
  /** Cuerpo ya serializado, o null. */
  body: string | null;
};

export type ApiResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
  /** true cuando no se pudo contactar al servidor (no es un error HTTP). */
  offline: boolean;
};

export type ServerStatus = "checking" | "online" | "offline";

export type LoginRequest = {
  username: string;
  password: string;
  /** Persiste el refresh token cifrado en disco para no volver a pedir clave. */
  rememberSession: boolean;
};

export type LoginResult =
  | { ok: true; user: SessionUser }
  | { ok: false; detail: string };

/** Resultado de "Probar conexión" en los ajustes. */
export type ConnectionTest = { ok: boolean; detail: string };
