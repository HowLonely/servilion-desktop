import { join } from "node:path";

import { BrowserWindow, app, shell } from "electron";

import { applyLaunchAtLogin, getConfig } from "./config";
import { startHealthMonitor, stopHealthMonitor } from "./health";
import { registerIpcHandlers } from "./ipc";
import { restoreSession } from "./session";

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const config = getConfig();

  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    kiosk: config.kioskMode,
    title: "Servilion Digitalización",
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  // Se muestra recién cuando hay algo pintado, para que el operador no vea un
  // rectángulo blanco al encender el equipo.
  window.once("ready-to-show", () => {
    window.show();
    if (!config.kioskMode) window.maximize();
  });

  // La terminal no navega a ningún lado: cualquier enlace externo se abre en el
  // navegador del sistema y jamás dentro de la app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return window;
}

// Una sola instancia: si el operador hace doble clic en el acceso directo, se
// enfoca la ventana existente en vez de abrir una segunda terminal.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  void app.whenReady().then(async () => {
    applyLaunchAtLogin(getConfig().launchAtLogin);
    registerIpcHandlers(() => mainWindow);

    // Reanudar la sesión ANTES de abrir la ventana evita el parpadeo del login
    // en el caso normal (equipo encendido, operador ya autenticado): cuando el
    // renderer monte y pregunte por `session:get`, la respuesta ya está lista.
    await restoreSession();

    mainWindow = createWindow();
    mainWindow.on("closed", () => {
      mainWindow = null;
      stopHealthMonitor();
    });

    mainWindow.webContents.once("did-finish-load", () => {
      if (mainWindow) startHealthMonitor(mainWindow);
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
