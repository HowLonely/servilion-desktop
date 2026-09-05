# 🖥️ Servilion Desktop — Terminal de planta

Aplicación de escritorio (Electron) para los equipos de planta de Servilion. No es el panel administrativo: hace exactamente cinco cosas, y las hace en modo terminal.

Las tres primeras son las tres estaciones de Antofagasta, en el orden en que tocan el morral:

| Estación | Qué hace |
|---|---|
| **Pesaje y etiquetado** | Pesar el morral de ropa sucia al llegar e imprimir sus etiquetas |
| **Digitalizar OT** | Pasar al sistema la OT física que viene con ese morral |
| **Empaque y revisión** | Pistolear el morral limpio, cerrarlo, despacharlo e imprimir su boleta |

La cuarta va aparte porque es **otro servicio**, no otra pantalla del mismo:

| Estación | Qué hace |
|---|---|
| **Lencería de hotelería** | Recibir la carga a granel del campamento y contar su salida para medir la merma |

Y la quinta no es un puesto físico —nadie hace turno ahí—, pero resuelve la misma necesidad que las otras: no tener que abrir el panel web para una duda que aparece a mitad de un turno.

| Estación | Qué hace |
|---|---|
| **Consultar histórico** | Buscar guías y trabajadores con los mismos filtros del panel web |

La idea es que el operador **encienda el PC y ya esté trabajando**: sin navegador, sin escribir una URL, sin contraseña cada mañana y sin un menú de doce opciones que no le sirven.

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

| Rol | Pesaje | Digitalizar | Empaque | Hotelería | Histórico | Al abrir la app |
|---|:---:|:---:|:---:|:---:|:---:|---|
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ + edita | Menú de selección |
| SUPERVISOR | ✅ | ✅ | ✅ | ✅ | ✅ consulta | Menú de selección |
| PESAJE | ✅ | ❌ | ❌ | ❌ | ❌ | Entra directo a Pesaje |
| DIGITADOR_OT | ❌ | ✅ | ❌ | ✅ recibir | ✅ consulta | Menú de selección |
| DIGITADOR_EMPAQUE | ❌ | ❌ | ✅ | ✅ contar | ❌ | Menú de selección |

Hotelería reparte sus momentos entre los mismos puestos que el morral —recibir la carga es del digitador de OT, contar la salida es del de empaque, y el despacho del lote queda en el supervisor porque fija la merma definitiva—, así que la estación aparece para los dos y cada uno ve solo su mitad.

Con una sola estación disponible se entra directo; con varias aparece el menú, elegible con las teclas numéricas o tocando la tarjeta. Desde que existe hotelería el único que entra directo es `PESAJE`: los digitadores tienen además su mitad del lote, y en una planta que no lava lencería ese menú de dos tarjetas es el precio de no esconderles la estación.

El histórico es de consulta para todos salvo ADMIN, que además crea, edita y desactiva trabajadores: el catálogo es lo único que separa a ADMIN de SUPERVISOR en todo el sistema (`USUARIOS.md` §2), y el backend lo exige igual —`POST/PUT/DELETE /api/workers/` van con `@require_admin()`—, así que ocultar los botones no es la defensa, solo evita ofrecer un 403.

La fuente única en esta app es [`lib/auth/capabilities.ts`](src/renderer/src/lib/auth/capabilities.ts); su equivalente en el panel web es `components/layout/nav-config.ts`. Son repos distintos, así que la matriz está duplicada a propósito: **si cambian los permisos del backend, hay que tocar los dos archivos.**

---

## ⚖️ Pesaje: qué hace y por qué manda

La báscula es el **primer** touchpoint del sistema: ocurre antes de digitalizar, cuando todavía no se sabe quién es el trabajador (eso viene escrito en la OT física). El operador declara cuatro cosas —cliente, empresa, cuántas prendas y cuánto pesa— y el sistema hace lo demás.

De ahí salen dos consecuencias que atraviesan toda la app:

**1. El `ref` nace aquí, no al digitalizar.** El pesaje emite `P1375A` y lo imprime en los adhesivos que se pegan a cada prenda. Cuando la digitalización consume ese pesaje, la guía **hereda** ese ref en vez de generar otro: el código que viaja pegado a la ropa tiene que ser el mismo que usa el resto del flujo. La contrapartida asumida es que un pesaje anulado quema su correlativo.

**2. Las etiquetas son por unidad, no por tipo.** En la báscula solo se sabe el total de prendas, no de qué tipo es cada una, así que el adhesivo identifica una prenda física (`P1375A-03`) y no un tipo (`P1375A-TOA`). Eso cierra un agujero del esquema anterior: antes se podía pistolear cuatro veces la MISMA polera y el sistema daba por vueltas las cuatro.

