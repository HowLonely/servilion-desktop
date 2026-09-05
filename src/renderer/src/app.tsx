import { useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/sonner";
import { LoginScreen } from "@/features/auth/login-screen";
import { DigitizeStation } from "@/features/digitize/digitize-station";
import { HistoryStation } from "@/features/history/history-station";
import { HospitalityStation } from "@/features/hospitality/hospitality-station";
import { StationMenu } from "@/features/menu/station-menu";
import { NoStationScreen } from "@/features/menu/no-station-screen";
import { PackingStation } from "@/features/packing/packing-station";
import { SettingsScreen } from "@/features/settings/settings-screen";
import { WeighingStation } from "@/features/weighing/weighing-station";
import { SessionProvider, useSession } from "@/lib/auth/session-provider";
import { makeQueryClient } from "@/lib/query-client";
import { useServerStatus } from "@/lib/use-server-status";
import { useStationConfig } from "@/lib/use-station-config";
import { TouchModeProvider } from "@/lib/use-touch-mode";

import type { Station } from "@/lib/auth/capabilities";
import type { StationConfig } from "@shared/types";

const queryClient = makeQueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <AppRouter />
      </SessionProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

/**
 * Ruteo de la terminal. Nueve pantallas y ninguna URL: un kiosco no navega, así
 * que un router completo sería peso muerto.
 */
function AppRouter() {
  const { config, update } = useStationConfig();

  // El modo tactil envuelve TODAS las pantallas, login y ajustes incluidos: lo
  // tactil es el monitor, asi que la terminal ya lo es antes de que nadie
  // inicie sesion.
  return (
    <TouchModeProvider enabled={config?.touchMode ?? false}>
      <Screens config={config} onSaveConfig={update} />
    </TouchModeProvider>
  );
}

function Screens({
  config,
  onSaveConfig,
}: {
  config: StationConfig | null;
  onSaveConfig: (patch: Partial<StationConfig>) => Promise<StationConfig>;
}) {
  const { status, user, capabilities } = useSession();
  const { status: serverStatus, recheck } = useServerStatus();

  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Al cambiar de operador se vuelve a empezar: la estación elegida por el
  // turno anterior no debe arrastrarse al siguiente.
  useEffect(() => {
    setSelectedStation(null);
  }, [user?.id]);

  const stationName = config?.stationName ?? "";

  if (settingsOpen) {
    return (
      <SettingsScreen
        config={config}
        onSave={onSaveConfig}
        onClose={() => setSettingsOpen(false)}
        onServerChanged={() => void recheck()}
      />
    );
  }

  if (status === "loading" || !config) {
    return <BootScreen />;
  }

  if (status === "unauthenticated") {
    return (
      <LoginScreen
        stationName={stationName}
        serverStatus={serverStatus}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    );
  }

  // Con una sola estación disponible se entra directo: es el caso normal en
  // planta (un PC digitaliza, otro empaca) y ahorra un clic en cada arranque.
  const station =
    selectedStation ??
    (capabilities.stations.length === 1 ? capabilities.stations[0] : null);

  if (capabilities.stations.length === 0) {
    return <NoStationScreen onOpenSettings={() => setSettingsOpen(true)} />;
  }

  if (!station) {
    return (
      <StationMenu
        stations={capabilities.stations}
        stationName={stationName}
        serverStatus={serverStatus}
        onSelect={setSelectedStation}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    );
  }

  // Solo se ofrece volver al menú si de verdad hay a dónde volver.
  const onBack =
    capabilities.stations.length > 1 ? () => setSelectedStation(null) : undefined;

  const shellProps = {
    stationName,
    serverStatus,
    onBack,
    onOpenSettings: () => setSettingsOpen(true),
  };

  if (station === "weighing") return <WeighingStation {...shellProps} />;
  if (station === "digitize") return <DigitizeStation {...shellProps} />;
  if (station === "packing") return <PackingStation {...shellProps} />;
  if (station === "hospitality") return <HospitalityStation {...shellProps} />;
  return <HistoryStation {...shellProps} />;
}

function BootScreen() {
  return (
    <div className="flex h-full items-center justify-center bg-muted/30">
      <p className="text-base text-muted-foreground">Iniciando Servilion…</p>
    </div>
  );
}
