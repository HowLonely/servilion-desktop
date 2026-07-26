import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { ConnectionTest, StationConfig } from "@shared/types";

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

  const [test, setTest] = useState<ConnectionTest | null>(null);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!config) return;
    setServerUrl(config.serverUrl);
    setStationName(config.stationName);
    setLaunchAtLogin(config.launchAtLogin);
    setKioskMode(config.kioskMode);
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
          </section>

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
