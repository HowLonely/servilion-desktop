import { Loader2, Wifi, WifiOff } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ServerStatus } from "@shared/types";

// Indicador permanente en la cabecera. Se usa texto además del color: el
// operador no tiene por qué saber qué significa un punto rojo.
export function ServerStatusBadge({
  status,
  className,
}: {
  status: ServerStatus;
  className?: string;
}) {
  if (status === "checking") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="size-3.5 animate-spin" />
        Conectando…
      </span>
    );
  }

  if (status === "online") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 ring-inset",
          className,
        )}
      >
        <Wifi className="size-3.5" />
        Conectado
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive ring-1 ring-destructive/25 ring-inset",
        className,
      )}
    >
      <WifiOff className="size-3.5" />
      Sin conexión
    </span>
  );
}
