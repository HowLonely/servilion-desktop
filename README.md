# 🖥️ Servilion Desktop — Terminal de digitalización

Aplicación de escritorio (Electron) para los equipos de **digitalización** de Servilion. No es el panel administrativo: hace exactamente dos cosas, y las hace en modo terminal.

| Estación | Qué hace |
|---|---|
| **Digitalizar OT** | Pasar al sistema la OT física de la ropa sucia recibida |
| **Empaque y revisión** | Pistolear cada prenda del morral limpio y validar que esté completo |

La idea es que el operador **encienda el PC y ya esté digitando**: sin navegador, sin escribir una URL, sin contraseña cada mañana y sin un menú de doce opciones que no le sirven.

---

## 🚀 Desarrollo

Requiere el backend corriendo (ver `servilion-backend/README.md`).

```bash
npm install
npm run dev
```

Por defecto apunta a `http://localhost:8000`. Para cambiarlo sin recompilar, usa **Ajustes del equipo** dentro de la app (el engranaje, disponible incluso sin haber iniciado sesión).

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta la app con recarga en caliente |
| `npm run typecheck` | Verifica tipos de main/preload y del renderer |
| `npm run build` | Typecheck + empaquetado a `out/` |
| `npm run build:win` | Instalador `.exe` (NSIS) en `dist/` |
| `npm run gen:api` | Regenera los tipos de la API desde `../servilion-web/openapi.json` |

> Tras cambiar un endpoint en el backend, exporta el `openapi.json` actualizado a `servilion-web/` y corre `npm run gen:api`. Los tipos **no se editan a mano**.

---

## 🔐 Sesión y permisos

### La sesión vive en el proceso main

Todo el HTTP hacia Django sale del proceso **main**, nunca del renderer. Esto no es un detalle de implementación, es el modelo de seguridad:

- **El refresh token jamás cruza al renderer.** Se guarda cifrado con `safeStorage` (DPAPI en Windows) en `userData`. Es el equivalente de escritorio a la cookie `httpOnly` del panel web.
- **No hay CORS.** Node no aplica la política de origen, así que no hace falta tocar `CORS_ALLOWED_ORIGINS` en el backend.
- **La renovación del token es invisible.** Ante un 401, main renueva y reintenta; el renderer solo ve la respuesta buena.

El renderer se comunica por un puente IPC (`window.servilion`) que se disfraza de `fetch`, así que los hooks de datos son **los mismos archivos** que el panel web.

Si `safeStorage` no está disponible, la sesión **no se guarda**: es preferible pedir la contraseña de nuevo que dejar un token de 30 días en texto plano.

### Mantener la sesión iniciada

El login trae marcada la opción **"Mantener la sesión iniciada en este equipo"**. El refresh token dura 30 días y se renueva en cada arranque, así que un equipo de uso diario no vuelve a pedir contraseña. Al arrancar, main reanuda la sesión **antes** de abrir la ventana, para que no se vea el login parpadear.

Para que la terminal arranque sola con Windows, activa **"Iniciar al encender el equipo"** en Ajustes (usa `app.setLoginItemSettings`, que sobrevive a las actualizaciones de la app, a diferencia de un acceso directo en la carpeta de Inicio).

### Qué estación ve cada rol

Se deriva del rol del usuario, respetando **lo que el backend exige de verdad** (`orders/api.py`; ADMIN atraviesa toda restricción):

| Rol | Digitalizar | Empaque | Al abrir la app |
|---|:---:|:---:|---|
| ADMIN | ✅ | ✅ | Menú de selección |
| SUPERVISOR | ✅ | ✅ | Menú de selección |
| DIGITADOR_OT | ✅ | ❌ | Entra directo a Digitalizar |
| DIGITADOR_EMPAQUE | ❌ | ✅ | Entra directo a Empaque |

Con una sola estación disponible se entra directo, que es el caso normal en planta (un PC digitaliza, otro empaca). Con ambas aparece el menú, elegible con las teclas `1` y `2`.

La fuente única en esta app es [`lib/auth/capabilities.ts`](src/renderer/src/lib/auth/capabilities.ts); su equivalente en el panel web es `components/layout/nav-config.ts`. Son repos distintos, así que la matriz está duplicada a propósito: **si cambian los permisos del backend, hay que tocar los dos archivos.**

---

## 🌐 Conectividad

La app **requiere red**. No hay cola offline: lo que hay es que el problema se vea a tiempo.

- Un indicador permanente en la cabecera muestra **Conectado / Sin conexión**, sondeando cada 15 s.
- Los errores se muestran grandes y en castellano, nunca como error técnico.
- Ante una caída, el trabajo digitado **no se pierde**: el formulario queda tal cual para reintentar cuando vuelva la red.

---

## 🏗 Estructura

```text
src/
├─ shared/types.ts     Contrato entre los tres procesos
├─ main/               Proceso principal (dueño de la sesión y del HTTP)
│  ├─ config.ts        Ajustes del equipo → userData/config.json
│  ├─ session.ts       Tokens, cifrado en disco, refresh y reintento
│  ├─ api.ts           Peticiones al backend (sin conocer tokens)
│  ├─ health.ts        Sondeo del servidor
│  └─ ipc.ts           Handlers expuestos al renderer
├─ preload/index.ts    contextBridge → window.servilion
└─ renderer/src/
   ├─ app.tsx          Ruteo: login │ menú │ estación │ ajustes
   ├─ features/        auth · menu · digitize · packing · orders · settings
   ├─ components/      StationShell, indicador de servidor, ui/ (shadcn)
   └─ lib/             api · auth/capabilities · date · utils
```

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. El renderer no tiene acceso a Node ni puede navegar fuera de la app.

### Relación con `servilion-web`

Las dos pantallas se **portaron** del panel web, que ya las tenía diseñadas como terminal de digitación. Se copiaron sin cambios los hooks de datos, las utilidades y los componentes de `ui/`. Los dos cambios de fondo:

1. **Al guardar una OT**, la web navega al detalle de la orden. Aquí aparece una confirmación grande con el ref del morral y **Enter encadena la siguiente OT** — quien digita cien seguidas no debería tocar el mouse.
2. **"Ver OT completa"**, que en la web navega al panel, abre un detalle de **solo lectura** dentro de la app.

Si cambias una de esas pantallas en el panel web, revisa si el cambio aplica también aquí.
