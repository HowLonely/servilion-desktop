import { contextBridge, ipcRenderer } from "electron";

import type {
  ApiRequest,
  ApiResponse,
  ConnectionTest,
  LinenDispatchPrintJob,
  LoginRequest,
  LoginResult,
  PrintResult,
  ReceiptPrintJob,
  ServerStatus,
  SessionState,
  StationConfig,
  StorageUploadRequest,
  StorageUploadResult,
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
    /** Imprime (o reimprime) la guía de despacho de hotelería. */
    linenDispatch: (job: LinenDispatchPrintJob): Promise<PrintResult> =>
      ipcRenderer.invoke("printer:linenDispatch", job),
  },

  storage: {
    /** Sube un archivo a S3 con el POST prefirmado que entregó el backend. */
    upload: (request: StorageUploadRequest): Promise<StorageUploadResult> =>
      ipcRenderer.invoke("storage:upload", request),
  },

  updates: {
    /** Versión nueva ya descargada, o null. */
    pending: (): Promise<string | null> => ipcRenderer.invoke("update:pending"),
    /** Avisa cuando termina de bajar una versión nueva. */
    onReady: (listener: (version: string) => void): (() => void) => {
      const handler = (_event: unknown, version: string): void => listener(version);
      ipcRenderer.on("update:ready", handler);
      return () => ipcRenderer.removeListener("update:ready", handler);
    },
    /** Cierra la app, instala la versión nueva y la vuelve a abrir. */
    install: (): Promise<void> => ipcRenderer.invoke("update:install"),
  },

  app: {
    quit: (): Promise<void> => ipcRenderer.invoke("app:quit"),
  },
};

export type ServilionBridge = typeof servilion;

contextBridge.exposeInMainWorld("servilion", servilion);
