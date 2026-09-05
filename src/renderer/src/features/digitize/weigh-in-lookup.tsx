import { useRef, useState } from "react";
import { Check, Loader2, Scale, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseApiError } from "@/lib/api/errors";
import { useFindPendingWeighIn } from "@/features/weighing/use-weighing";

import type { components } from "@/lib/api/schema";

type WeighInOut = components["schemas"]["WeighInOut"];

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
  const findWeighIn = useFindPendingWeighIn();
  const inputRef = useRef<HTMLInputElement>(null);

  async function lookup(): Promise<void> {
    const code = reference.trim();
    if (!code) return;

    setError("");
    try {
      const weighIn = await findWeighIn.mutateAsync(code);
      setFound(weighIn);
      onFound(weighIn);
    } catch (caught) {
      setError(parseApiError(caught).detail);
      setFound(null);
      inputRef.current?.select();
    }
  }

  function clear(): void {
    setFound(null);
    setReference("");
    setError("");
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

      <div className="flex flex-wrap gap-2">
        <Input
          ref={inputRef}
          autoFocus
          className="h-12 min-w-56 flex-1 font-mono text-lg uppercase"
          placeholder="P1375A"
          value={reference}
          onChange={(event) => {
            setReference(event.target.value);
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            // Enter no puede enviar el formulario completo desde aquí: la guía
            // todavía no tiene ni trabajador ni prendas.
            event.preventDefault();
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
