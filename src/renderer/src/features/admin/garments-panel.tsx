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
  CheckField,
  FieldRow,
  FormDialog,
  Pager,
  Pill,
  TextField,
} from "@/features/admin/admin-kit";
import {
  useCreateGarmentType,
  useGarmentTypes,
  useUpdateGarmentType,
} from "@/features/garments/use-garment-types";

import type { components } from "@/lib/api/schema";

type GarmentTypeOut = components["schemas"]["GarmentTypeOut"];

/**
 * Catálogo de prendas. El código es lo que va impreso en la etiqueta por tipo
 * (`P1005-TOA`) y lo que el operador reconoce de un vistazo: conviene corto.
 */
export function GarmentsPanel() {
  const [isActive, setIsActive] = useState<boolean | undefined>(true);
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<GarmentTypeOut | "new" | null>(null);

  const { data: page, isLoading } = useGarmentTypes({ is_active: isActive, limit: ADMIN_PAGE_SIZE, offset });
  const garments = page?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <AdminToolbar
        filters={<ActiveFilterSelect value={isActive} onChange={(value) => { setIsActive(value); setOffset(0); }} />}
        action={
          <Button size="lg" className="h-11" onClick={() => setEditing("new")}>
            <Plus className="size-5" />
            Nueva prenda
          </Button>
        }
      />

      <AdminList isLoading={isLoading} isEmpty={garments.length === 0} emptyText="No hay prendas con estos filtros.">
        {garments.map((garment, index) => (
          <AdminRow
            key={garment.id}
            first={index === 0}
            inactive={!garment.is_active}
            onOpen={() => setEditing(garment)}
            title={
              <>
                <span className="mr-2 rounded-md bg-muted px-2 py-0.5 font-mono text-sm">{garment.code}</span>
                {garment.name}
              </>
            }
            badges={garment.is_linen && <Pill tone="warning">Hotelería</Pill>}
          />
        ))}
      </AdminList>

      <Pager offset={offset} total={page?.count ?? 0} onChange={setOffset} />

      {editing !== null && (
        <GarmentDialog garment={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function GarmentDialog({ garment, onClose }: { garment: GarmentTypeOut | null; onClose: () => void }) {
  const create = useCreateGarmentType();
  const update = useUpdateGarmentType(garment?.id ?? -1);
  const [code, setCode] = useState(garment?.code ?? "");
  const [name, setName] = useState(garment?.name ?? "");
  const [isLinen, setIsLinen] = useState(garment?.is_linen ?? false);
  const [isActive, setIsActive] = useState(garment?.is_active ?? true);

  async function submit(): Promise<void> {
    const body = { code, name, is_linen: isLinen, is_active: isActive };
    try {
      if (garment) await update.mutateAsync(body);
      else await create.mutateAsync(body);
      toast.success(garment ? "Prenda actualizada." : "Prenda creada.");
      onClose();
    } catch (error) {
      toast.error(parseApiError(error).detail);
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={garment ? "Editar prenda" : "Nueva prenda"}
      onSubmit={() => void submit()}
      isSubmitting={create.isPending || update.isPending}
    >
      <FieldRow>
        <TextField
          label="Código"
          value={code}
          onChange={(v) => setCode(v.toUpperCase())}
          maxLength={10}
          autoFocus={!garment}
          hint="Corto: va en la etiqueta."
        />
        <TextField label="Nombre" value={name} onChange={setName} maxLength={60} />
      </FieldRow>
      <CheckField
        label="Se usa en hotelería"
        hint="Aparece en el despacho de lencería y en los saldos por campamento."
        checked={isLinen}
        onChange={setIsLinen}
      />
      {garment && <CheckField label="Activa" checked={isActive} onChange={setIsActive} />}
    </FormDialog>
  );
}
