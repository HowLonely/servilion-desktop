
import { useRef, useState } from "react";
import { Check, CircleAlert, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/date";
import { parseApiError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session-provider";
import { RESOLUTION_TYPE_LABELS } from "@/features/orders/lib/status";
import {
  useFinishPacking,
  usePackingProgress,
  usePackingScan,
  useResolveMissingItem,
} from "@/features/orders/hooks/use-orders";

import type { components } from "@/lib/api/schema";

type LaundryOrderOut = components["schemas"]["LaundryOrderOut"];
type PackingItemProgressOut = components["schemas"]["PackingItemProgressOut"];

// Paso 6 del flujo: al reempacar la ropa limpia se pistoléa cada prenda que
// entra al morral y el sistema valida que quede completo respecto de lo
// declarado en la guía. El input queda enfocado permanentemente porque el
// lector de código de barras escribe como teclado y envía Enter.
//
// Un solo escáner sirve para todo el ciclo de vida del empaque: mientras se
// arma el morral, pistolear suma al conteo; si la guía ya quedó Incompleta
// (se cerró el empaque y faltó algo), pistolear la prenda que reapareció la
// resuelve directo como "Encontrada" — no hay un formulario aparte para eso.
export function PackingPanel({ order }: { order: LaundryOrderOut }) {
  // La capacidad ya se decidió al elegir la estación (ver lib/auth/capabilities),
  // pero se vuelve a comprobar aquí porque este panel decide además si el
  // pistoleo está habilitado para el estado actual de la OT.
  const { capabilities } = useSession();
  const canPack = capabilities.canPack;
  const isPackingStage = ["RECIBIDA", "EN_REVISION", "INCOMPLETA"].includes(
    order.status,
  );
  const isIncomplete = order.status === "INCOMPLETA";

  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState<
    { ok: true; text: string } | { ok: false; text: string } | null
  >(null);
  const { data: progress, isLoading } = usePackingProgress(
    order.id,
    canPack && isPackingStage,
  );
  const scan = usePackingScan(order.id);
  const resolve = useResolveMissingItem(order.id);
  const finish = useFinishPacking(order.id);

  if (!canPack || !isPackingStage) return null;

  async function handleScan() {
    const value = code.trim();
    if (!value || !progress) return;

    if (isIncomplete) {
      // La guía ya se cerró incompleta: pistolear aquí es encontrar la prenda
      // que faltaba, no un pistoleo normal de empaque.
      const item = progress.items.find(
        (it) => it.code.toUpperCase() === value.toUpperCase(),
      );
      if (!item) {
        setFeedback({ ok: false, text: `"${value}" no pertenece a esta OT.` });
        inputRef.current?.focus();
        return;
      }
      try {
        await resolve.mutateAsync({
          item_id: item.item_id,
          resolution_type: "ENCONTRADA",
          quantity: 1,
          code: value,
          purchase_cost: null,
          note: "",
        });
        setCode("");
        const remaining = item.quantity - item.scanned_quantity - 1;
        setFeedback({
          ok: true,
          text:
            remaining > 0
              ? `${item.name} encontrada · faltan ${remaining}`
              : `${item.name} completa ✓`,
        });
      } catch (error) {
        setFeedback({ ok: false, text: parseApiError(error).detail });
      } finally {
        inputRef.current?.focus();
      }
      return;
    }

    try {
      const result = await scan.mutateAsync({ code: value, quantity: 1 });
      setCode("");
      const item = result.items.find(
        (it) => it.code.toUpperCase() === value.toUpperCase(),
      );
      if (item) {
        setFeedback({
          ok: true,
          text: `${item.name} · ${item.scanned_quantity}/${item.quantity}`,
        });
      }
      if (result.is_complete) {
        setFeedback({ ok: true, text: "Morral completo ✓" });
        toast.success("Morral completo: todas las prendas fueron pistoleadas.");
      }
    } catch (error) {
      setFeedback({ ok: false, text: parseApiError(error).detail });
    } finally {
      inputRef.current?.focus();
    }
  }

  const pct =
    progress && progress.declared_total > 0
      ? progress.scanned_total / progress.declared_total
      : 0;

  return (
    <Card className="flex flex-col gap-5 p-5">
      {/* Escaneo de prendas */}
      <div className="flex flex-col gap-2">
        <label htmlFor="prenda-code" className="text-sm font-semibold tracking-tight">
          {isIncomplete
            ? "Pistolea la prenda que reapareció"
            : "Pistolea cada prenda del morral"}
        </label>
        <div className="flex flex-wrap items-stretch gap-2">
          <Input
            id="prenda-code"
            ref={inputRef}
            autoFocus
            className="h-14 min-w-64 flex-1 font-mono text-2xl uppercase tracking-wide"
            placeholder="Código de la prenda…"
            value={code}
            autoComplete="off"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleScan();
              }
            }}
          />
          <Button
            variant="outline"
            size="lg"
            className="h-14 px-6 text-lg"
            onClick={handleScan}
            disabled={scan.isPending || resolve.isPending}
          >
            Pistolear
          </Button>
        </div>

        {/* Feedback del último pistoleo */}
        {feedback && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-lg font-medium",
              feedback.ok
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {feedback.ok ? (
              <Check className="size-5 shrink-0" />
            ) : (
              <CircleAlert className="size-5 shrink-0" />
            )}
            {feedback.text}
          </div>
        )}

        {isIncomplete && (
          <p className="text-sm text-muted-foreground">
            Si la prenda no aparece, márcala como <strong>comprada</strong> en su
            fila más abajo.
          </p>
        )}
      </div>

      {/* Progreso + lista única de prendas (declaradas, pistoleadas y, si
          falta alguna, la acción para resolverla) */}
      {isLoading && <Skeleton className="h-24 w-full" />}
      {progress && (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Progreso del morral
            </span>
            <span className="text-2xl font-bold tabular-nums">
              {progress.scanned_total}
              <span className="text-muted-foreground">
                {" "}
                / {progress.declared_total}
              </span>
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                progress.is_complete ? "bg-emerald-500" : "bg-primary",
              )}
              style={{ width: `${Math.round(pct * 100)}%` }}
            />
          </div>

          <div className="overflow-hidden rounded-xl border">
            {progress.items.map((item, index) => (
              <PackingItemRow
                key={`${item.item_id}-${item.scanned_quantity}`}
                item={item}
                bordered={index > 0}
                showPurchaseAction={isIncomplete}
                orderId={order.id}
              />
            ))}
          </div>
        </div>
      )}

      <Button
        size="lg"
        className="h-12 w-full text-lg sm:w-auto sm:self-start sm:px-8"
        disabled={finish.isPending}
        onClick={async () => {
          try {
            const result = await finish.mutateAsync({ note: "" });
            toast[result.status === "COMPLETADA" ? "success" : "warning"](
              result.status === "COMPLETADA"
                ? "Morral validado: OT completada."
                : "Morral incompleto: OT marcada como incompleta.",
            );
          } catch (error) {
            toast.error(parseApiError(error).detail);
          }
        }}
      >
        Cerrar empaque
      </Button>
      <p className="text-sm text-muted-foreground">
        Al cerrar, si falta alguna prenda la OT queda <strong>Incompleta</strong>{" "}
        con la discrepancia anotada; si está completa pasa a{" "}
        <strong>Completada</strong> y se puede imprimir la boleta.
      </p>

      {order.missing_item_resolutions.length > 0 && (
        <ResolutionHistory resolutions={order.missing_item_resolutions} />
      )}
    </Card>
  );
}

