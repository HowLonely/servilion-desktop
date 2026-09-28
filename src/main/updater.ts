import { app, type BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";

// Actualización automática desde los releases de GitHub (ver `publish` en
// electron-builder.yml). Quien mantiene la app publica un release desde su
// casa y cada terminal lo baja sola, sin que nadie pase por la planta.
//
// La terminal está encendida todo el día, así que "se instala al cerrar" no
// alcanza: puede pasar semanas sin cerrarse. Por eso, además de avisar para
// reiniciar cuando convenga, se reinicia sola de madrugada si hay una versión
// descargada. La sesión sobrevive al reinicio (refresh token cifrado).

export const UPDATE_READY_CHANNEL = "update:ready";

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;
const NIGHTLY_RESTART_HOUR = 4;
const NIGHTLY_CHECK_EVERY_MS = 15 * 60 * 1000;

let downloadedVersion: string | null = null;

export function pendingUpdate(): string | null {
  return downloadedVersion;
}

export function installUpdateNow(): void {
  if (downloadedVersion) autoUpdater.quitAndInstall(true, true);
}

export function startAutoUpdates(getWindow: () => BrowserWindow | null): void {
  // En desarrollo no hay instalador que reemplazar.
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-downloaded", (info) => {
    downloadedVersion = info.version;
    getWindow()?.webContents.send(UPDATE_READY_CHANNEL, info.version);
  });
  autoUpdater.on("error", (error) => {
    // Sin internet o GitHub caído: se reintenta en el próximo chequeo. Nunca
    // se le muestra al operador, no es algo que él pueda resolver.
    console.warn("No se pudo buscar actualizaciones:", error.message);
  });

  const check = (): void => {
    autoUpdater.checkForUpdates().catch(() => undefined);
  };
  check();
  setInterval(check, CHECK_EVERY_MS);

  setInterval(() => {
    if (downloadedVersion && new Date().getHours() === NIGHTLY_RESTART_HOUR) installUpdateNow();
  }, NIGHTLY_CHECK_EVERY_MS);
}
