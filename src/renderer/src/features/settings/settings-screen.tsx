import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { PRINTER_LANGUAGES } from "@shared/types";
import type { ConnectionTest, PrinterConfig, StationConfig } from "@shared/types";

// Ejemplo de ruta UNC de una cola compartida, como marcador de posicion.
const WINDOWS_SHARE_EXAMPLE = "\\\\localhost\\ZEBRA";

/**
 * Ajustes propios del equipo, no del usuario: a qué servidor apunta esta
 * terminal, cómo se llama y cómo arranca. Se guardan en el disco del PC
 * (userData), así que el mismo instalador sirve para todas las estaciones.
 */
export function SettingsScreen({
  config,
  onSave,
  onClose,
  onServerChanged,
}: {
  config: StationConfig | null;
  onSave: (patch: Partial<StationConfig>) => Promise<StationConfig>;
  onClose: () => void;
  onServerChanged: () => void;
}) {
  const [serverUrl, setServerUrl] = useState("");
  const [stationName, setStationName] = useState("");
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [kioskMode, setKioskMode] = useState(false);
  const [touchMode, setTouchMode] = useState(false);
  const [printer, setPrinter] = useState<PrinterConfig | null>(null);
  const [receiptPrinter, setReceiptPrinter] = useState<PrinterConfig | null>(null);

  const [test, setTest] = useState<ConnectionTest | null>(null);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!config) return;
    setServerUrl(config.serverUrl);
    setStationName(config.stationName);
    setLaunchAtLogin(config.launchAtLogin);
    setKioskMode(config.kioskMode);
    setTouchMode(config.touchMode);
    setPrinter(config.printer);
    setReceiptPrinter(config.receiptPrinter);
  }, [config]);

  async function handleTest() {
    setTesting(true);
    setTest(await window.servilion.config.test(serverUrl));
    setTesting(false);
  }

  async function handleSave() {
    const serverChanged = config?.serverUrl !== serverUrl.trim().replace(/\/+$/, "");
    await onSave({
      serverUrl,
      stationName: stationName.trim(),
      launchAtLogin,
      kioskMode,
      touchMode,
      ...(printer ? { printer } : {}),
      ...(receiptPrinter ? { receiptPrinter } : {}),
    });
    if (serverChanged) onServerChanged();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="flex h-full flex-col bg-muted/30">
      <header className="flex shrink-0 items-center gap-3 border-b bg-card px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight">Ajustes del equipo</h1>
          <p className="text-sm text-muted-foreground">
            Configuración de esta terminal. No afecta a otros equipos.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar ajustes">
          <X className="size-5" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold tracking-tight">Servidor</h2>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="server-url" className="text-sm font-medium">
                Dirección del servidor Servilion
              </label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="server-url"
                  className="h-12 min-w-64 flex-1 font-mono text-base"
                  placeholder="http://192.168.1.10:8000"
                  value={serverUrl}
                  onChange={(event) => {
                    setServerUrl(event.target.value);
                    setTest(null);
                  }}
                />
                <Button
                  variant="outline"
                  className="h-12"
                  onClick={() => void handleTest()}
                  disabled={testing}
                >
                  {testing && <Loader2 className="size-4 animate-spin" />}
                  Probar conexión
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Es la dirección del backend, no la del panel web.
              </p>
            </div>

            {test && (
              <p
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-base font-medium ${
                  test.ok
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {test.ok ? (
                  <CheckCircle2 className="size-5 shrink-0" />
                ) : (
                  <XCircle className="size-5 shrink-0" />
                )}
                {test.detail}
              </p>
            )}
          </section>

          <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold tracking-tight">Esta terminal</h2>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="station-name" className="text-sm font-medium">
                Nombre del equipo
              </label>
              <Input
                id="station-name"
                className="h-12 text-base"
                placeholder="Digitación 1"
                value={stationName}
                onChange={(event) => setStationName(event.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Solo se muestra en pantalla, para saber en qué equipo se está
                trabajando.
              </p>
            </div>

            <ToggleRow
              checked={launchAtLogin}
              onChange={setLaunchAtLogin}
              title="Iniciar al encender el equipo"
              description="La terminal se abre sola al iniciar sesión en Windows."
            />

            <ToggleRow
              checked={kioskMode}
              onChange={setKioskMode}
              title="Modo kiosco (pantalla completa)"
              description="Ocupa toda la pantalla sin barra de ventana. Para equipos dedicados solo a digitar."
            />

            <ToggleRow
              checked={touchMode}
              onChange={setTouchMode}
              title="Modo pantalla táctil"
              description="Botones y texto más grandes, teclados en pantalla y sin depender de atajos de teclado. Actívalo en los equipos que se operan con el dedo, como la báscula."
            />
          </section>

          {printer && (
            <PrinterSection
              printer={printer}
              onChange={setPrinter}
              slug="labeler"
              title="Etiquetera (adhesivos y ticket de pesaje)"
              description="Los adhesivos lavables solo salen de una etiquetera: se pegan a la prenda y viajan al lavado. Se le envía el lenguaje directo, sin pasar por el driver de Windows, que es lo que hace que el código de barras salga nítido y a escala."
            />
          )}

          {receiptPrinter && (
            <PrinterSection
              printer={receiptPrinter}
              onChange={setReceiptPrinter}
              slug="receipt"
              title="Impresora de boleta (opcional)"
              description="Solo si esta estación tiene una segunda impresora para la boleta del morral. Déjala sin configurar y la boleta sale por la etiquetera."
              fallbackNote="Sin configurar: la boleta se imprime en la etiquetera de arriba."
            />
          )}

          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="text-sm font-medium text-emerald-600">
                Ajustes guardados.
              </span>
            )}
            <Button variant="outline" onClick={onClose}>
              Volver
            </Button>
            <Button onClick={() => void handleSave()}>Guardar ajustes</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Una impresora del equipo. Se usa dos veces: la etiquetera y, si existe, la
 * impresora de boleta.
 *
 * Es ajuste del equipo porque la impresora está físicamente colgada de ESTE PC,
 * y el mismo instalador va a todas las estaciones. Las medidas se piden en
 * milímetros y no en puntos para que quien la configura pueda medir el rollo con
 * una regla en vez de calcular contra el dpi.
 */
function PrinterSection({
  printer,
  onChange,
  slug,
  title,
  description,
  fallbackNote,
}: {
  printer: PrinterConfig;
  onChange: (printer: PrinterConfig) => void;
  /** Prefijo de los `id` del formulario: en la pantalla hay dos secciones. */
  slug: string;
  title: string;
  description: string;
  /** Qué pasa si se deja sin configurar. Solo la impresora opcional lo lleva. */
  fallbackNote?: string;
}) {
  const patch = (values: Partial<PrinterConfig>): void => onChange({ ...printer, ...values });
  const language = PRINTER_LANGUAGES.find((item) => item.value === printer.language);
  // El papel continuo de una impresora de boleta no tiene alto de etiqueta ni
  // troquel que calibrar: preguntar por el alto y el dpi ahí sería pedir un dato
  // que no existe.
  const isLabelPrinter = printer.language !== "escpos";

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${slug}-transport`} className="text-sm font-medium">
          Cómo está conectada
        </label>
        <select
          id={`${slug}-transport`}
          className="h-12 rounded-lg border bg-background px-3 text-base"
          value={printer.transport}
          onChange={(event) =>
            patch({ transport: event.target.value as PrinterConfig["transport"] })
          }
        >
          <option value="none">Sin impresora configurada</option>
          <option value="tcp">Por red (IP)</option>
          <option value="serial">Por puerto serie (COM)</option>
          <option value="windows">Compartida en Windows</option>
        </select>
        {fallbackNote && printer.transport === "none" && (
          <p className="text-sm text-muted-foreground">{fallbackNote}</p>
        )}
      </div>

      {printer.transport !== "none" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${slug}-language`} className="text-sm font-medium">
            Lenguaje de la impresora
          </label>
          <select
            id={`${slug}-language`}
            className="h-12 rounded-lg border bg-background px-3 text-base"
            value={printer.language}
            onChange={(event) =>
              patch({ language: event.target.value as PrinterConfig["language"] })
            }
          >
            {PRINTER_LANGUAGES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {/* No se detecta solo: por un socket crudo no hay forma fiable de
              preguntarle a una impresora qué habla, y adivinar mal gasta rollo
              sin dar error. Sale en el manual o en la etiqueta del equipo. */}
          <p className="text-sm text-muted-foreground">{language?.hint}</p>
        </div>
      )}

      {printer.transport === "tcp" && (
        <div className="flex flex-wrap gap-3">
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <label htmlFor={`${slug}-host`} className="text-sm font-medium">
              Dirección IP
            </label>
            <Input
              id={`${slug}-host`}
              className="h-12 font-mono text-base"
              placeholder="192.168.1.60"
              value={printer.host}
              onChange={(event) => patch({ host: event.target.value })}
            />
          </div>
          <div className="flex w-32 flex-col gap-1.5">
            <label htmlFor={`${slug}-port`} className="text-sm font-medium">
              Puerto
            </label>
            <Input
              id={`${slug}-port`}
              type="number"
              className="h-12 font-mono text-base"
              value={printer.port}
              onChange={(event) => patch({ port: Number(event.target.value) || 9100 })}
            />
          </div>
        </div>
      )}

      {(printer.transport === "serial" || printer.transport === "windows") && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${slug}-device`} className="text-sm font-medium">
            {printer.transport === "serial" ? "Puerto serie" : "Nombre compartido"}
          </label>
          <Input
            id={`${slug}-device`}
            className="h-12 font-mono text-base"
            placeholder={printer.transport === "serial" ? "COM3" : WINDOWS_SHARE_EXAMPLE}
            value={printer.device}
            onChange={(event) => patch({ device: event.target.value })}
          />
          <p className="text-sm text-muted-foreground">
            {printer.transport === "serial"
              ? "El puerto tal cual lo muestra el Administrador de dispositivos."
              : "La cola tiene que estar compartida y configurada como impresora de texto genérico."}
          </p>
        </div>
      )}

      {printer.transport !== "none" && (
        <div className="flex flex-wrap gap-3">
          <div className="flex w-32 flex-col gap-1.5">
            <label htmlFor={`${slug}-labelwidth`} className="text-sm font-medium">
              {isLabelPrinter ? "Ancho (mm)" : "Ancho del rollo (mm)"}
            </label>
            <Input
              id={`${slug}-labelwidth`}
              type="number"
              className="h-12 text-base"
              value={printer.labelWidthMm}
              onChange={(event) => patch({ labelWidthMm: Number(event.target.value) || 50 })}
            />
          </div>
          {isLabelPrinter && (
          <div className="flex w-32 flex-col gap-1.5">
            <label htmlFor={`${slug}-labelheight`} className="text-sm font-medium">
              Alto (mm)
            </label>
            <Input
              id={`${slug}-labelheight`}
              type="number"
              className="h-12 text-base"
              value={printer.labelHeightMm}
              onChange={(event) => patch({ labelHeightMm: Number(event.target.value) || 25 })}
            />
          </div>
          )}
          {isLabelPrinter && (
          <div className="flex w-40 flex-col gap-1.5">
            <label htmlFor={`${slug}-dpi`} className="text-sm font-medium">
              Resolución
            </label>
            <select
              id={`${slug}-dpi`}
              className="h-12 rounded-lg border bg-background px-3 text-base"
              value={printer.dpi}
              onChange={(event) =>
                patch({ dpi: Number(event.target.value) as PrinterConfig["dpi"] })
              }
            >
              <option value={203}>203 dpi</option>
              <option value={300}>300 dpi</option>
            </select>
          </div>
          )}
        </div>
      )}

      {printer.transport !== "none" && (
        <p className="text-sm text-muted-foreground">
          {isLabelPrinter
            ? "El ticket del digitalizador se imprime al doble del alto configurado, porque lleva más información y no se pega a ninguna prenda."
            : "En papel continuo no hay alto de etiqueta: el ancho del rollo (58 u 80 mm) decide cuántas columnas de texto caben, y cada impreso termina con un corte."}
        </p>
      )}
    </section>
  );
}

function ToggleRow({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/40 p-3">
      <input
        type="checkbox"
        className="mt-0.5 size-5 accent-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="text-sm">
        <span className="font-medium">{title}</span>
        <span className="block text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
