import { Zap } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Marca de cargo express. No pinta nada para los cargos normales, así que se
 * puede poner junto a cualquier guía o pesaje sin condicionar en el llamador.
 */
export function ExpressBadge({
  serviceType,
  className,
}: {
  serviceType: string | undefined;
  className?: string;
}) {
  if (serviceType !== "EXPRESS") return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 font-sans text-xs font-semibold whitespace-nowrap text-white",
        className,
      )}
    >
      <Zap className="size-3.5" />
      EXPRESS
    </span>
  );
}
