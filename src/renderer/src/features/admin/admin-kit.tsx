import { useState } from "react";
import { Ban, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

// Piezas comunes de las pestañas de Configuración. Todas las pantallas de
// administración tienen la misma forma —buscar, listar, abrir una ficha,
// guardar— y conviene que se vean y se comporten igual: quien administra usa
// varias seguidas.

export const ADMIN_PAGE_SIZE = 25;

export function AdminToolbar({
  search,
  onSearch,
  placeholder = "Buscar…",
  filters,
  action,
}: {
  search?: string;
  onSearch?: (value: string) => void;
  placeholder?: string;
  filters?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {onSearch && (
          <div className="relative w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 pl-9"
              placeholder={placeholder}
              value={search ?? ""}
              onChange={(event) => onSearch(event.target.value)}
            />
          </div>
        )}
        {filters}
      </div>
      {action}
    </div>
  );
}

export function ActiveFilterSelect({
  value,
  onChange,
}: {
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
}) {
  return (
    <select
      className="h-11 rounded-lg border bg-background px-3 text-base"
      value={value === undefined ? "all" : String(value)}
      onChange={(event) =>
        onChange(event.target.value === "all" ? undefined : event.target.value === "true")
      }
    >
      <option value="true">Activos</option>
      <option value="false">Inactivos</option>
      <option value="all">Todos</option>
    </select>
  );
}

/** Estado de carga y vacío de un listado, y el contenedor de sus filas. */
export function AdminList({
  isLoading,
  isEmpty,
  emptyText,
  children,
}: {
  isLoading: boolean;
  isEmpty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isEmpty) {
    return <Card className="p-8 text-center text-base text-muted-foreground">{emptyText}</Card>;
  }
  return <div className="overflow-hidden rounded-xl border">{children}</div>;
}

export function AdminRow({
  title,
  subtitle,
  inactive,
  badges,
  onOpen,
  actions,
  first,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  inactive?: boolean;
  badges?: React.ReactNode;
  onOpen?: () => void;
  actions?: React.ReactNode;
  first?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 bg-card px-4 py-3",
        !first && "border-t",
        inactive && "opacity-60",
      )}
    >
      <button
        type="button"
        className="min-w-0 flex-1 text-left disabled:cursor-default"
        onClick={onOpen}
        disabled={!onOpen}
      >
        <p className="truncate text-base font-semibold">{title}</p>
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
      </button>
      {badges}
      {inactive && <Pill>Inactivo</Pill>}
      {actions}
    </div>
  );
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "primary" | "warning";
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-sm",
        tone === "muted" && "text-muted-foreground",
        tone === "primary" && "border-primary/30 bg-primary/10 font-medium text-primary",
        tone === "warning" && "border-amber-300 bg-amber-50 font-medium text-amber-800",
      )}
    >
      {children}
    </span>
  );
}

export function Pager({
  offset,
  total,
  onChange,
  pageSize = ADMIN_PAGE_SIZE,
}: {
  offset: number;
  total: number;
  onChange: (offset: number) => void;
  pageSize?: number;
}) {
  if (total <= pageSize) return null;
  const to = Math.min(offset + pageSize, total);
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {offset + 1}–{to} de {total}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - pageSize))}
        >
          <ChevronLeft className="size-4" />
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={to >= total}
          onClick={() => onChange(offset + pageSize)}
        >
          Siguiente
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/** Botón de desactivar con confirmación en línea (sin diálogo encima de otro). */
export function DeactivateButton({
  onConfirm,
  label = "Desactivar",
}: {
  onConfirm: () => Promise<void>;
  label?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  if (!confirming) {
    return (
      <Button variant="outline" size="sm" className="shrink-0" onClick={() => setConfirming(true)}>
        <Ban className="size-4" />
        {label}
      </Button>
    );
  }
  return (
    <div className="flex shrink-0 gap-2">
      <Button
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() => {
          setPending(true);
          void onConfirm().finally(() => {
            setPending(false);
            setConfirming(false);
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
        Sí, {label.toLowerCase()}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
        No
      </Button>
    </div>
  );
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  isSubmitting,
  submitLabel = "Guardar",
  wide,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitLabel?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[88vh] overflow-y-auto", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="flex flex-col gap-4"
        >
          {children}
          <DialogFooter className="mt-2">
            <Button type="submit" size="lg" className="h-12" disabled={isSubmitting}>
              {isSubmitting ? "Guardando…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  type = "text",
  autoFocus,
  maxLength,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  type?: string;
  autoFocus?: boolean;
  maxLength?: number;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      <Input
        className="h-12 text-base"
        type={type}
        value={value}
        autoFocus={autoFocus}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      <select
        className="h-12 rounded-lg border bg-background px-3 text-base"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function CheckField({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-start gap-3 rounded-lg border p-3", disabled && "opacity-60")}>
      <input
        type="checkbox"
        className="mt-0.5 size-5 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-base font-medium">{label}</span>
        {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
