import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { parseApiError } from "@/lib/api/errors";
import { CheckField, FormDialog, Pill, TextField } from "@/features/admin/admin-kit";
import {
  useAdminCamps,
  useAdminRooms,
  useFaenas,
  useSaveCamp,
  useSaveFaena,
  useSaveRoom,
} from "@/features/admin/use-admin";

type Editing =
  | { kind: "faena"; id: number | null; name: string; is_active: boolean }
  | { kind: "camp"; id: number | null; name: string; is_active: boolean }
  | { kind: "room"; id: number | null; name: string; is_active: boolean };

/**
 * Faenas → campamentos → habitaciones, en tres columnas: se elige a la
 * izquierda y se ve el contenido a la derecha. Un campamento tiene cientos de
 * piezas y el número 101 de uno no es el 101 de otro, así que no se mezclan.
 *
 * El QR de la puerta lo genera el servidor al crear la habitación y se imprime
 * desde el panel web (hoja de etiquetas).
 */
export function SitesPanel() {
  const [faenaId, setFaenaId] = useState<number | null>(null);
  const [campId, setCampId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);

  const { data: faenas, isLoading: loadingFaenas } = useFaenas();
  const { data: camps, isLoading: loadingCamps } = useAdminCamps(faenaId);
  const { data: rooms, isLoading: loadingRooms } = useAdminRooms(campId);

  const saveFaena = useSaveFaena();
  const saveCamp = useSaveCamp();
  const saveRoom = useSaveRoom();

  async function submit(): Promise<void> {
    if (!editing) return;
    try {
      if (editing.kind === "faena") {
        await saveFaena.mutateAsync({ id: editing.id, name: editing.name, is_active: editing.is_active });
      } else if (editing.kind === "camp" && faenaId !== null) {
        await saveCamp.mutateAsync({
          id: editing.id,
          body: { faena_id: faenaId, name: editing.name, is_active: editing.is_active },
        });
      } else if (editing.kind === "room" && campId !== null) {
        await saveRoom.mutateAsync({
          id: editing.id,
          body: { camp_id: campId, number: editing.name, is_active: editing.is_active },
        });
      }
      toast.success("Guardado.");
      setEditing(null);
    } catch (error) {
      toast.error(parseApiError(error).detail);
    }
  }

  const titles = { faena: "faena", camp: "campamento", room: "habitación" } as const;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Column
        title="Faenas"
        isLoading={loadingFaenas}
        onAdd={() => setEditing({ kind: "faena", id: null, name: "", is_active: true })}
        items={(faenas ?? []).map((faena) => ({
          id: faena.id,
          label: faena.name,
          detail: `${faena.camps_count} campamentos`,
          active: faena.is_active,
        }))}
        selectedId={faenaId}
        onSelect={(id) => {
          setFaenaId(id);
          setCampId(null);
        }}
        onEdit={(item) => setEditing({ kind: "faena", id: item.id, name: item.label, is_active: item.active })}
      />
      <Column
        title="Campamentos"
        emptyText={faenaId === null ? "Elige una faena." : "Esta faena no tiene campamentos."}
        isLoading={faenaId !== null && loadingCamps}
        onAdd={faenaId === null ? undefined : () => setEditing({ kind: "camp", id: null, name: "", is_active: true })}
        items={(faenaId === null ? [] : camps ?? []).map((camp) => ({
          id: camp.id,
          label: camp.name,
          detail: `${camp.rooms_count} habitaciones`,
          active: camp.is_active,
        }))}
        selectedId={campId}
        onSelect={setCampId}
        onEdit={(item) => setEditing({ kind: "camp", id: item.id, name: item.label, is_active: item.active })}
      />
      <Column
        title="Habitaciones"
        emptyText={campId === null ? "Elige un campamento." : "Este campamento no tiene habitaciones."}
        isLoading={campId !== null && loadingRooms}
        onAdd={campId === null ? undefined : () => setEditing({ kind: "room", id: null, name: "", is_active: true })}
        items={(campId === null ? [] : rooms ?? []).map((room) => ({
          id: room.id,
          label: room.number,
          active: room.is_active,
        }))}
        onEdit={(item) => setEditing({ kind: "room", id: item.id, name: item.label, is_active: item.active })}
      />

      {editing && (
        <FormDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          title={`${editing.id === null ? "Nueva" : "Editar"} ${titles[editing.kind]}`}
          onSubmit={() => void submit()}
          isSubmitting={saveFaena.isPending || saveCamp.isPending || saveRoom.isPending}
        >
          <TextField
            label={editing.kind === "room" ? "Número" : "Nombre"}
            value={editing.name}
            autoFocus
            onChange={(name) => setEditing({ ...editing, name })}
          />
          {editing.id !== null && (
            <CheckField
              label="Activo"
              hint="Lo inactivo deja de ofrecerse en los formularios; su historial se conserva."
              checked={editing.is_active}
              onChange={(is_active) => setEditing({ ...editing, is_active })}
            />
          )}
        </FormDialog>
      )}
    </div>
  );
}

type ColumnItem = { id: number; label: string; detail?: string; active: boolean };

function Column({
  title,
  items,
  isLoading,
  emptyText = "Sin registros.",
  selectedId,
  onSelect,
  onAdd,
  onEdit,
}: {
  title: string;
  items: ColumnItem[];
  isLoading: boolean;
  emptyText?: string;
  selectedId?: number | null;
  onSelect?: (id: number) => void;
  onAdd?: () => void;
  onEdit: (item: ColumnItem) => void;
}) {
  return (
    <Card className="flex min-h-80 flex-col gap-0 overflow-hidden p-0">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {onAdd && (
          <Button variant="outline" size="sm" onClick={onAdd}>
            <Plus className="size-4" />
            Agregar
          </Button>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="m-4 h-40" />
      ) : items.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-2 border-b px-4 py-2.5 last:border-b-0",
                selectedId === item.id && "bg-primary/10",
                !item.active && "opacity-60",
              )}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => (onSelect ? onSelect(item.id) : onEdit(item))}
              >
                <p className="truncate font-medium">{item.label}</p>
                {item.detail && <p className="truncate text-xs text-muted-foreground">{item.detail}</p>}
              </button>
              {!item.active && <Pill>Inactivo</Pill>}
              {onSelect && (
                <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
                  Editar
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
