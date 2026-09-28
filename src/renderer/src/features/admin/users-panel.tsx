import { useState } from "react";
import { KeyRound, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { parseApiError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session-provider";
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
  SelectField,
  TextField,
} from "@/features/admin/admin-kit";
import {
  useRoles,
  useSaveStaffUser,
  useSetPassword,
  useStaffUsers,
  type StaffUserOut,
} from "@/features/admin/use-admin";

/**
 * Usuarios del staff: quién entra a las terminales, a la web y a la app móvil.
 *
 * Lo que cada uno puede hacer no se define aquí sino en su rol (pestaña Roles).
 * El backend impide que alguien se dé más permisos de los que tiene: solo un
 * administrador asigna el rol Administrador.
 */
export function UsersPanel() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [isActive, setIsActive] = useState<boolean | undefined>(true);
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<StaffUserOut | "new" | null>(null);
  const [passwordFor, setPasswordFor] = useState<StaffUserOut | null>(null);

  const { data: page, isLoading } = useStaffUsers({
    search: search || undefined,
    role: role || undefined,
    is_active: isActive,
    limit: ADMIN_PAGE_SIZE,
    offset,
  });
  const { data: roles } = useRoles();
  const users = page?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <AdminToolbar
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setOffset(0);
        }}
        placeholder="Buscar por usuario o nombre…"
        filters={
          <>
            <select
              className="h-11 rounded-lg border bg-background px-3 text-base"
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setOffset(0);
              }}
            >
              <option value="">Todos los roles</option>
              {roles?.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
            <ActiveFilterSelect
              value={isActive}
              onChange={(value) => {
                setIsActive(value);
                setOffset(0);
              }}
            />
          </>
        }
        action={
          <Button size="lg" className="h-11" onClick={() => setEditing("new")}>
            <UserPlus className="size-5" />
            Nuevo usuario
          </Button>
        }
      />

      <AdminList isLoading={isLoading} isEmpty={users.length === 0} emptyText="No hay usuarios con estos filtros.">
        {users.map((user, index) => (
          <AdminRow
            key={user.id}
            first={index === 0}
            inactive={!user.is_active}
            onOpen={() => setEditing(user)}
            title={
              <>
                {`${user.first_name} ${user.last_name}`.trim() || user.username}
                <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">{user.username}</span>
              </>
            }
            subtitle={user.email || user.phone || undefined}
            badges={<Pill tone="primary">{user.role_name}</Pill>}
            actions={
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => setPasswordFor(user)}>
                <KeyRound className="size-4" />
                Contraseña
              </Button>
            }
          />
        ))}
      </AdminList>

      <Pager offset={offset} total={page?.count ?? 0} onChange={setOffset} />

      {editing !== null && (
        <UserDialog
          user={editing === "new" ? null : editing}
          roles={roles ?? []}
          onClose={() => setEditing(null)}
        />
      )}
      {passwordFor && <PasswordDialog user={passwordFor} onClose={() => setPasswordFor(null)} />}
    </div>
  );
}

function UserDialog({
  user,
  roles,
  onClose,
}: {
  user: StaffUserOut | null;
  roles: { code: string; name: string; is_active: boolean }[];
  onClose: () => void;
}) {
  const { user: me } = useSession();
  const save = useSaveStaffUser();
  const activeRoles = roles.filter((role) => role.is_active || role.code === user?.role);

  const [form, setForm] = useState({
    username: user?.username ?? "",
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    role: user?.role ?? activeRoles.find((role) => role.code !== "ADMIN")?.code ?? "",
    password: "",
    is_active: user?.is_active ?? true,
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  async function submit(): Promise<void> {
    try {
      const { password, ...rest } = form;
      if (user) {
        await save.mutateAsync({ id: user.id, body: rest });
      } else {
        await save.mutateAsync({ id: null, body: { ...rest, password } });
      }
      toast.success(user ? "Usuario actualizado." : "Usuario creado.");
      onClose();
    } catch (error) {
      toast.error(parseApiError(error).detail);
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={user ? "Editar usuario" : "Nuevo usuario"}
      description="El rol decide a qué estaciones y pantallas entra."
      onSubmit={() => void submit()}
      isSubmitting={save.isPending}
    >
      <FieldRow>
        <TextField label="Nombre" value={form.first_name} onChange={(v) => set("first_name", v)} autoFocus />
        <TextField label="Apellido" value={form.last_name} onChange={(v) => set("last_name", v)} />
      </FieldRow>
      <TextField
        label="Usuario"
        value={form.username}
        onChange={(v) => set("username", v.trim())}
        hint="Con esto inicia sesión. Sin espacios."
      />
      <SelectField
        label="Rol"
        value={form.role}
        onChange={(v) => set("role", v)}
        options={activeRoles.map((role) => ({ value: role.code, label: role.name }))}
      />
      {!user && (
        <TextField
          label="Contraseña"
          type="password"
          value={form.password}
          onChange={(v) => set("password", v)}
          hint="Mínimo 8 caracteres, que no sea solo números ni una contraseña común."
        />
      )}
      <FieldRow>
        <TextField label="Correo (opcional)" value={form.email} onChange={(v) => set("email", v)} />
        <TextField label="Teléfono (opcional)" value={form.phone} onChange={(v) => set("phone", v)} />
      </FieldRow>
      {user && (
        <CheckField
          label="Activo"
          hint="Un usuario inactivo no puede iniciar sesión. Su historial se conserva."
          checked={form.is_active}
          disabled={user.id === me?.id}
          onChange={(v) => set("is_active", v)}
        />
      )}
    </FormDialog>
  );
}

function PasswordDialog({ user, onClose }: { user: StaffUserOut; onClose: () => void }) {
  const setPassword = useSetPassword();
  const [password, setValue] = useState("");
  const [confirm, setConfirm] = useState("");

  async function submit(): Promise<void> {
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    try {
      await setPassword.mutateAsync({ userId: user.id, password });
      toast.success(`Contraseña de ${user.username} actualizada.`);
      onClose();
    } catch (error) {
      toast.error(parseApiError(error).detail);
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Contraseña de ${user.username}`}
      description="La sesión que tenga abierta en otras terminales sigue activa hasta que expire."
      onSubmit={() => void submit()}
      isSubmitting={setPassword.isPending}
      submitLabel="Cambiar contraseña"
    >
      <TextField label="Nueva contraseña" type="password" value={password} onChange={setValue} autoFocus />
      <TextField label="Repite la contraseña" type="password" value={confirm} onChange={setConfirm} />
    </FormDialog>
  );
}
