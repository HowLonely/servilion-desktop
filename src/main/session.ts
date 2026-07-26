import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { app, safeStorage } from "electron";

import { httpJson, httpRequest } from "./api";

import type {
  ApiRequest,
  ApiResponse,
  LoginRequest,
  LoginResult,
  SessionState,
  SessionUser,
} from "../shared/types";

// La sesión vive completa en el proceso main. El renderer solo llega a conocer
// al usuario, nunca los tokens. Es el equivalente de escritorio a la cookie
// httpOnly que usa el panel web para el refresh token.

const SESSION_FILE = "session.enc";

type TokenResponse = {
  access: string;
  refresh: string;
  user: SessionUser;
};

type ErrorResponse = { detail?: string };

let accessToken: string | null = null;
let refreshToken: string | null = null;
let currentUser: SessionUser | null = null;
/** Si la sesión debe sobrevivir al cierre de la app. */
let remember = false;
/** La última renovación falló por red, no porque el token fuera inválido. */
let refreshFailedByNetwork = false;
/** Comparte una única renovación entre peticiones que reciben 401 a la vez. */
let refreshInFlight: Promise<boolean> | null = null;

function sessionPath(): string {
  return join(app.getPath("userData"), SESSION_FILE);
}

// --- Persistencia cifrada del refresh token ---

function persistRefreshToken(token: string): void {
  // Sin cifrado disponible no se guarda nada: es preferible pedir la clave de
  // nuevo que dejar un token de 30 días en texto plano en el disco.
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn("safeStorage no disponible: la sesión no se recordará.");
    return;
  }
  try {
    const encrypted = safeStorage.encryptString(token);
    writeFileSync(sessionPath(), encrypted.toString("base64"), "utf-8");
  } catch (error) {
    console.error("No se pudo guardar la sesión:", error);
  }
}

function readPersistedRefreshToken(): string | null {
  if (!existsSync(sessionPath()) || !safeStorage.isEncryptionAvailable()) {
    return null;
  }
  try {
    const encrypted = Buffer.from(readFileSync(sessionPath(), "utf-8"), "base64");
    return safeStorage.decryptString(encrypted);
  } catch {
    // Token de otro equipo, otra cuenta de Windows, o archivo dañado.
    clearPersistedSession();
    return null;
  }
}

function clearPersistedSession(): void {
  try {
    rmSync(sessionPath(), { force: true });
  } catch {
    // Si no se puede borrar, el token sigue siendo inútil sin la clave del SO.
  }
}

// --- Estado ---

function applyTokens(tokens: TokenResponse): void {
  accessToken = tokens.access;
  refreshToken = tokens.refresh;
  currentUser = tokens.user;
  // El backend emite un refresh nuevo en cada renovación, así que persistirlo
  // cada vez extiende la ventana de 30 días mientras el equipo se use a diario.
  if (remember) persistRefreshToken(tokens.refresh);
}

export function getSessionState(): SessionState {
  return currentUser
    ? { status: "authenticated", user: currentUser }
    : { status: "unauthenticated" };
}

export function isAuthenticated(): boolean {
  return currentUser !== null;
}

// --- Operaciones ---

export async function login(payload: LoginRequest): Promise<LoginResult> {
  const { status, data, offline } = await httpJson<TokenResponse & ErrorResponse>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        username: payload.username,
        password: payload.password,
      }),
    },
  );

  if (offline) {
    return {
      ok: false,
      detail:
        "No hay conexión con el servidor de Servilion. Revisa la red o la dirección del servidor en Ajustes.",
    };
  }

  if (status !== 200 || !data?.access) {
    return { ok: false, detail: data?.detail ?? "Usuario o contraseña incorrectos." };
  }

  remember = payload.rememberSession;
  if (!remember) clearPersistedSession();
  applyTokens(data);

  return { ok: true, user: data.user };
}

export async function logout(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  currentUser = null;
  remember = false;
  clearPersistedSession();
}

/**
 * Intenta reanudar la sesión guardada en este equipo. Es lo primero que corre
 * al arrancar: si funciona, el operador entra directo a su estación sin
 * escribir nada.
 */
export async function restoreSession(): Promise<SessionState> {
  const stored = readPersistedRefreshToken();
  if (!stored) return { status: "unauthenticated" };

  refreshToken = stored;
  remember = true;

  const renewed = await renewTokens();
  if (!renewed) {
    // Solo se descarta el token si el servidor lo rechazó. Si el equipo arrancó
    // antes que la red, `refreshFailedByNetwork` deja la sesión para reintentar.
    if (!refreshFailedByNetwork) {
      await logout();
    }
    return { status: "unauthenticated" };
  }

  return getSessionState();
}

function renewTokens(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = performRenew().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function performRenew(): Promise<boolean> {
  if (!refreshToken) return false;

  const { status, data, offline } = await httpJson<TokenResponse>("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh: refreshToken }),
  });

  refreshFailedByNetwork = offline;

  if (status !== 200 || !data?.access) return false;

  applyTokens(data);
  return true;
}

/**
 * Ejecuta una petición del renderer contra el backend con el token del usuario,
 * renovándolo y reintentando una vez si expiró. El renderer no participa de
 * esto: para él es un `fetch` normal.
 */
export async function authorizedRequest(request: ApiRequest): Promise<ApiResponse> {
  const send = (token: string | null): Promise<ApiResponse> =>
    httpRequest(request.path, {
      method: request.method,
      body: request.body,
      headers: {
        ...request.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  const response = await send(accessToken);
  if (response.status !== 401 || !refreshToken) return response;

  const renewed = await renewTokens();
  if (!renewed) {
    // El refresh también caducó: la sesión murió y hay que volver a la pantalla
    // de login. El renderer lo detecta por el 401 que se le devuelve.
    if (!refreshFailedByNetwork) await logout();
    return response;
  }

  return send(accessToken);
}