Se imprime **un adhesivo por prenda más un ticket maestro** con el ref, el cliente, la empresa, la faena, las prendas, el peso y quién pesó. El maestro es lo único que ve el digitalizador, y sale último para quedar arriba en la pila.

### La mesa de empaque tiene un solo escáner

No hay que elegir modo en pantalla: se pistolea al mismo input y el backend deduce qué toca según en qué estado está la guía (`POST /api/orders/scan/packing`). La boleta del morral se dispara tres veces a lo largo del empaque y el despacho:

| Disparo | Qué hace | Estado resultante |
|---|---|---|
| 1º | Abre el morral | `EN_REVISION` |
| 2º | **Cierra** el morral: valida lo pistoleado | `COMPLETADA` o `INCOMPLETA` |
| 3º | **Despacha** el morral: sale de planta | `DESPACHADA` |
| 4º+ | **Despacha una prenda** que apareció después, en envío aparte | `DESPACHADA` (no cambia) |

Cerrar no es despachar: entre el 2º y el 3º disparo el morral está cerrado pero sigue en el andén, y esa espera es medible. La etiqueta lavable de una prenda no se confunde con la boleta porque trae separador (`P1005-TOA`): abre el morral si hacía falta y marca la prenda en el mismo disparo.

Los botones de cerrar y despachar siguen ahí, para el equipo cuya pistola se cayó. Lo que se sacó es el paso previo de "abrir morral" con un input aparte, que además resolvía el código a la guía **más reciente**: como el `ref` se reinicia cada semana, eso podía abrir el morral equivocado en silencio. Ahora el backend responde 409 con las guías candidatas y la pantalla pide elegir por trabajador y empresa, que es lo que el operador tiene al frente.

### El empaque tiene dos modos

Conviven, y los decide el backend según si la guía viene de un pesaje (`progress.mode`):

| Modo | Cuándo | Qué se pistolea | Qué dice al faltar algo |
|---|---|---|---|
| `unidad` | La guía viene de un pesaje | Cada adhesivo, una sola vez | "falta la 05" |
| `tipo` | La guía se digitalizó sin báscula | El código del tipo, tantas veces como unidades vuelvan | "faltan 2 poleras" |

En modo unidad el detalle por tipo se sigue mostrando: es lo único que permite deducir **qué** era la unidad que falta, porque el adhesivo no lo dice.

### El pesaje es opcional a propósito

Una OT puede digitalizarse sin haber pasado por la báscula: el campo del ticket en Digitalizar OT se puede dejar vacío y la guía genera su propio ref, y con él las etiquetas por tipo de prenda (`P1005-TOA`). Es la excepción —equipo caído, morral traspapelado, transición— pero tiene que existir: si el pesaje fuera obligatorio, una etiquetera atascada detendría la planta entera.

Esas etiquetas por tipo **esta terminal no las imprime**: se sacan del panel web (`/orders/{id}/labels`), que las arma como pliego para una impresora de hojas. Aquí sale lo que necesita el rollo térmico —los adhesivos por unidad del pesaje y la boleta del morral—, y agregar el pliego a la etiquetera solo tendría sentido si la excepción dejara de serlo.

### Corregir un pesaje

Desde **Pesajes del turno** se puede reimprimir el juego de etiquetas, o anular el pesaje **mientras nadie lo haya digitalizado**. Anular no borra: el morral se pesó de verdad y sus adhesivos pueden andar pegados a la ropa. Una vez digitalizado, el peso y las prendas se corrigen desde la guía, no desde la báscula.

Si al contar las prendas el digitador no coincide con la báscula, **manda el digitador**: la guía queda con el conteo real, el pesaje conserva el suyo y la diferencia queda visible en pantalla.

---

## 🖐 Modo táctil e impresora

Los dos son **ajustes del equipo** (Ajustes → engranaje), no del usuario, y viven en `userData/config.json` junto al resto.

**Modo pantalla táctil** agranda objetivos a 44 px, sube la escala tipográfica y activa los teclados en pantalla, en todas las estaciones. Es del equipo porque lo táctil es el monitor, no la persona: quien se siente en esa terminal la encuentra igual sin importar con qué cuenta entre. Lo puramente visual se resuelve en `index.css` bajo `html[data-touch="true"]`; lo que cambia de comportamiento se consulta con `useTouchMode()`.

