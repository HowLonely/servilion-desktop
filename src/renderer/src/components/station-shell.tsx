import { ChevronLeft, LogOut, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ServerStatusBadge } from "@/components/server-status-badge";
import { fullName, roleLabel } from "@/lib/auth/capabilities";
import { useSession } from "@/lib/auth/session-provider";

import type { ServerStatus } from "@shared/types";

/**
 * Marco de las dos estaciones de trabajo. Reemplaza el sidebar de 12 ítems del
 * panel web por una cabecera mínima: quien digita solo necesita saber en qué
 * estación está, con qué usuario y si el servidor responde.
 */
export function StationShell({
  title,
  description,
  stationName,
  serverStatus,
  onBack,
  onOpenSettings,
  children,
}: {
  title: string;
  description?: string;
  stationName: string;
  serverStatus: ServerStatus;
  /** Solo se muestra si el usuario tiene más de una estación disponible. */
  onBack?: () => void;
  onOpenSettings: () => void;
  children: React.ReactNode;
}) {
  const { user, logout } = useSession();

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b bg-card px-4 py-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Volver al menú">
            <ChevronLeft className="size-5" />
          </Button>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="truncate text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        <ServerStatusBadge status={serverStatus} />

        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight">
            {user ? fullName(user) : "—"}
          </p>
          <p className="text-xs text-muted-foreground leading-tight">
            {user ? roleLabel(user.role) : ""} · {stationName}
          </p>
        </div>

        <Button variant="ghost" size="icon" onClick={onOpenSettings} aria-label="Ajustes">
          <Settings className="size-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label="Cerrar sesión">
          <LogOut className="size-5" />
        </Button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto bg-muted/30 p-4 md:p-6">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
