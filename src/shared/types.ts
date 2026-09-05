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
  /**
   * Interfaz para pantalla táctil: objetivos grandes, teclados en pantalla y
   * sin depender de atajos de teclado. Es ajuste del equipo y no del usuario
   * porque lo táctil es el monitor, no la persona: quien se siente en esa
   * terminal la encuentra igual sin importar con qué cuenta entre.
   */
  touchMode: boolean;
  /** Etiquetera: adhesivos por prenda y ticket maestro del pesaje. */
  printer: PrinterConfig;
  /**
   * Impresora de la boleta del morral limpio.
   *
   * Es un slot aparte porque los dos impresos no piden la misma máquina: el
   * adhesivo lavable exige una etiquetera (troquel y adhesivo), mientras que la
   * boleta es un documento y sale mejor —y más barato— de una impresora de
   * boleta ESC/POS. Una estación puede tener las dos colgadas.
   *
   * Con `transport: "none"` la boleta sale por la etiquetera, que es el caso de
   * la estación que solo tiene una impresora.
   */
  receiptPrinter: PrinterConfig;
};

/**
 * Lenguaje de comandos de la impresora. No hay uno solo: hay uno por familia de
 * máquina, y mandar el equivocado no da error —la impresora escupe los comandos
 * como texto, o no hace nada—. Ver `main/printing/index.ts`.
 */
export type PrinterLanguage = "zpl" | "escpos" | "epl";

/**
 * Los lenguajes que la app sabe emitir, con lo que hay que saber para elegir.
 *
 * No se detecta solo: por un socket crudo no hay forma fiable de preguntarle a
 * una impresora qué habla, y adivinar mal gasta un rollo entero sin devolver
 * error. El dato sale del manual o de la etiqueta del equipo.
 */
export const PRINTER_LANGUAGES: {
  value: PrinterLanguage;
  label: string;
  hint: string;
}[] = [
  {
    value: "zpl",
    label: "ZPL (Zebra y compatibles)",
    hint: "Etiqueteras. Zebra, TSC, Godex, Honeywell y la mayoría de las genéricas. Es lo normal para los adhesivos por prenda.",
  },
  {
    value: "escpos",
    label: "ESC/POS (Epson y compatibles)",
    hint: "Impresoras de boleta de 58 u 80 mm. Epson TM, Bixolon, Citizen, Star y clones. No sirve para los adhesivos: el papel no pega.",
  },
  {
    value: "epl",
    label: "EPL2 (Zebra/Eltron antiguas)",
    hint: "Etiqueteras de escritorio previas a ZPL, tipo LP2844. El QR depende del modelo; si no sale, el código igual va impreso en texto.",
  },
];

/**
 * Cómo se llega a la etiquetera. El ZPL se manda **crudo**, sin driver: es lo
 * que garantiza que el adhesivo salga del tamaño exacto y que el código de
 * barras lo genere el firmware de la impresora en vez de rasterizarse.
 *
 * Los tres transportes cubren las tres formas en que una etiquetera está
 * colgada en planta: por red (lo normal en una estación fija), por puerto serie
 * (equipos antiguos) o compartida por Windows.
 */
export type PrinterConfig = {
  transport: "none" | "tcp" | "serial" | "windows";
  /** Qué lenguaje habla: ZPL (Zebra), ESC/POS (Epson) o EPL2 (Eltron). */
  language: PrinterLanguage;
  /** IP o host de la impresora, para `tcp`. */
  host: string;
  /** Puerto TCP; 9100 es el estándar de impresión cruda (RAW/JetDirect). */
  port: number;
  /** Puerto serie (`COM3`) o nombre de la impresora compartida en Windows. */
  device: string;
  /**
   * Ancho del papel en milímetros. En una etiquetera es el ancho del troquel;
   * en una de boleta, el del rollo (58 u 80 mm), del que sale cuántas columnas
   * de texto caben.
   */
  labelWidthMm: number;
  /** Alto de la etiqueta en milímetros. No aplica al papel continuo de boleta. */
  labelHeightMm: number;
  /** Densidad del cabezal: 203 dpi (8 dots/mm) o 300 dpi (12 dots/mm). */
  dpi: 203 | 300;
};

/**
 * Lo que hay que imprimir de un pesaje: espejo de `PrintJobOut` del backend.
 *
 * Viaja como datos y no como ZPL ya armado porque el layout depende del tamaño
 * de etiqueta y de la densidad del cabezal, que son ajustes del equipo y viven
 * en main. El renderer no sabe de milímetros ni de impresoras.
 */
export type WeighPrintJob = {
  reference: string;
  client_name: string;
  company_name: string;
  faena: string;
  is_contractor: boolean;
  garment_count: number;
  weight_kg: number;
  weighed_at: string;
  weighed_by_name: string;
  labels: { sequence: number; code: string }[];
};

/**
 * La boleta del morral limpio: espejo de `ReceiptOut` del backend.
 *
 * Viaja como datos por lo mismo que `WeighPrintJob`: el layout depende del
 * tamaño de etiqueta y de la densidad del cabezal, que son ajustes del equipo.
 *
 * `company_logo_url` no se incluye a propósito. El logo es una imagen remota y
 * la etiquetera recibe ZPL crudo, sin driver que rasterice: meterlo obligaría a
 * descargarlo, convertirlo a mapa de bits y empotrarlo como `^GF` en cada
 * impresión, y el rollo térmico de 50 mm no tiene resolución para que se
 * distinga. Lo que identifica el morral es el ref y el QR, no la marca.
 */
export type ReceiptPrintJob = {
  order_number: string | null;
  reference: string;
  control_code: string;
  ticket_number: string;
  company_name: string;
  faena: string;
  is_contractor: boolean;
  worker_name: string;
  phone: string;
  national_id: string;
  camp: string;
  room: string;
  shift: string;
  weight_kg: number | null;
  garment_count: number;
  promised_at: string | null;
  /** Lo que codifica el QR: es lo que la pistola lee para abrir el morral. */
  qr_payload: string;
  items: { name: string; quantity: number }[];
};

export type PrintResult = { ok: true } | { ok: false; detail: string };

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
