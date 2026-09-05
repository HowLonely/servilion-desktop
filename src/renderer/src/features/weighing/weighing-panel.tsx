import { useState } from "react";
import { Check, ChevronLeft, History, Loader2, Printer, Shirt, Weight } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NumericKeypad } from "@/components/numeric-keypad";
import { parseApiError } from "@/lib/api/errors";
import { useActiveClients, useClientCompanies } from "@/features/weighing/use-catalog";
import {
  useCreateWeighIn,
  usePrintWeighLabels,
} from "@/features/weighing/use-weighing";

import type { components } from "@/lib/api/schema";

type WeighInOut = components["schemas"]["WeighInOut"];

/**
 * Los cuatro pasos de un pesaje, en el orden en que ocurren físicamente: el
 * operador mira la etiqueta del morral (cliente, empresa), cuenta las prendas y
 * lee la balanza.
 *
 * Se modela como pasos y no como un formulario largo porque en táctil un
 * formulario con cuatro campos obliga a apuntar; una pantalla por dato deja cada
 * objetivo del tamaño de un dedo y hace obvio qué falta.
 */
type Step = "client" | "company" | "count" | "weight" | "done";

const STEP_ORDER: Step[] = ["client", "company", "count", "weight"];

export function WeighingPanel({ onOpenShift }: { onOpenShift: () => void }) {
  const [step, setStep] = useState<Step>("client");
  const [clientId, setClientId] = useState<number | null>(null);
  const [clientName, setClientName] = useState("");
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [count, setCount] = useState("");
  const [weight, setWeight] = useState("");
  const [created, setCreated] = useState<WeighInOut | null>(null);

  const clients = useActiveClients();
  const companies = useClientCompanies(clientId);
  const createWeighIn = useCreateWeighIn();
  const printLabels = usePrintWeighLabels();

  function reset(): void {
    // El cliente NO se limpia: los morrales llegan en tandas del mismo cliente,
    // así que volver a pedirlo en cada uno sería un toque de más cien veces por
    // turno. La empresa sí, porque dentro de una tanda cambia de contratista.
    setCompanyId(null);
    setCompanyName("");
    setCount("");
    setWeight("");
    setCreated(null);
    setStep(clientId ? "company" : "client");
  }

  async function submit(): Promise<void> {
    if (clientId === null || companyId === null) return;

    try {
      const weighIn = await createWeighIn.mutateAsync({
        client_id: clientId,
        company_id: companyId,
        garment_count: Number(count),
        weight_kg: Number(weight),
      });
      setCreated(weighIn);
      setStep("done");

      // La impresión va después de guardar y su fallo no invalida el pesaje: el
      // morral se pesó igual, y las etiquetas se reimprimen desde la lista del
      // turno. Confundir "no imprimió" con "no se pesó" haría que el operador
      // pesara dos veces el mismo morral y quemara un ref.
      try {
        await printLabels.mutateAsync(weighIn.id);
      } catch (error) {
        toast.error("El pesaje quedó guardado, pero no se pudo imprimir", {
          description: error instanceof Error ? error.message : String(error),
        });
      }
    } catch (error) {
      toast.error(parseApiError(error).detail);
    }
  }

  if (step === "done" && created) {
    return (
      <WeighInConfirmation
        weighIn={created}
        isPrinting={printLabels.isPending}
        onReprint={() => {
          printLabels.mutate(created.id, {
            onError: (error) =>
              toast.error("No se pudo imprimir", {
                description: error instanceof Error ? error.message : String(error),
              }),
            onSuccess: () => toast.success("Etiquetas enviadas a la impresora"),
          });
        }}
        onNext={reset}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        step={step}
        clientName={clientName}
        companyName={companyName}
        count={count}
        weight={weight}
        onBack={() => {
          const index = STEP_ORDER.indexOf(step);
          if (index > 0) setStep(STEP_ORDER[index - 1]);
        }}
        onOpenShift={onOpenShift}
      />

      {step === "client" && (
        <PickerGrid
          isLoading={clients.isLoading}
          emptyLabel="No hay clientes activos. Pídele a un administrador que cree uno."
          options={(clients.data ?? []).map((client) => ({
            id: client.id,
            title: client.name,
            subtitle: client.faena_name,
          }))}
          onPick={(option) => {
            setClientId(option.id);
            setClientName(option.title);
            setCompanyId(null);
            setCompanyName("");
            setStep("company");
          }}
        />
      )}

      {step === "company" && (
        <PickerGrid
          isLoading={companies.isLoading}
          emptyLabel={`${clientName} no tiene empresas activas.`}
          options={(companies.data ?? []).map((company) => ({
            id: company.id,
            title: company.name,
            // La palabra "Contratista" se marca aquí igual que en la etiqueta
            // lavable y en la boleta: es lo que distingue en la mesa que ese
            // morral no es del mandante.
            subtitle: company.is_contractor ? "Contratista" : "Mandante",
            highlight: company.is_contractor,
          }))}
          onPick={(option) => {
            setCompanyId(option.id);
            setCompanyName(option.title);
            setStep("count");
          }}
        />
      )}

      {step === "count" && (
        <NumberStep
          icon={Shirt}
          label="¿Cuántas prendas trae el morral?"
          hint="Se imprimirá un adhesivo por cada una, más el ticket del digitalizador."
          value={count}
          unit={Number(count) === 1 ? "prenda" : "prendas"}
          onChange={setCount}
          maxIntegerDigits={2}
          canContinue={Number(count) >= 1}
          onContinue={() => setStep("weight")}
        />
      )}

      {step === "weight" && (
        <NumberStep
          icon={Weight}
          label="¿Cuánto pesa el morral?"
          hint="Peso completo tal cual lo muestra la balanza, con el bolso incluido."
          value={weight}
          unit="kg"
          allowDecimal
          onChange={setWeight}
          maxIntegerDigits={3}
          canContinue={Number(weight) > 0}
          continueLabel={createWeighIn.isPending ? "Guardando…" : "Pesar e imprimir"}
          isBusy={createWeighIn.isPending}
          onContinue={() => void submit()}
        />
      )}
    </div>
  );
}

// --- Cabecera de pasos ------------------------------------------------------

function StepHeader({
  step,
  clientName,
  companyName,
  count,
  weight,
  onBack,
  onOpenShift,
}: {
  step: Step;
  clientName: string;
  companyName: string;
  count: string;
  weight: string;
  onBack: () => void;
  onOpenShift: () => void;
}) {
  const index = STEP_ORDER.indexOf(step);
  const crumbs = [
    { label: "Cliente", value: clientName },
    { label: "Empresa", value: companyName },
    { label: "Prendas", value: count },
    { label: "Peso", value: weight ? `${weight} kg` : "" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {index > 0 && (
          <Button variant="outline" size="lg" onClick={onBack} className="h-12">
            <ChevronLeft className="size-5" />
            Atrás
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="ghost" size="lg" onClick={onOpenShift} className="h-12">
          <History className="size-5" />
          Pesajes del turno
        </Button>
      </div>

      <ol className="flex flex-wrap gap-2">
        {crumbs.map((crumb, position) => (
          <li
            key={crumb.label}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm",
              position === index
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "bg-card text-muted-foreground",
            )}
          >
            <span className="mr-1.5">{crumb.label}</span>
            <span className="font-semibold text-foreground">{crumb.value || "—"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// --- Grilla de selección (cliente / empresa) --------------------------------

type PickerOption = { id: number; title: string; subtitle?: string; highlight?: boolean };

function PickerGrid({
  options,
  isLoading,
  emptyLabel,
  onPick,
}: {
  options: PickerOption[];
  isLoading: boolean;
  emptyLabel: string;
  onPick: (option: PickerOption) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Cargando…
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <p className="rounded-xl border bg-card p-8 text-center text-base text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onPick(option)}
          className="flex min-h-24 flex-col items-start justify-center gap-1 rounded-xl border bg-card p-4 text-left shadow-sm transition active:scale-[0.98] active:bg-muted focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <span className="text-lg leading-tight font-semibold">{option.title}</span>
          {option.subtitle && (
            <span
              className={cn(
                "text-sm",
                option.highlight ? "font-medium text-amber-600" : "text-muted-foreground",
              )}
            >
              {option.subtitle}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// --- Paso numérico (prendas / peso) -----------------------------------------

function NumberStep({
  icon: Icon,
  label,
  hint,
  value,
  unit,
  allowDecimal = false,
  maxIntegerDigits,
  canContinue,
  continueLabel = "Continuar",
  isBusy = false,
  onChange,
  onContinue,
}: {
  icon: typeof Shirt;
  label: string;
  hint: string;
  value: string;
  unit: string;
  allowDecimal?: boolean;
  maxIntegerDigits: number;
  canContinue: boolean;
  continueLabel?: string;
  isBusy?: boolean;
  onChange: (value: string) => void;
  onContinue: () => void;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Icon className="size-6 text-primary" />
            {label}
          </h2>
          <p className="mt-1 text-base text-muted-foreground">{hint}</p>
        </div>

        <div className="flex items-baseline justify-center gap-3 rounded-xl border bg-card px-6 py-8 shadow-sm">
          <span className="text-6xl font-semibold tabular-nums">
            {value.replace(".", ",") || "0"}
          </span>
          <span className="text-2xl text-muted-foreground">{unit}</span>
        </div>

        <Button
          size="lg"
          className="h-16 text-lg"
          disabled={!canContinue || isBusy}
          onClick={onContinue}
        >
          {isBusy ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
          {continueLabel}
        </Button>
      </div>

      <NumericKeypad
        value={value}
        onChange={onChange}
        allowDecimal={allowDecimal}
        maxIntegerDigits={maxIntegerDigits}
      />
    </div>
  );
}

// --- Confirmación -----------------------------------------------------------

/**
 * Pantalla de cierre. Muestra el ref en grande porque es lo que el operador
 * contrasta contra el adhesivo que acaba de salir: si la etiquetera imprimió
 * otra cosa, se ve aquí y no tres estaciones más adelante.
 */
function WeighInConfirmation({
  weighIn,
  isPrinting,
  onReprint,
  onNext,
}: {
  weighIn: WeighInOut;
  isPrinting: boolean;
  onReprint: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <Check className="size-9" />
      </span>

      <div>
        <p className="text-base text-muted-foreground">Morral pesado y etiquetado</p>
        <p className="mt-1 font-mono text-6xl font-semibold tracking-tight">
          {weighIn.reference}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2 text-base">
        <Detail label={weighIn.company_name} value={weighIn.is_contractor ? "Contratista" : "Mandante"} />
        <Detail label="Prendas" value={String(weighIn.garment_count)} />
        <Detail label="Peso" value={`${weighIn.weight_kg} kg`} />
        <Detail
          label="Etiquetas"
          value={`${weighIn.labels.length} + ticket`}
        />
      </div>

      <div className="flex w-full max-w-md flex-col gap-3">
        <Button size="lg" className="h-16 text-lg" onClick={onNext}>
          Pesar el siguiente morral
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14"
          disabled={isPrinting}
          onClick={onReprint}
        >
          {isPrinting ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Printer className="size-5" />
          )}
          Volver a imprimir las etiquetas
        </Button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg border bg-card px-3 py-1.5">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}
