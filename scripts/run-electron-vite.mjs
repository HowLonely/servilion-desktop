import { spawn } from "node:child_process";
import path from "node:path";

// Las terminales integradas de VS Code exportan ELECTRON_RUN_AS_NODE=1 (VS Code
// es a su vez una app Electron). Heredarla hace que nuestro Electron arranque
// como Node puro: `require("electron")` devuelve una ruta en vez de la API, y el
// proceso main revienta con "Cannot read properties of undefined (reading 'app')".
//
// Lanzar electron-vite desde aquí, con la variable quitada, hace que `npm run
// dev` funcione igual desde VS Code que desde una terminal normal.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const electronViteCommand = process.platform === "win32"
  ? path.join(process.cwd(), "node_modules", ".bin", "electron-vite.cmd")
  : path.join(process.cwd(), "node_modules", ".bin", "electron-vite");

// Con shell:true en Windows, Node solo envuelve en comillas el comando+args ya
// unidos en un solo string, no cada token por separado — así que una ruta con
// espacios (como esta, dentro de "Proyecto Servilion") rompe el parseo de
// cmd.exe en el primer espacio a menos que la citemos nosotros mismos aquí.
const quotedCommand = process.platform === "win32"
  ? `"${electronViteCommand}"`
  : electronViteCommand;

const child = spawn(quotedCommand, process.argv.slice(2), {
  env,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