// Una fila = una prenda. Muestra su progreso y, solo si la guía está
// Incompleta, la única acción que no se puede resolver pistoleando: declarar
// que se repuso comprando una nueva.
function PackingItemRow({
  item,
  bordered,
  showPurchaseAction,
  orderId,
}: {
  item: PackingItemProgressOut;
  bordered: boolean;
  showPurchaseAction: boolean;
  orderId: number;
}) {
  const complete = item.scanned_quantity >= item.quantity;
  const remaining = item.quantity - item.scanned_quantity;
  const [buying, setBuying] = useState(false);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 px-3 py-3",
        bordered && "border-t",
        complete && "bg-emerald-50/60 dark:bg-emerald-400/5",
      )}
    >
      <div className="flex items-center gap-3 text-lg">
        <span className="min-w-16 shrink-0 rounded-md bg-muted px-2 py-1 text-center font-mono text-base font-bold tabular-nums">
          {item.code}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
        <span className="shrink-0 text-xl font-bold tabular-nums">
          {item.scanned_quantity}
          <span className="text-muted-foreground">/{item.quantity}</span>
        </span>
        <span className="w-28 shrink-0 text-right">
          {complete ? (
            <span className="inline-flex items-center gap-1 text-base font-semibold text-emerald-600 dark:text-emerald-400">
              <Check className="size-4" /> Lista
            </span>
          ) : (
            <span className="text-base font-semibold text-amber-600 dark:text-amber-400">
              Faltan {remaining}
            </span>
          )}
        </span>
        {showPurchaseAction && !complete && !buying && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setBuying(true)}
          >
            <ShoppingCart className="size-4" />
            Comprada
          </Button>
        )}
      </div>

      {buying && (
        <PurchaseInlineForm
          orderId={orderId}
          item={item}
          onDone={() => setBuying(false)}
        />
      )}
    </div>
  );
}

