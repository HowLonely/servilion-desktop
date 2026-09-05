
import { useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applyServerErrors, parseApiError } from "@/lib/api/errors";
import { dateInputDaysAgo, localInputToIsoUtc } from "@/lib/date";
import { useCompany } from "@/features/companies/use-companies";
import {
  GARMENT_TYPES_SELECT_LIMIT,
  useGarmentTypes,
} from "@/features/garments/use-garment-types";
import { useCreateOrder } from "@/features/orders/hooks/use-orders";
import {
  orderSchema,
  type OrderFormValues,
} from "@/features/orders/schemas/order-schema";
import { useWorker } from "@/features/workers/use-workers";
import { WeighInLookup } from "@/features/digitize/weigh-in-lookup";
import { WorkerSelect } from "@/features/workers/worker-select";

import type { components } from "@/lib/api/schema";

type GarmentTypeOut = components["schemas"]["GarmentTypeOut"];
type LaundryOrderOut = components["schemas"]["LaundryOrderOut"];

const MAX_SUGGESTIONS = 6;

// Digitalización de la OT física (paso 4). Esta vista está pensada como una
// terminal de digitación: la mano se queda en el teclado, la prenda se agrega
// escribiendo su CÓDIGO y presionando Enter, y todo se muestra en grande porque
// lo opera personal sin formación técnica.
//
// Portado del panel web. Único cambio de fondo: la web navega al detalle de la
// OT recién creada, lo que corta el ritmo de quien digita cien OT seguidas.
// Aquí se avisa al contenedor (`onCreated`) para que muestre la confirmación y
// encadene la siguiente.
export function CreateOrderForm({
  onCreated,
}: {
  onCreated: (order: LaundryOrderOut) => void;
}) {
  const createOrder = useCreateOrder();
  const { data: garmentsPage } = useGarmentTypes({
    is_active: true,
    limit: GARMENT_TYPES_SELECT_LIMIT,
  });
  const garments = useMemo(() => garmentsPage?.items ?? [], [garmentsPage]);
  const garmentById = useMemo(
    () => new Map(garments.map((g) => [g.id, g])),
    [garments],
  );

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      order_number: "",
      worker_id: 0,
      weigh_in_id: null,
      ticket_number: "",
      shift: "",
      weight_kg: null,
      received_at: `${dateInputDaysAgo(0)}T${new Date().toTimeString().slice(0, 5)}`,
      observations: "",
      control_code: "",
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = watch("items");
  const workerId = watch("worker_id");
  const weighInId = watch("weigh_in_id");
  // Lo que declaró la báscula, para mostrarlo junto a lo que va contando el
  // digitador. No se guarda en el formulario: la guía lleva el conteo real y el
  // pesaje conserva el suyo (el backend deja las dos cifras a la vista).
  const [weighedCount, setWeighedCount] = useState<number | null>(null);
  const { data: worker } = useWorker(workerId > 0 ? workerId : undefined);
  const { data: company } = useCompany(worker?.company_id);

  const totalUnits = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  function addCatalogGarment(garment: GarmentTypeOut, quantity: number) {
    // Restricción del backend: una prenda del catálogo no puede repetirse en la
    // guía (unique_garment_type_per_order). Si ya está, se suma la cantidad.
    const existing = items.findIndex(
      (item) => item.garment_type_id === garment.id,
    );
    if (existing >= 0) {
      setValue(
        `items.${existing}.quantity`,
        items[existing].quantity + quantity,
      );
    } else {
      append({
        garment_type_id: garment.id,
        custom_name: "",
        quantity,
      });
    }
  }

  async function onSubmit(values: OrderFormValues) {
    try {
      const order = await createOrder.mutateAsync({
        ...values,
        shift: values.shift || worker?.shift || "",
        received_at: localInputToIsoUtc(values.received_at),
      });
      onCreated(order);
    } catch (error) {
      const apiError = parseApiError(error);
      applyServerErrors(apiError, setError);
      toast.error(apiError.detail);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">
      {/* 0 · Ticket de pesaje */}
      <WeighInLookup
        weighInId={weighInId}
        onFound={(weighIn) => {
          // El ref viaja impreso en los adhesivos que ya están pegados a la
          // ropa, así que la guía tiene que nacer con ese mismo código: se
          // copia al formulario en vez de dejar que el backend genere otro.
          setValue("weigh_in_id", weighIn.id);
          setValue("weight_kg", weighIn.weight_kg);
          setWeighedCount(weighIn.garment_count);
        }}
        onClear={() => {
          setValue("weigh_in_id", null);
          setValue("weight_kg", null);
          setWeighedCount(null);
        }}
      />

      {/* 1 · Datos de la OT */}
      <section className="flex flex-col gap-4">
        <SectionTitle number={1}>Datos de la OT</SectionTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          <BigField label="N° de OT" htmlFor="order_number" error={errors.order_number?.message}>
            <Input
              id="order_number"
              className="h-12 text-lg"
              {...register("order_number")}
            />
          </BigField>
          <BigField label="Código de control" htmlFor="control_code">
            <Input id="control_code" className="h-12 text-lg" {...register("control_code")} />
          </BigField>
        </div>

        <BigField label="Trabajador" error={errors.worker_id?.message}>
          <WorkerSelect
            value={workerId > 0 ? workerId : undefined}
            onChange={(id) => setValue("worker_id", id ?? 0)}
            triggerClassName="h-12 text-lg"
          />
          {worker && (
            <p className="text-sm text-muted-foreground">
              {company?.name ?? "..."} · Turno {worker.shift || "—"} · Pieza{" "}
              {worker.room_number || "—"}
            </p>
          )}
        </BigField>

        <div className="grid gap-4 sm:grid-cols-2">
          <BigField label="Fecha de la OT" htmlFor="received_at" error={errors.received_at?.message}>
            <Input
              id="received_at"
              type="datetime-local"
              className="h-12 text-lg"
              {...register("received_at")}
            />
          </BigField>
          <BigField label="Peso del morral (kg)" htmlFor="weight_kg">
            <Input
              id="weight_kg"
              type="number"
              step="0.1"
              min="0"
              className="h-12 text-lg"
              {...register("weight_kg", {
                setValueAs: (v) => (v === "" ? null : Number(v)),
              })}
            />
          </BigField>
        </div>
      </section>

      {/* 2 · Prendas */}
      <section className="flex flex-col gap-4">
        <SectionTitle number={2}>Prendas</SectionTitle>

        <GarmentEntry garments={garments} onAdd={addCatalogGarment} />

        {typeof errors.items?.message === "string" && (
          <p className="text-sm font-medium text-destructive">{errors.items.message}</p>
        )}

        {/* Lista de prendas agregadas */}
        {fields.length === 0 ? (
          <p className="rounded-xl border border-dashed py-8 text-center text-base text-muted-foreground">
            Aún no hay prendas. Escribe un código arriba y presiona Enter.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            {fields.map((field, index) => {
              const item = items[index];
              if (!item) return null;
              const garment =
                item.garment_type_id != null
                  ? garmentById.get(item.garment_type_id)
                  : undefined;
              const code = garment?.code ?? "S/C";
              const name = garment?.name ?? item.custom_name;
              const isCustom = item.garment_type_id == null;

              return (
                <div
                  key={field.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 text-lg",
                    index > 0 && "border-t",
                  )}
                >
                  <span className="min-w-16 shrink-0 rounded-md bg-muted px-2 py-1 text-center font-mono text-base font-bold tabular-nums">
                    {code}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {name}
                    {isCustom && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        (fuera de catálogo)
                      </span>
                    )}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-10"
                      aria-label="Restar uno"
                      disabled={item.quantity <= 1}
                      onClick={() =>
                        setValue(
                          `items.${index}.quantity`,
                          Math.max(1, item.quantity - 1),
                        )
                      }
                    >
                      <Minus className="size-5" />
                    </Button>
                    <span className="w-10 text-center text-2xl font-bold tabular-nums">
                      {item.quantity}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-10"
                      aria-label="Sumar uno"
                      onClick={() =>
                        setValue(`items.${index}.quantity`, item.quantity + 1)
                      }
                    >
                      <Plus className="size-5" />
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 text-muted-foreground hover:text-destructive"
                    aria-label="Quitar prenda"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="size-5" />
                  </Button>
                </div>
              );
            })}

            {/* Totales */}
            <div className="flex items-center justify-end border-t bg-muted/40 px-3 py-3">
              <span className="text-2xl font-bold tabular-nums">
                {totalUnits} {totalUnits === 1 ? "prenda" : "prendas"}
                {weighedCount !== null && totalUnits !== weighedCount && (
                  // Manda el digitador: la guía queda con el conteo real y la
                  // báscula conserva el suyo. Se avisa, no se bloquea.
                  <span className="ml-2 font-normal text-amber-600">
                    · la báscula contó {weighedCount}
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        <CustomGarmentEntry
          onAdd={(name, quantity) =>
            append({
              garment_type_id: null,
              custom_name: name,
              quantity,
            })
          }
        />
      </section>

      {/* 3 · Cierre */}
      <section className="flex flex-col gap-4">
        <SectionTitle number={3}>Observaciones y guardado</SectionTitle>
        <BigField label="Observaciones (faltantes o sobrantes)" htmlFor="observations">
          <Textarea id="observations" className="text-base" {...register("observations")} />
        </BigField>
        <Button
          type="submit"
          size="lg"
          className="h-14 w-full text-lg sm:w-auto sm:self-end sm:px-10"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Guardando..." : "Digitalizar OT"}
        </Button>
      </section>
    </form>
  );
}

// --- Entrada de prendas por código (el corazón de la digitación) ---

function GarmentEntry({
  garments,
  onAdd,
}: {
  garments: GarmentTypeOut[];
  onAdd: (garment: GarmentTypeOut, quantity: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [qty, setQty] = useState(1);
  const [highlight, setHighlight] = useState(0);

  const query = code.trim().toUpperCase();
  const matches = useMemo(() => {
    if (!query) return [];
    const byCode = garments.filter((g) => g.code.toUpperCase().startsWith(query));
    const byName = garments.filter(
      (g) =>
        !g.code.toUpperCase().startsWith(query) &&
        g.name.toUpperCase().includes(query),
    );
    return [...byCode, ...byName].slice(0, MAX_SUGGESTIONS);
  }, [query, garments]);

  const selected = matches[highlight];

  function commit(garment: GarmentTypeOut | undefined) {
    if (!garment) return;
    onAdd(garment, Math.max(1, qty));
    setCode("");
    setQty(1);
    setHighlight(0);
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-4">
      <label
        htmlFor="garment-code"
        className="text-sm font-semibold tracking-tight"
      >
        Agregar prenda por código
      </label>
      <div className="flex flex-wrap items-stretch gap-2">
        {/* Cantidad */}
        <div className="flex items-stretch">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-14 rounded-r-none"
            aria-label="Restar cantidad"
            disabled={qty <= 1}
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            <Minus className="size-6" />
          </Button>
          <div className="flex w-14 items-center justify-center border-y bg-background text-3xl font-bold tabular-nums">
            {qty}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-14 rounded-l-none"
            aria-label="Sumar cantidad"
            onClick={() => setQty((q) => q + 1)}
          >
            <Plus className="size-6" />
          </Button>
        </div>

        {/* Código */}
        <Input
          id="garment-code"
          ref={inputRef}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setHighlight(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              commit(selected);
            }
          }}
          placeholder="Código de la prenda…"
          autoComplete="off"
          className="h-14 min-w-48 flex-1 font-mono text-2xl uppercase tracking-wide"
        />

        <Button
          type="button"
          size="lg"
          className="h-14 px-6 text-lg"
          disabled={!selected}
          onClick={() => commit(selected)}
        >
          <Plus className="size-5" />
          Agregar
        </Button>
      </div>

      {/* Coincidencias en vivo */}
      {query && matches.length === 0 && (
        <p className="text-base text-muted-foreground">
          Sin coincidencias para “{query}”. Usa “Fuera de catálogo” más abajo.
        </p>
      )}
      {matches.length > 0 && (
        <ul className="flex flex-col overflow-hidden rounded-lg border bg-background">
          {matches.map((garment, index) => (
            <li key={garment.id}>
              <button
                type="button"
                onClick={() => commit(garment)}
                onMouseEnter={() => setHighlight(index)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left text-lg",
                  index === highlight
                    ? "bg-primary/10"
                    : "hover:bg-muted",
                )}
              >
                <span className="min-w-16 shrink-0 rounded-md bg-muted px-2 py-1 text-center font-mono text-base font-bold tabular-nums">
                  {garment.code}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {garment.name}
                </span>
                {index === highlight && (
                  <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 text-xs sm:inline">
                    Enter
                  </kbd>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Prenda fuera de catálogo (caso excepcional, escrito a mano en la OT) ---

function CustomGarmentEntry({
  onAdd,
}: {
  onAdd: (name: string, quantity: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);

  const valid = name.trim() !== "" && qty >= 1;

  function submit() {
    if (!valid) return;
    onAdd(name.trim(), qty);
    setName("");
    setQty(1);
    setOpen(false);
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        Prenda fuera de catálogo
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed p-3">
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Nombre (ej. TOALLA CAFÉ)
        </label>
        <Input
          className="h-11 text-base"
          value={name}
          onChange={(e) => setName(e.target.value.toUpperCase())}
          autoFocus
        />
      </div>
      <div className="flex w-20 flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Cant.</label>
        <Input
          className="h-11 text-base"
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(Math.max(1, Math.round(Number(e.target.value) || 1)))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </div>
      <Button type="button" className="h-11" disabled={!valid} onClick={submit}>
        <Check className="size-4" />
        Agregar
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-11"
        onClick={() => setOpen(false)}
      >
        Cancelar
      </Button>
    </div>
  );
}

// --- Piezas de layout ---

function SectionTitle({
  number,
  children,
}: {
  number: number;
  children: React.ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
      <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {number}
      </span>
      {children}
    </h2>
  );
}

function BigField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
