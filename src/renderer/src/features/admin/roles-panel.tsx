import { useMemo, useState } from "react";
import { Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { parseApiError } from "@/lib/api/errors";
import {
  AdminList,
  AdminRow,
  AdminToolbar,
  CheckField,
  FormDialog,
  Pill,
  TextField,
} from "@/features/admin/admin-kit";
import {
  useDeleteRole,
  usePermissionCatalog,
  useRoles,
  useSaveRole,
  type PermissionOut,
  type RoleOut,
} from "@/features/admin/use-admin";

/**
 * Roles: un nombre y el conjunto de permisos que habilita.
 *
 * Cambiar los permisos de un rol afecta de inmediato a todos sus usuarios (en
 * su próximo inicio de sesión o recarga). El rol Administrador tiene siempre
 * todo y no se edita: es la garantía de que nadie queda afuera del sistema.
 */
export function RolesPanel() {
  const { data: roles, isLoading } = useRoles();
  const { data: catalog } = usePermissionCatalog();
  const [editing, setEditing] = useState<RoleOut | "new" | null>(null);

  const labels = useMemo(
    () => Object.fromEntries((catalog ?? []).map((permission) => [permission.code, permission.label])),
    [catalog],
  );

  return (
    <div className="flex flex-col gap-4">
      <AdminToolbar
        action={
          <Button size="lg" className="h-11" onClick={() => setEditing("new")}>
            <Plus className="size-5" />
            Nuevo rol
          </Button>
        }
      />

      <AdminList isLoading={isLoading} isEmpty={(roles ?? []).length === 0} emptyText="No hay roles.">
        {(roles ?? []).map((role, index) => (
          <AdminRow
            key={role.id}
            first={index === 0}
            inactive={!role.is_active}
            onOpen={role.is_superrole ? undefined : () => setEditing(role)}
            title={
              <>
                {role.name}
                {role.is_superrole && <Lock className="ml-2 inline size-4 text-muted-foreground" />}
              </>
            }
            subtitle={
              role.is_superrole
                ? "Todos los permisos, siempre."
                : role.permissions.map((code) => labels[code] ?? code).join(" · ") || "Sin permisos"
            }
            badges={
              <>
                {role.is_system && <Pill>Sistema</Pill>}
                <Pill tone="primary">
                  {role.user_count} {role.user_count === 1 ? "usuario" : "usuarios"}
                </Pill>
              </>
            }
          />
        ))}
      </AdminList>

      {editing !== null && catalog && (
        <RoleDialog role={editing === "new" ? null : editing} catalog={catalog} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function RoleDialog({
  role,
  catalog,
  onClose,
}: {
  role: RoleOut | null;
  catalog: PermissionOut[];
  onClose: () => void;
}) {
  const save = useSaveRole();
  const remove = useDeleteRole();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [isActive, setIsActive] = useState(role?.is_active ?? true);
  const [permissions, setPermissions] = useState<Set<string>>(new Set(role?.permissions ?? []));

  const groups = useMemo(() => {
    const byGroup = new Map<string, PermissionOut[]>();
    for (const permission of catalog) {
      byGroup.set(permission.group, [...(byGroup.get(permission.group) ?? []), permission]);
    }
    return [...byGroup.entries()];
  }, [catalog]);

  function toggle(code: string, checked: boolean): void {
    setPermissions((previous) => {
      const next = new Set(previous);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  }

  async function submit(): Promise<void> {
    try {
      await save.mutateAsync({
        id: role?.id ?? null,
        body: { name, description, permissions: [...permissions], is_active: isActive },
      });
      toast.success(role ? "Rol actualizado." : "Rol creado.");
      onClose();
    } catch (error) {
      toast.error(parseApiError(error).detail);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!role) return;
    try {
      await remove.mutateAsync(role.id);
      toast.success("Rol eliminado.");
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
      title={role ? `Rol: ${role.name}` : "Nuevo rol"}
      description="Marca lo que pueden hacer los usuarios con este rol."
      onSubmit={() => void submit()}
      isSubmitting={save.isPending}
    >
      <TextField label="Nombre" value={name} onChange={setName} autoFocus={!role} maxLength={60} />
      <TextField label="Descripción (opcional)" value={description} onChange={setDescription} maxLength={200} />

      {groups.map(([group, permissionsOfGroup]) => (
        <fieldset key={group} className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold tracking-tight text-muted-foreground">{group}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {permissionsOfGroup.map((permission) => (
              <CheckField
                key={permission.code}
                label={permission.label}
                hint={permission.description}
                checked={permissions.has(permission.code)}
                onChange={(checked) => toggle(permission.code, checked)}
              />
            ))}
          </div>
        </fieldset>
      ))}

      {role && (
        <CheckField
          label="Rol activo"
          hint="Un rol inactivo no otorga ningún permiso. Solo se puede desactivar sin usuarios activos."
          checked={isActive}
          onChange={setIsActive}
        />
      )}

      {role && !role.is_system && (
        <Button
          type="button"
          variant="outline"
          className="self-start text-destructive"
          disabled={remove.isPending || role.user_count > 0}
          onClick={() => void handleDelete()}
        >
          <Trash2 className="size-4" />
          {role.user_count > 0 ? "No se puede borrar: tiene usuarios" : "Borrar rol"}
        </Button>
      )}
    </FormDialog>
  );
}
