import { contextBridge, ipcRenderer } from "electron";

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

// Superficie mínima expuesta al renderer. No hay `ipcRenderer` suelto ni acceso
// a Node: solo estas operaciones. Los tokens JWT nunca aparecen aquí — el
// renderer pide datos y main decide con qué credenciales viajan.
const servilion = {
  config: {
    get: (): Promise<StationConfig> => ipcRenderer.invoke("config:get"),
    set: (patch: Partial<StationConfig>): Promise<StationConfig> =>
      ipcRenderer.invoke("config:set", patch),
    test: (serverUrl: string): Promise<ConnectionTest> =>
      ipcRenderer.invoke("config:test", serverUrl),
  },

  session: {
    get: (): Promise<SessionState> => ipcRenderer.invoke("session:get"),
    login: (payload: LoginRequest): Promise<LoginResult> =>
      ipcRenderer.invoke("session:login", payload),
    logout: (): Promise<void> => ipcRenderer.invoke("session:logout"),
    /** Avisa cuando la sesión caducó del todo y hay que volver al login. */
    onExpired: (listener: () => void): (() => void) => {
      const handler = (): void => listener();
      ipcRenderer.on("session:expired", handler);
      return () => ipcRenderer.off("session:expired", handler);
    },
  },

  api: {
    request: (request: ApiRequest): Promise<ApiResponse> =>
      ipcRenderer.invoke("api:request", request),
  },

  server: {
    getStatus: (): Promise<ServerStatus> => ipcRenderer.invoke("server:getStatus"),
    check: (): Promise<ServerStatus> => ipcRenderer.invoke("server:check"),
    onStatusChange: (listener: (status: ServerStatus) => void): (() => void) => {
      const handler = (_event: unknown, status: ServerStatus): void => listener(status);
      ipcRenderer.on("server:status", handler);
      return () => ipcRenderer.off("server:status", handler);
    },
  },

  printer: {
    /** Imprime (o reimprime) el juego de etiquetas de un pesaje. */
    weighLabels: (job: WeighPrintJob): Promise<PrintResult> =>
      ipcRenderer.invoke("printer:weighLabels", job),
    /** Imprime (o reimprime) la boleta que acompaña el morral limpio. */
    receipt: (job: ReceiptPrintJob): Promise<PrintResult> =>
      ipcRenderer.invoke("printer:receipt", job),
  },

  app: {
    quit: (): Promise<void> => ipcRenderer.invoke("app:quit"),
  },
};

export type ServilionBridge = typeof servilion;

contextBridge.exposeInMainWorld("servilion", servilion);
