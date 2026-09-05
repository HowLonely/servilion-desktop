import { useState } from "react";
import { Check, Printer, ShoppingCart } from "lucide-react";
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
  useDispatchOrder,
  useFinishPacking,
  usePackingProgress,
  usePrintReceipt,
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
//
// Hay dos modos de validación y los decide el backend (`progress.mode`):
//
// - "unidad": la guía viene de un pesaje y cada prenda física trae su propio
//   adhesivo (`P1375A-03`). Se cuentan unidades únicas, así que pistolear dos
//   veces la misma prenda avisa en vez de contarla dos veces. El detalle por
//   tipo se sigue mostrando porque el adhesivo no dice qué prenda es: es lo que
//   el operador lee para saber qué buscar cuando falta la 05.
// - "tipo": la guía se digitalizó sin pasar por la báscula. El adhesivo
//   identifica el TIPO de prenda y se pistolea tantas veces como unidades
//   vuelvan, como siempre.
//
// Este panel NO pistolea: el escáner único de la estación
// (`POST /api/orders/scan/packing`) cubre las prendas, el cierre y el despacho,
// y dos cajas de escaneo en la misma pantalla se roban el foco entre sí porque
// el lector escribe donde esté puesto. Acá queda lo que se mira y lo que se
// declara a mano: el progreso, la prenda que hubo que comprar, los botones de
// respaldo para cuando la pistola falla, y la boleta.
//
// Es la diferencia con el panel web, donde el mismo componente sí lleva su
// escáner porque además vive en el detalle de la OT, sin estación alrededor.
export function PackingPanel({ order }: { order: LaundryOrderOut }) {
  // La capacidad ya se decidió al elegir la estación (ver lib/auth/capabilities),
  // pero se vuelve a comprobar aquí porque este panel decide además si el
  // pistoleo está habilitado para el estado actual de la OT.
  const { capabilities } = useSession();
  const canPack = capabilities.canPack;
  // Prendas ya resueltas que siguen en planta esperando su envío aparte: el
  // morral salió incompleto y la prenda apareció (o se compró) después.
  const pendingShipment = order.missing_item_resolutions.filter(
    (resolution) => !resolution.shipped_at,
  );
  const isDispatched = order.status === "DESPACHADA";
  const isIncomplete = order.status === "INCOMPLETA";
  // El morral salió con un faltante que sigue sin saldarse. `packed_at` solo
  // se escribe cuando el morral queda completo —al cerrarlo o al resolver la
  // última prenda—, así que es el corte que usa el backend
  // (`_is_resolving_missing`) y no depende del estado.
  const hasOpenMissing = Boolean(order.incomplete_at) && !order.packed_at;
  // Un pistoleo de prenda todavía resuelve un faltante: siempre en INCOMPLETA,
  // y en DESPACHADA si el morral viajó sin ella.
  const isResolving = isIncomplete || (isDispatched && hasOpenMissing);
  const isPackingStage =
    // COMPLETADA entra porque el morral cerrado sigue en planta: falta
    // despacharlo. DESPACHADA, si queda una prenda por encontrar o por enviar.
    ["RECIBIDA", "EN_REVISION", "INCOMPLETA", "COMPLETADA"].includes(
      order.status,
    ) ||
    (isDispatched && (hasOpenMissing || pendingShipment.length > 0));
  // Cerrado, esperando el pistoleo que lo saca de planta. Es lo que separa
  // "listo en el andén" de "ya viajando".
  const isClosed = order.status === "COMPLETADA" || isIncomplete;
  const canDispatch = isClosed || (isDispatched && pendingShipment.length > 0);

  const { data: progress, isLoading } = usePackingProgress(
    order.id,
    canPack && isPackingStage,
  );
  const finish = useFinishPacking(order.id);
  const dispatch = useDispatchOrder(order.id);

  if (!canPack || !isPackingStage) return null;

  const pct =
    progress && progress.declared_total > 0
      ? progress.scanned_total / progress.declared_total
      : 0;

  return (
    <Card className="flex flex-col gap-5 p-5">
      {isResolving && (
        // La prenda que reapareció se resuelve pistoleándola en el escáner de
        // la estación. Lo que no se puede pistolear es la que nunca apareció:
        // esa se declara comprada en su fila, y es lo único que hay que decir.
        <p className="text-sm text-muted-foreground">
          Pistolea la prenda que reapareció en el escáner de arriba. Si no
          aparece, márcala como <strong>comprada</strong> en su fila.
        </p>
      )}

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

          {progress.mode === "unidad" && <UnitGrid units={progress.units} />}

          <div className="overflow-hidden rounded-xl border">
            {progress.mode === "unidad" && (
              // En modo unidad estas filas son informativas: dicen QUÉ prendas
              // declaró el digitador, que es lo único que permite deducir qué
              // era la unidad que falta. El conteo de arriba manda.
              <p className="border-b bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
                Prendas declaradas en la OT — para saber qué buscar si falta una
                unidad.
              </p>
            )}
            {progress.items.map((item, index) => (
              <PackingItemRow
                key={`${item.item_id}-${item.scanned_quantity}`}
                item={item}
                bordered={index > 0}
                showPurchaseAction={isResolving}
                orderId={order.id}
              />
            ))}
          </div>
        </div>
      )}

      {canDispatch ? (
        <>
          <Button
            size="lg"
            className="h-12 w-full text-lg sm:w-auto sm:self-start sm:px-8"
            disabled={dispatch.isPending}
            onClick={async () => {
              try {
                await dispatch.mutateAsync({ note: "" });
                toast[isIncomplete ? "warning" : "success"](
                  isDispatched
                    ? "Prenda despachada a faena en envío aparte."
                    : isIncomplete
                      ? "Morral despachado a faena con prendas faltantes pendientes."
                      : "Morral despachado a faena.",
                );
              } catch (error) {
                toast.error(parseApiError(error).detail);
              }
            }}
          >
            {isDispatched ? "Despachar prenda a faena" : "Despachar a faena"}
          </Button>
          <p className="text-sm text-muted-foreground">
            {isDispatched ? (
              <>
                El morral ya viajó sin{" "}
                {pendingShipment.length === 1 ? "esta prenda" : "estas prendas"}
                . Al despacharla sale en su propio envío, que se registra en
                faena como una llegada aparte.
              </>
            ) : (
              <>
                El morral está cerrado y sigue en planta. Al despacharlo la OT
                pasa a <strong>Despachada</strong> y recién ahí se puede
                registrar su llegada a faena.
                {isIncomplete && (
                  <>
                    {" "}
                    Sale con la prenda faltante anotada; si aparece después, se
                    resuelve pistoleándola y viaja en un segundo envío.
                  </>
                )}
              </>
            )}
          </p>
        </>
      ) : (
        <>
          <Button
            size="lg"
            className="h-12 w-full text-lg sm:w-auto sm:self-start sm:px-8"
            disabled={finish.isPending}
            onClick={async () => {
              try {
                const result = await finish.mutateAsync({ note: "" });
                toast[result.status === "COMPLETADA" ? "success" : "warning"](
                  result.status === "COMPLETADA"
                    ? "Morral validado: OT completa, lista para despachar."
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
            Al cerrar, si falta alguna prenda la OT queda{" "}
            <strong>Incompleta</strong> con la discrepancia anotada; si está
            completa pasa a <strong>Completa</strong> y se puede imprimir la
            boleta. En ambos casos el morral queda en planta hasta que se
            despache.
          </p>
        </>
      )}

      {/* La boleta se emite al cerrar el morral (FLUJO_NEGOCIO.md §4, paso 6) y
          es la que después se pistolea para despacharlo, así que el botón
          sigue disponible mientras la guía está cerrada: si sale mal cortada o
          se moja en el andén, se reimprime desde acá. */}
      {(isClosed || isDispatched) && <ReceiptButton orderId={order.id} />}

      {order.missing_item_resolutions.length > 0 && (
        <ResolutionHistory resolutions={order.missing_item_resolutions} />
      )}
    </Card>
  );
}

/**
 * Imprime la boleta del morral en la etiquetera de la estación.
 *
 * Va por la etiquetera y no por el navegador porque este es el único equipo que
 * la tiene colgada: la boleta sale del mismo rollo que los adhesivos, con el
 * código de barras dibujado por el firmware de la impresora, que es lo que
 * garantiza que la pistola la lea a la primera pasada (ver main/zpl.ts).
 */
function ReceiptButton({ orderId }: { orderId: number }) {
  const print = usePrintReceipt(orderId);

  return (
    <div className="flex flex-col gap-2 sm:self-start">
      <Button
        variant="outline"
        size="lg"
        className="h-12 w-full text-lg sm:w-auto sm:px-8"
        disabled={print.isPending}
        onClick={async () => {
          try {
            await print.mutateAsync();
            toast.success("Boleta enviada a la etiquetera.");
          } catch (error) {
            // Que falle la impresora no invalida el cierre: el morral ya quedó
            // guardado en el servidor y la boleta se reintenta desde este mismo
            // botón, igual que las etiquetas del pesaje.
            toast.error(
              error instanceof Error ? error.message : parseApiError(error).detail,
            );
          }
        }}
      >
        <Printer className="size-5" />
        {print.isPending ? "Imprimiendo…" : "Imprimir boleta"}
      </Button>
    </div>
  );
}

// Una fila = una prenda. Muestra su progreso y, solo si la guía está
// Incompleta, la única acción que no se puede resolver pistoleando: declarar
// que se repuso comprando una nueva.
/**
 * Las prendas físicas del morral, una casilla por adhesivo.
 *
 * Es la vista que el modo por tipo no puede dar: de un vistazo se ve cuáles
 * volvieron y cuáles no, y el número de la casilla que quedó apagada es
 * exactamente el que hay que ir a buscar a la planta.
 */
function UnitGrid({
  units,
}: {
  units: components["schemas"]["PackingUnitProgressOut"][];
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {units.map((unit) => (
        <li
          key={unit.code}
          title={unit.code}
          className={cn(
            "flex size-11 items-center justify-center rounded-lg border font-mono text-base font-semibold tabular-nums",
            unit.is_scanned
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
              : "border-dashed bg-muted/40 text-muted-foreground",
          )}
        >
          {String(unit.sequence).padStart(2, "0")}
        </li>
      ))}
    </ul>
  );
}

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
            {resolution.shipped_at ? (
              <> · enviada a faena {formatDateTime(resolution.shipped_at)}</>
            ) : (
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {" "}
                · pendiente de envío
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