// Formulario compacto que aparece solo al declarar una compra: cantidad y
// costo por unidad. Se abre bajo demanda para no duplicar la fila de arriba.
function PurchaseInlineForm({
  orderId,
  item,
  onDone,
}: {
  orderId: number;
  item: PackingItemProgressOut;
  onDone: () => void;
}) {
  const missing = item.quantity - item.scanned_quantity;
  const resolve = useResolveMissingItem(orderId);
  const [quantity, setQuantity] = useState(missing);
  const [unitCost, setUnitCost] = useState("");

  const cost = Number(unitCost);
  const isValid = quantity >= 1 && quantity <= missing && cost > 0;

  async function submit() {
    try {
      await resolve.mutateAsync({
        item_id: item.item_id,
        resolution_type: "COMPRADA",
        quantity,
        code: "",
        purchase_cost: cost,
        note: "",
      });
      toast.success(`${item.name}: ${quantity} comprada(s) registrada(s).`);
      onDone();
    } catch (error) {
      toast.error(parseApiError(error).detail);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-2 pl-19">
      <QuantityInput value={quantity} max={missing} onChange={setQuantity} />
      <Input
        className="h-10 w-32 text-base"
        type="number"
        min="0"
        placeholder="Costo c/u $"
        value={unitCost}
        onChange={(e) => setUnitCost(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && isValid && submit()}
        autoFocus
      />
      {cost > 0 && quantity > 1 && (
        <span className="text-sm text-muted-foreground">
          = ${(cost * quantity).toLocaleString("es-CL")}
        </span>
      )}
      <Button size="sm" disabled={resolve.isPending || !isValid} onClick={submit}>
        Registrar
      </Button>
      <Button size="sm" variant="ghost" onClick={onDone}>
        Cancelar
      </Button>
    </div>
  );
}

// Selector de cantidad acotado a [1, max]. Con max=1 no tiene sentido elegir,
// así que se muestra fijo.
function QuantityInput({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  if (max <= 1) {
    return <span className="w-10 text-center text-base font-medium">1</span>;
  }
  return (
    <Input
      className="h-10 w-16 text-center text-base"
      type="number"
      min="1"
      max={max}
      value={value}
      onChange={(e) => {
        const next = Number(e.target.value);
        if (Number.isNaN(next)) return;
        onChange(Math.min(max, Math.max(1, Math.round(next))));
      }}
    />
  );
}

function ResolutionHistory({
  resolutions,
}: {
  resolutions: LaundryOrderOut["missing_item_resolutions"];
}) {
  return (
    <div className="flex flex-col gap-1 border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">
        Prendas resueltas anteriormente
      </p>
      <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
        {resolutions.map((resolution, index) => (
          <li key={index}>
            {resolution.item_code && (
              <span className="font-mono font-semibold">
                {resolution.item_code}{" "}
              </span>
            )}
            {resolution.item_name} ×{resolution.quantity} ·{" "}
            {RESOLUTION_TYPE_LABELS[resolution.resolution_type] ??
              resolution.resolution_type}
            {resolution.purchase_cost
              ? ` · $${resolution.purchase_cost.toLocaleString("es-CL")} c/u` +
                (resolution.quantity > 1
                  ? ` ($${(
                      resolution.purchase_cost * resolution.quantity
                    ).toLocaleString("es-CL")})`
                  : "")
              : ""}{" "}
            · {formatDateTime(resolution.resolved_at)}
          </li>
        ))}
      </ul>
    </div>
  );
}
