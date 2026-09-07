import { useMemo, useRef, useState } from "react";
import { Check, Loader2, Scale, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { useFindPendingWeighIn, usePendingWeighIns } from "@/features/weighing/use-weighing";

import type { components } from "@/lib/api/schema";

type WeighInOut = components["schemas"]["WeighInOut"];

// Cuántas sugerencias caben antes de que la lista estorbe más de lo que ayuda.
const MAX_SUGGESTIONS = 6;

/**
 * Primer paso de la digitación: recuperar el pesaje que trae el morral.
 *
 * El ticket que salió de la báscula viene dentro del morral con el ref impreso
 * (`P1375A`). Al tipearlo, la guía hereda ese ref y el peso, y el digitador se
 * ahorra los dos datos. Acepta también el código de un adhesivo de prenda
 * (`P1375A-03`), porque el ticket maestro se traspapela y lo que queda a mano
 * es cualquiera de los adhesivos pegados a la ropa.
 *
 * Es opcional a propósito: un morral que no pasó por la báscula se digitaliza
 * igual, generando su propio ref. Si el pesaje fuera obligatorio, una etiquetera
 * atascada detendría la planta entera.
 */
export function WeighInLookup({
  weighInId,
  onFound,
  onClear,
}: {
  weighInId: number | null;
  onFound: (weighIn: WeighInOut) => void;
  onClear: () => void;
}) {
  const [reference, setReference] = useState("");
  const [found, setFound] = useState<WeighInOut | null>(null);
  const [error, setError] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  // -1 = nada resaltado (Enter todavía busca lo tipeado tal cual).
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const findWeighIn = useFindPendingWeighIn();
  const { data: pendingTickets } = usePendingWeighIns();
  const inputRef = useRef<HTMLInputElement>(null);

  // Sugerencias por prefijo sobre la cola de pendientes ya cargada: no pega
  // a la red por cada tecla, solo filtra lo que ya se tiene en memoria.
  const suggestions = useMemo(() => {
    const query = reference.trim().toUpperCase();
    const pending = pendingTickets ?? [];
    const matches = query
      ? pending.filter((ticket) => ticket.reference.toUpperCase().startsWith(query))
      : pending;
    return matches.slice(0, MAX_SUGGESTIONS);
  }, [pendingTickets, reference]);

  const showSuggestions = isFocused && !suggestionsDismissed && suggestions.length > 0;

  async function lookup(code: string = reference): Promise<void> {
    const trimmed = code.trim();
    if (!trimmed) return;

    setError("");
    try {
      const weighIn = await findWeighIn.mutateAsync(trimmed);
      setFound(weighIn);
      onFound(weighIn);
    } catch (caught) {
      setError(parseApiError(caught).detail);
      setFound(null);
      inputRef.current?.select();
    }
  }

  function selectSuggestion(ticket: WeighInOut): void {
    setReference(ticket.reference);
    setSuggestionsDismissed(true);
    setHighlightedIndex(-1);
    void lookup(ticket.reference);
  }

  function clear(): void {
    setFound(null);
    setReference("");
    setError("");
    setSuggestionsDismissed(false);
    setHighlightedIndex(-1);
    onClear();
    inputRef.current?.focus();
  }

  if (found && weighInId === found.id) {
    return (
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check className="size-6" />
        </span>

        <div className="min-w-48 flex-1">
          <p className="font-mono text-2xl font-bold tracking-tight">{found.reference}</p>
          <p className="text-sm text-emerald-900/70">
            {found.company_name}
            {found.is_contractor && " · Contratista"} · pesado por {found.weighed_by_name}
          </p>
        </div>

        <p className="text-lg font-semibold tabular-nums text-emerald-900">
          {found.garment_count} pz · {found.weight_kg} kg
        </p>

        <Button variant="outline" className="h-11" onClick={clear}>
          <X className="size-4" />
          Quitar
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <Scale className="size-5 text-primary" />
        <h2 className="text-base font-semibold tracking-tight">Ticket de pesaje</h2>
        <span className="text-sm text-muted-foreground">(opcional)</span>
      </div>

      <div className="relative flex flex-wrap gap-2">
        <Input
          ref={inputRef}
          autoFocus
          className="h-12 min-w-56 flex-1 font-mono text-lg uppercase"
          placeholder="P1375A"
          value={reference}
          role="combobox"
          aria-expanded={showSuggestions}
          aria-controls="weigh-in-suggestions"
          aria-activedescendant={
            highlightedIndex >= 0 ? `weigh-in-suggestion-${highlightedIndex}` : undefined
          }
          onChange={(event) => {
            setReference(event.target.value);
            setError("");
            setSuggestionsDismissed(false);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            setIsFocused(true);
            setSuggestionsDismissed(false);
          }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(event) => {
            // La digitación es un módulo 100% teclado (sin mouse ni touch), así
            // que las sugerencias tienen que navegarse igual de bien que
            // cualquier otro campo: flechas para moverse, Enter para elegir.
            if (showSuggestions && event.key === "ArrowDown") {
              event.preventDefault();
              setHighlightedIndex((index) => Math.min(index + 1, suggestions.length - 1));
              return;
            }
            if (showSuggestions && event.key === "ArrowUp") {
              event.preventDefault();
              setHighlightedIndex((index) => Math.max(index - 1, -1));
              return;
            }
            if (showSuggestions && event.key === "Escape") {
              event.preventDefault();
              setSuggestionsDismissed(true);
              return;
            }
            if (event.key !== "Enter") return;
            // Enter no puede enviar el formulario completo desde aquí: la guía
            // todavía no tiene ni trabajador ni prendas.
            event.preventDefault();
            const highlighted = showSuggestions ? suggestions[highlightedIndex] : undefined;
            if (highlighted) {
              selectSuggestion(highlighted);
              return;
            }
            void lookup();
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="h-12"
          disabled={findWeighIn.isPending || !reference.trim()}
          onClick={() => void lookup()}
        >
          {findWeighIn.isPending && <Loader2 className="size-4 animate-spin" />}
          Buscar
        </Button>

        {showSuggestions && (
          <div
            id="weigh-in-suggestions"
            role="listbox"
            className="absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-md ring-1 ring-foreground/10"
          >
            <p className="border-b px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Pendientes de digitalizar
            </p>
            {suggestions.map((ticket, index) => (
              <button
                key={ticket.id}
                id={`weigh-in-suggestion-${index}`}
                role="option"
                aria-selected={index === highlightedIndex}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm",
                  index === highlightedIndex ? "bg-accent" : "hover:bg-accent",
                )}
                // preventDefault en mousedown evita que el input pierda el foco
                // antes de que el click alcance a dispararse.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectSuggestion(ticket)}
              >
                <span className="font-mono font-semibold">{ticket.reference}</span>
                <span className="text-xs text-muted-foreground">
                  {ticket.company_name} · {ticket.garment_count} pz · {ticket.weight_kg} kg
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive">{error}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Tipea el ref del ticket que viene en el morral y trae el peso y el ref
          ya cargados. Si el morral no pasó por la báscula, sigue sin llenarlo.
        </p>
      )}
    </section>
  );
}