**Impresoras**: se les manda el **lenguaje crudo**, sin pasar por el driver de Windows. No es capricho — el driver rasteriza a mapa de bits y en un adhesivo de 50 mm el código de barras sale con los módulos desalineados, así que la pistola falla a la primera pasada. Emitiendo comandos, el código lo dibuja el firmware con la geometría exacta.

Cada estación configura **hasta dos impresoras**, porque los dos impresos no piden la misma máquina:

| Slot | Para qué | Máquina típica |
|---|---|---|
| **Etiquetera** | Adhesivos lavables por prenda y ticket maestro del pesaje | Etiquetera de rollo troquelado |
| **Impresora de boleta** *(opcional)* | La boleta del morral limpio | Impresora de boleta de 58/80 mm |

Si la segunda queda sin configurar, la boleta sale por la etiquetera. Un adhesivo lavable, en cambio, **solo** puede salir de una etiquetera: se pega a la prenda y viaja al lavado.

| Ajuste | Para qué |
|---|---|
| **Por red (IP)** | Lo normal en una estación fija. Puerto 9100 (RAW/JetDirect) |
| **Por puerto serie** | Equipos antiguos. Se abre `COM3` como archivo, sin módulo nativo |
| **Compartida en Windows** | Copia binaria al recurso compartido; la cola debe ser "texto genérico" |
| **Lenguaje** | ZPL, ESC/POS o EPL2 — ver abajo |
| **Ancho / alto / dpi** | En milímetros, para medir el rollo con una regla en vez de calcular puntos |

### Los tres lenguajes

No hay un estándar único de impresora: hay uno por familia de máquina. Mandar el equivocado **no da error** — la impresora escupe los comandos como texto, o no hace nada —, así que es un ajuste del equipo y no una detección automática: por un socket crudo no hay forma fiable de preguntarle a una impresora qué habla, y adivinar mal gasta un rollo.

| Lenguaje | De quién es | Máquinas | Notas |
|---|---|---|---|
| **ZPL** | Zebra | Zebra, TSC, Godex, Honeywell y la mayoría de las genéricas | El de facto de las etiqueteras. Es el que asume la app por defecto |
| **ESC/POS** | Epson (*Epson Standard Code for POS*) | Epson TM, Bixolon, Citizen, Star y clones | El de facto de las impresoras de boleta. El QR vive en el grupo `GS ( k`, que los modelos viejos no implementan: si falta, el símbolo no sale y el código igual queda impreso en texto grande |
| **EPL2** | Eltron, que Zebra compró | Etiqueteras de escritorio previas a ZPL, tipo LP2844 | **EPL no es Epson**, aunque suenen igual: es la confusión más común del tema. Su soporte de QR depende del firmware del modelo |

Los adhesivos por prenda se emiten igual en los tres, pero en ESC/POS salen en papel de boleta, cada código en su trozo cortado. Es lo más cerca del adhesivo que ese papel puede estar; sirve para no quedarse sin nada si el equipo está mal configurado, no como forma de trabajar.

El layout ([`main/printing/`](src/main/printing/)) está separado del transporte ([`main/printer.ts`](src/main/printer.ts)) a propósito: lo primero es lógica pura y probable sin Electron, lo segundo toca sockets y el spooler. Dentro de `printing/` hay un archivo por lenguaje y ninguno conoce a los otros, así que agregar un cuarto es un archivo nuevo más dos líneas en el despachador. El texto se translitera a ASCII en [`printing/text.ts`](src/main/printing/text.ts), compartido por los tres, porque cualquier byte sobre 127 lo dibuja la impresora con su propia tabla y "PEÑÓN" saldría con símbolos raros.

De estas impresoras salen dos cosas:

| Impreso | Cuándo | Qué lleva |
|---|---|---|
| **Adhesivos del pesaje + ticket maestro** | Al pesar el morral sucio | Un código de barras por prenda física, y el maestro con ref, cliente, empresa, faena, prendas, peso y quién pesó |
| **Boleta del morral** | Al cerrar el empaque, y reimprimible mientras la guía siga cerrada. Sale por la impresora de boleta si la estación tiene una, o por la etiquetera | Ref en grande, código de barras para pistolear el cierre y el despacho, QR del código de entrega, destino, OT, control, prendas, peso y detalle declarado |

