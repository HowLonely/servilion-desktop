import { useEffect } from "react";
import { BedDouble, FilePlus2, History, LogOut, PackageCheck, Scale, Settings, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ServerStatusBadge } from "@/components/server-status-badge";
import { fullName, roleLabel, type Station } from "@/lib/auth/capabilities";
import { useSession } from "@/lib/auth/session-provider";

import type { ServerStatus } from "@shared/types";

const STATION_CARDS: Record<
  Station,
  { title: string; description: string; icon: typeof FilePlus2 }
> = {
  weighing: {
    title: "Pesaje y etiquetado",
    description: "Pesar el morral de ropa sucia e imprimir sus etiquetas.",
    icon: Scale,
  },
  digitize: {
    title: "Digitalizar OT",
    description: "Pasar al sistema la OT física de la ropa sucia recibida.",
    icon: FilePlus2,
  },
  packing: {
    title: "Empaque y revisión",
    description: "Pistolear cada prenda del morral limpio y validar que esté completo.",
    icon: PackageCheck,
  },
  dispatch: {
    title: "Despacho",
    description: "Pistolear la boleta de un morral cerrado para sacarlo de planta.",
    icon: Truck,
  },
  hospitality: {
    title: "Lencería de hotelería",
    description: "Carga a granel del campamento: cuánto entró, cuánto volvió y la merma.",
    icon: BedDouble,
  },
  history: {
    title: "Consultar histórico",
    description: "Guías y trabajadores, con los mismos filtros del panel web.",
    icon: History,
  },
};

/**
 * Solo aparece cuando el usuario tiene permiso para más de una estación. Se
 * elige con las teclas numéricas porque en digitación la mano no está en el
 * mouse; en una terminal táctil se toca la tarjeta, que por eso es grande.
 */
export function StationMenu({
  stations,
  stationName,
  serverStatus,
  onSelect,
  onOpenSettings,
}: {
  stations: Station[];
  stationName: string;
  serverStatus: ServerStatus;
  onSelect: (station: Station) => void;
  onOpenSettings: () => void;
}) {
  const { user, logout } = useSession();

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < stations.length) {
        onSelect(stations[index]);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [stations, onSelect]);

  return (
    <div className="flex h-full flex-col bg-muted/30">
      <header className="flex shrink-0 items-center gap-3 border-b bg-card px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            ¿Qué vas a hacer?
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {user ? `${fullName(user)} · ${roleLabel(user.role)}` : ""}
            {stationName ? ` · ${stationName}` : ""}
          </p>
        </div>
        <ServerStatusBadge status={serverStatus} />
        <Button variant="ghost" size="icon" onClick={onOpenSettings} aria-label="Ajustes">
          <Settings className="size-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void logout()}
          aria-label="Cerrar sesión"
        >
          <LogOut className="size-5" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="grid w-full max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stations.map((station, index) => {
            const card = STATION_CARDS[station];
            const Icon = card.icon;
            return (
              <button
                key={station}
                type="button"
                autoFocus={index === 0}
                onClick={() => onSelect(station)}
                className="group flex flex-col items-start gap-3 rounded-2xl border bg-card p-7 text-left shadow-sm transition hover:border-primary hover:shadow-md focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <span className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-7" />
                </span>
                <span className="text-xl font-semibold tracking-tight">
                  {card.title}
                </span>
                <span className="text-base text-muted-foreground">
                  {card.description}
                </span>
                <kbd className="mt-1 rounded border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  Tecla {index + 1}
                </kbd>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
