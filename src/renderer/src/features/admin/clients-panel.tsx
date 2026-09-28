import { useEffect, useState } from "react";
import { Plus, Tag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { parseApiError } from "@/lib/api/errors";
import {
  ActiveFilterSelect,
  ADMIN_PAGE_SIZE,
  AdminList,
  AdminRow,
  AdminToolbar,
  DeactivateButton,
  FieldRow,
  FormDialog,
  Pager,
  Pill,
  SelectField,
  TextField,
} from "@/features/admin/admin-kit";
import {
  useClientPrices,
  useClients,
  useDeactivateClient,
  useFaenas,
  useSaveClient,
  useSaveClientPrices,
  type ClientOut,
} from "@/features/admin/use-admin";
import { GARMENT_TYPES_SELECT_LIMIT, useGarmentTypes } from "@/features/garments/use-garment-types";

/**
 * Clientes: a quién se le factura. Agrupan empresas (la mandante y sus
 * contratistas), definen la faena y el prefijo del ref, y tienen su propia
 * lista de precios por prenda.
 */
export function ClientsPanel() {
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState<boolean | undefined>(true);
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<ClientOut | "new" | null>(null);
  const [pricing, setPricing] = useState<ClientOut | null>(null);

  const { data: page, isLoading } = useClients({
    search: search || undefined,
    is_active: isActive,
    limit: ADMIN_PAGE_SIZE,
    offset,
  });
  const deactivate = useDeactivateClient();
  const clients = page?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <AdminToolbar
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setOffset(0);
        }}
        placeholder="Buscar cliente…"
        filters={<ActiveFilterSelect value={isActive} onChange={(value) => { setIsActive(value); setOffset(0); }} />}
        action={
          <Button size="lg" className="h-11" onClick={() => setEditing("new")}>
            <Plus className="size-5" />
            Nuevo cliente
          </Button>
        }
      />

      <AdminList isLoading={isLoading} isEmpty={clients.length === 0} emptyText="No hay clientes con estos filtros.">
        {clients.map((client, index) => (
          <AdminRow
            key={client.id}
            first={index === 0}
            inactive={!client.is_active}
            onOpen={() => setEditing(client)}
            title={client.name}
            subtitle={[client.faena_name || "Sin faena", client.tax_id, client.contact_name].filter(Boolean).join(" · ")}
            badges={
              <>
                {client.reference_prefix && <Pill>Ref {client.reference_prefix}</Pill>}
                <Pill>
                  {client.is_single_company
                    ? "Cliente = empresa"
                    : `${client.company_count} ${client.company_count === 1 ? "empresa" : "empresas"}`}
                </Pill>
              </>
            }
            actions={
              <>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => setPricing(client)}>
                  <Tag className="size-4" />
                  Precios
                </Button>
                {client.is_active && (
                  <DeactivateButton
                    onConfirm={async () => {
                      try {
                        await deactivate.mutateAsync(client.id);
                        toast.success("Cliente desactivado.");
                      } catch (error) {
                        toast.error(parseApiError(error).detail);
                      }
                    }}
                  />
                )}
              </>
            }
          />
        ))}
      </AdminList>

      <Pager offset={offset} total={page?.count ?? 0} onChange={setOffset} />

      {editing !== null && (
        <ClientDialog client={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
      {pricing && <PricesDialog client={pricing} onClose={() => setPricing(null)} />}
    </div>
  );
}

function ClientDialog({ client, onClose }: { client: ClientOut | null; onClose: () => void }) {
  const save = useSaveClient();
  const { data: faenas } = useFaenas();
  const [form, setForm] = useState({
    name: client?.name ?? "",
    tax_id: client?.tax_id ?? "",
    faena_id: client?.faena_id ? String(client.faena_id) : "",
    reference_prefix: client?.reference_prefix ?? "",
    contact_name: client?.contact_name ?? "",
    phone: client?.phone ?? "",
  });
  const set = <K extends keyof typeof form>(key: K, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  async function submit(): Promise<void> {
    try {
      await save.mutateAsync({
        id: client?.id ?? null,
        body: { ...form, faena_id: form.faena_id ? Number(form.faena_id) : null },
      });
      toast.success(client ? "Cliente actualizado." : "Cliente creado.");
      onClose();
    } catch (error) {
      toast.error(parseApiError(error).detail);
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={client ? "Editar cliente" : "Nuevo cliente"}
      onSubmit={() => void submit()}
      isSubmitting={save.isPending}
    >
      <TextField label="Nombre" value={form.name} onChange={(v) => set("name", v)} autoFocus={!client} />
      <FieldRow>
        <TextField label="RUT" value={form.tax_id} onChange={(v) => set("tax_id", v)} />
        <TextField
          label="Prefijo del ref"
          value={form.reference_prefix}
          onChange={(v) => set("reference_prefix", v.toUpperCase())}
          maxLength={3}
          hint='La letra de "P1375A". Todas sus empresas la comparten.'
        />
      </FieldRow>
      <SelectField
        label="Faena"
        value={form.faena_id}
        onChange={(v) => set("faena_id", v)}
        options={[
          { value: "", label: "Sin faena" },
          ...(faenas ?? []).map((faena) => ({ value: String(faena.id), label: faena.name })),
        ]}
        hint="Se imprime en la etiqueta y la boleta; la heredan todas sus empresas."
      />
      <FieldRow>
        <TextField label="Contacto" value={form.contact_name} onChange={(v) => set("contact_name", v)} />
        <TextField label="Teléfono" value={form.phone} onChange={(v) => set("phone", v)} />
      </FieldRow>
    </FormDialog>
  );
}

/** Lista de precios por prenda del cliente. Una celda vacía = sin precio definido. */
function PricesDialog({ client, onClose }: { client: ClientOut; onClose: () => void }) {
  const { data: prices, isLoading } = useClientPrices(client.id);
  const { data: garments } = useGarmentTypes({ is_active: true, limit: GARMENT_TYPES_SELECT_LIMIT });
  const save = useSaveClientPrices(client.id);
  const [values, setValues] = useState<Record<number, string>>({});

  useEffect(() => {
    if (prices) {
      setValues(Object.fromEntries(prices.map((price) => [price.garment_type_id, String(price.unit_price)])));
    }
  }, [prices]);

  async function submit(): Promise<void> {
    const body = Object.entries(values)
      .filter(([, value]) => value.trim() !== "")
      .map(([garmentTypeId, value]) => ({
        garment_type_id: Number(garmentTypeId),
        unit_price: Number(value.replace(",", ".")),
      }));
    if (body.some((price) => Number.isNaN(price.unit_price) || price.unit_price < 0)) {
      toast.error("Hay un precio que no es un número válido.");
      return;
    }
    try {
      await save.mutateAsync(body);
      toast.success("Precios guardados.");
      onClose();
    } catch (error) {
      toast.error(parseApiError(error).detail);
    }
  }

  return (
    <FormDialog
      open
      wide
      onOpenChange={(open) => !open && onClose()}
      title={`Precios de ${client.name}`}
      description="Precio por prenda. Lo usan todas las empresas del cliente."
      onSubmit={() => void submit()}
      isSubmitting={save.isPending}
      submitLabel="Guardar precios"
    >
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          {(garments?.items ?? []).map((garment, index) => (
            <div key={garment.id} className={`flex items-center gap-3 px-3 py-2 ${index > 0 ? "border-t" : ""}`}>
              <span className="min-w-16 rounded-md bg-muted px-2 py-1 text-center font-mono text-sm font-bold">
                {garment.code}
              </span>
              <span className="min-w-0 flex-1 truncate">{garment.name}</span>
              <Input
                className="h-10 w-32 text-right tabular-nums"
                inputMode="decimal"
                placeholder="—"
                value={values[garment.id] ?? ""}
                onChange={(event) => setValues((previous) => ({ ...previous, [garment.id]: event.target.value }))}
              />
            </div>
          ))}
        </div>
      )}
    </FormDialog>
  );
}