La boleta lleva **dos códigos y no uno** porque sirven a dos puestos distintos: el de barras es el que pistolea el empaque para cerrar y despachar el morral, y el QR es el que lee la app de terreno al entregar en la habitación (`qr_payload`, el RUT del trabajador). El de barras prefiere el código de control —el que el flujo llama "el código de la boleta"— y cae al ref si viene vacío o con guion, porque ese carácter es el separador que distingue una etiqueta de prenda de la boleta. Va sin el logo de la empresa: es una imagen remota que habría que rasterizar y empotrar como `^GF` en cada impresión, y en 50 mm de rollo térmico no se distingue.

Que falle la impresora **no invalida el trabajo**: el morral ya quedó guardado en el servidor, las etiquetas se reimprimen desde la lista del turno y la boleta desde el mismo botón. Confundir "no imprimió" con "no se pesó" haría que el operador pesara dos veces el mismo morral y quemara un ref.

---

## 🔎 Consultar histórico

Las cuatro estaciones anteriores trabajan sobre el morral que está al frente. Esta es la excepción: sirve para la pregunta que aparece a mitad de turno —"¿esta OT ya se despachó?", "¿en qué pieza vive este trabajador?"— y que antes obligaba a abrir el panel web en otro equipo.

| Pestaña | Qué trae |
|---|---|
| **Órdenes de trabajo** | Listado paginado con los mismos filtros del panel web: búsqueda por OT, ref, control, RUT o nombre; empresa, estado y rango de fechas. Al tocar una fila abre el detalle de solo lectura, el mismo componente que usa el empaque para "Ver OT completa" |
| **Trabajadores** | Listado por empresa y estado (activos, inactivos, todos), con búsqueda por nombre o código |

El rango de fechas arranca en los últimos 30 días y no en "todo": el histórico legado ronda las 280.000 guías (`orders/services.py::list_orders`), así que un listado sin ventana de fecha no es viable ni con los demás filtros vacíos.

**ADMIN además administra trabajadores** desde acá: crear, editar y desactivar, con el mismo formulario del panel web —empresa, código, nombre, RUN, campamento y habitación, turno, cargo, área y teléfono—. El selector de habitación va en dos pasos (campamento y después pieza) porque un campamento tiene cientos de piezas y el número 101 de uno no es el 101 de otro.

Lo que **no** está acá y sigue siendo del panel web: clientes, empresas, prendas, campamentos, precios y reportería. La terminal consulta lo que se necesita en planta; el catálogo completo se administra sentado.

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
│  ├─ printing/        Layout por lenguaje (lógica pura, sin Electron)
│  │  ├─ text.ts       ASCII, medidas y fechas: compartido por los tres
│  │  ├─ zpl.ts        Zebra y compatibles
│  │  ├─ escpos.ts     Epson y compatibles
│  │  ├─ epl.ts        Eltron/Zebra antiguas
│  │  └─ index.ts      Despacho según el lenguaje configurado
│  ├─ printer.ts       Transporte a la impresora (TCP · serie · Windows)
│  └─ ipc.ts           Handlers expuestos al renderer
├─ preload/index.ts    contextBridge → window.servilion
└─ renderer/src/
   ├─ app.tsx          Ruteo: login │ menú │ estación │ ajustes
   ├─ features/        auth · menu · weighing · digitize · packing · hospitality
   │                   history · orders · garments · companies · camps
   │                   workers · settings
   ├─ components/      StationShell, teclado numérico, indicador de servidor, ui/
   └─ lib/             api · auth/capabilities · date · use-touch-mode · utils
```

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. El renderer no tiene acceso a Node ni puede navegar fuera de la app.

### Relación con `servilion-web`

Digitalizar, empaque y hotelería se **portaron** del panel web, que ya las tenía diseñadas como terminal. Se copiaron sin cambios los hooks de datos, las utilidades y los componentes de `ui/`. Los cambios de fondo:

La estación de **pesaje no tiene equivalente en el panel web**: nació aquí, porque solo existe en la planta de Antofagasta y solo se opera en una pantalla táctil.

1. **Al guardar una OT**, la web navega al detalle de la orden. Aquí aparece una confirmación grande con el ref del morral y **Enter encadena la siguiente OT** — quien digita cien seguidas no debería tocar el mouse.
2. **"Ver OT completa"**, que en la web navega al panel, abre un detalle de **solo lectura** dentro de la app.
3. **La boleta** la imprime esta terminal por la etiquetera; la web la muestra como hoja para imprimir por navegador.
4. **Hotelería** llega recortada a lo que se hace de pie en la planta: recibir la carga y contar la salida. El listado histórico, la merma acumulada y el acta de devolución (`/hospitality/{id}/note`) siguen siendo del panel web, que es donde se consultan sentado.

Si cambias una de esas pantallas en el panel web, revisa si el cambio aplica también aquí.
