import { app, ipcMain, type BrowserWindow } from "electron";

import { httpRequest } from "./api";
import { getConfig, normalizeServerUrl, setConfig } from "./config";
import { checkNow, getServerStatus, resetStatus } from "./health";
import { printReceipt, printWeighLabels } from "./printer";
import {
  authorizedRequest,
  getSessionState,
  isAuthenticated,
  login,
  logout,
} from "./session";

import type {
  ApiRequest,
  ApiResponse,
  ConnectionTest,
  LoginRequest,
  LoginResult,
  PrintResult,
  ReceiptPrintJob,
  ServerStatus,
  SessionState,
  StationConfig,
  WeighPrintJob,
} from "../shared/types";

export const SESSION_EXPIRED_CHANNEL = "session:expired";

const CONNECTION_TEST_TIMEOUT_MS = 8_000;

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  // --- Ajustes del equipo ---

  ipcMain.handle("config:get", (): StationConfig => getConfig());

  ipcMain.handle(
    "config:set",
    (_event, patch: Partial<StationConfig>): StationConfig => {
      const previousServer = getConfig().serverUrl;
      const next = setConfig(patch);

      const window = getWindow();
      if (next.serverUrl !== previousServer) {
        resetStatus();
        void checkNow(window);
      }
      if (patch.kioskMode !== undefined && window) {
        window.setKiosk(patch.kioskMode);
      }
      return next;
    },
  );

  ipcMain.handle(
    "config:test",
    async (_event, serverUrl: string): Promise<ConnectionTest> => {
      const target = normalizeServerUrl(serverUrl);
      if (!/^https?:\/\/.+/i.test(target)) {
        return {
          ok: false,
          detail: "La dirección debe empezar con http:// o https://",
        };
      }

      const response = await httpRequest("/api/docs", {
        serverUrl: target,
        timeoutMs: CONNECTION_TEST_TIMEOUT_MS,
      });

      if (response.offline) {
        return {
          ok: false,
          detail: "No se pudo contactar al servidor en esa dirección.",
        };
      }
      if (response.status >= 400) {
        return {
          ok: false,
          detail: `El servidor respondió ${response.status}. Revisa la dirección.`,
        };
      }
      return { ok: true, detail: "Conexión correcta con el servidor." };
    },
  );

  // --- Sesión ---

  ipcMain.handle("session:get", (): SessionState => getSessionState());

  ipcMain.handle(
    "session:login",
    async (_event, payload: LoginRequest): Promise<LoginResult> => {
      const result = await login(payload);
      if (result.ok) void checkNow(getWindow());
      return result;
    },
  );

  ipcMain.handle("session:logout", async (): Promise<void> => {
    await logout();
  });

  // --- Puente HTTP hacia Django ---

  ipcMain.handle("api:request", async (_event, request: ApiRequest): Promise<ApiResponse> => {
    const wasAuthenticated = isAuthenticated();
    const response = await authorizedRequest(request);

    // Si el refresh token también caducó, la sesión se cerró dentro de
    // `authorizedRequest`. El renderer necesita saberlo para volver al login
    // en vez de quedarse mostrando errores 401 en bucle.
    if (wasAuthenticated && !isAuthenticated()) {
      getWindow()?.webContents.send(SESSION_EXPIRED_CHANNEL);
    }
    return response;
  });

  // --- Estado del servidor ---

  ipcMain.handle("server:getStatus", (): ServerStatus => getServerStatus());
  ipcMain.handle("server:check", (): Promise<ServerStatus> => checkNow(getWindow()));

  // --- Impresora de etiquetas ---

  ipcMain.handle(
    "printer:weighLabels",
    (_event, job: WeighPrintJob): Promise<PrintResult> => printWeighLabels(job),
  );

  ipcMain.handle(
    "printer:receipt",
    (_event, job: ReceiptPrintJob): Promise<PrintResult> => printReceipt(job),
  );

  // --- Ventana ---

  ipcMain.handle("app:quit", (): void => {
    app.quit();
  });
}
