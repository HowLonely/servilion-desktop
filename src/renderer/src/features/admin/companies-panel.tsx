import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { useClients, useFaenas } from "@/features/admin/use-admin";
import {
  useCompanies,
  useCreateCompany,
  useDeactivateCompany,
  useUpdateCompany,
} from "@/features/companies/use-companies";

import type { components } from "@/lib/api/schema";

type CompanyOut = components["schemas"]["CompanyOut"];

const ROLE_OPTIONS = [
  { value: "CONTRATISTA", label: "Contratista" },
  { value: "MANDANTE", label: "Mandante (se lava directo al cliente)" },
];
const SERVICE_OPTIONS = [
  { value: "PERSONAL", label: "Ropa de trabajador" },
  { value: "HOTELERIA", label: "Hotelería" },
];
const FLOW_OPTIONS = [
  { value: "FLUJO_1", label: "Flujo 1 · entrega en habitación" },
  { value: "FLUJO_2", label: "Flujo 2 · entrega solo al cliente" },
];
const BILLING_OPTIONS = [
  { value: "PRENDAS", label: "Por prenda" },
  { value: "KILOS", label: "Por kilo" },
];

const NEW_CLIENT = "__nuevo__";

/**
 * Empresas: de quién es la ropa. Siempre cuelgan de un cliente; si no se elige
 * uno, se crea un cliente con el mismo nombre (el caso "cliente = empresa").
 * El tipo de servicio decide si la empresa opera con guías (ropa de
 * trabajador) o con despachos de hotelería (hotelería).
 */
export function CompaniesPanel() {
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState<boolean | undefined>(true);
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<CompanyOut | "new" | null>(null);

  const { data: page, isLoading } = useCompanies({
    search: search || undefined,
    is_active: isActive,
    limit: ADMIN_PAGE_SIZE,
    offset,
  });
  const deactivate = useDeactivateCompany();
  const companies = page?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <AdminToolbar
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setOffset(0);
        }}
        placeholder="Buscar empresa…"
        filters={<ActiveFilterSelect value={isActive} onChange={(value) => { setIsActive(value); setOffset(0); }} />}
        action={
          <Button size="lg" className="h-11" onClick={() => setEditing("new")}>
            <Plus className="size-5" />
            Nueva empresa
          </Button>
        }
      />

      <AdminList isLoading={isLoading} isEmpty={companies.length === 0} emptyText="No hay empresas con estos filtros.">
        {companies.map((company, index) => (
          <AdminRow
            key={company.id}
            first={index === 0}
            inactive={!company.is_active}
            onOpen={() => setEditing(company)}
            title={company.name}
            subtitle={[company.client_name, company.faena_name, company.tax_id].filter(Boolean).join(" · ")}
            badges={
              <>
                <Pill tone={company.service_type === "HOTELERIA" ? "warning" : "muted"}>
                  {company.service_type === "HOTELERIA" ? "Hotelería" : "Ropa de trabajador"}
                </Pill>
                {company.is_contractor && <Pill>Contratista</Pill>}
              </>
            }
            actions={
              company.is_active && (
                <DeactivateButton
                  onConfirm={async () => {
                    try {
                      await deactivate.mutateAsync(company.id);
                      toast.success("Empresa desactivada.");
                    } catch (error) {
                      toast.error(parseApiError(error).detail);
                    }
                  }}
                />
              )
            }
          />
        ))}
      </AdminList>

      <Pager offset={offset} total={page?.count ?? 0} onChange={setOffset} />

      {editing !== null && (
        <CompanyDialog company={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function CompanyDialog({ company, onClose }: { company: CompanyOut | null; onClose: () => void }) {
  const create = useCreateCompany();
  const update = useUpdateCompany(company?.id ?? -1);
  const { data: clients } = useClients({ is_active: true, limit: 200 });
  const { data: faenas } = useFaenas();

  const [form, setForm] = useState({
    name: company?.name ?? "",
    client: company ? String(company.client_id) : NEW_CLIENT,
    faena_id: "",
    client_role: company?.client_role ?? "CONTRATISTA",
    tax_id: company?.tax_id ?? "",
    billing_type: company?.billing_type ?? "PRENDAS",
    service_type: company?.service_type ?? "PERSONAL",
    delivery_flow: company?.delivery_flow ?? "FLUJO_1",
    contact_name: company?.contact_name ?? "",
    phone: company?.phone ?? "",
  });
  const set = <K extends keyof typeof form>(key: K, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const isNewClient = form.client === NEW_CLIENT;

  async function submit(): Promise<void> {
    const { client, faena_id, ...rest } = form;
    const body = {
      ...rest,
      client_id: isNewClient ? null : Number(client),
      faena_id: isNewClient && faena_id ? Number(faena_id) : null,
    };
    try {
      if (company) await update.mutateAsync(body);
      else await create.mutateAsync(body);
      toast.success(company ? "Empresa actualizada." : "Empresa creada.");
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
      title={company ? "Editar empresa" : "Nueva empresa"}
      onSubmit={() => void submit()}
      isSubmitting={create.isPending || update.isPending}
    >
      <FieldRow>
        <TextField label="Nombre" value={form.name} onChange={(v) => set("name", v)} autoFocus={!company} />
        <TextField label="RUT" value={form.tax_id} onChange={(v) => set("tax_id", v)} />
      </FieldRow>
      <FieldRow>
        <SelectField
          label="Cliente (a quién se factura)"
          value={form.client}
          onChange={(v) => set("client", v)}
          options={[
            ...(company ? [] : [{ value: NEW_CLIENT, label: "Crear cliente con el mismo nombre" }]),
            ...(clients?.items ?? []).map((client) => ({ value: String(client.id), label: client.name })),
          ]}
        />
        {isNewClient ? (
          <SelectField
            label="Faena del cliente nuevo"
            value={form.faena_id}
            onChange={(v) => set("faena_id", v)}
            options={[
              { value: "", label: "Sin faena" },
              ...(faenas ?? []).map((faena) => ({ value: String(faena.id), label: faena.name })),
            ]}
          />
        ) : (
          <SelectField
            label="Tipo"
            value={form.client_role}
            onChange={(v) => set("client_role", v)}
            options={ROLE_OPTIONS}
            hint='Las contratistas llevan "Contratista" en la etiqueta y la boleta.'
          />
        )}
      </FieldRow>
      <FieldRow>
        <SelectField
          label="Servicio"
          value={form.service_type}
          onChange={(v) => set("service_type", v)}
          options={SERVICE_OPTIONS}
          hint="Hotelería aparece en el despacho de hotelería."
        />
        <SelectField
          label="Entrega"
          value={form.delivery_flow}
          onChange={(v) => set("delivery_flow", v)}
          options={FLOW_OPTIONS}
        />
      </FieldRow>
      <FieldRow>
        <SelectField
          label="Cobro"
          value={form.billing_type}
          onChange={(v) => set("billing_type", v)}
          options={BILLING_OPTIONS}
        />
        <TextField label="Contacto" value={form.contact_name} onChange={(v) => set("contact_name", v)} />
      </FieldRow>
      <TextField label="Teléfono" value={form.phone} onChange={(v) => set("phone", v)} />
    </FormDialog>
  );
}
