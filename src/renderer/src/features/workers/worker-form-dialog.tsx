import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { applyServerErrors, parseApiError } from "@/lib/api/errors";
import { CompanySelect } from "@/features/companies/company-select";
import { RoomSelect } from "@/features/camps/room-select";
import { useCreateWorker, useUpdateWorker } from "@/features/workers/use-workers";
import {
  SHIFT_PATTERNS,
  workerSchema,
  type WorkerFormValues,
} from "@/features/workers/worker-schema";

import type { components } from "@/lib/api/schema";

type WorkerOut = components["schemas"]["WorkerOut"];

function defaultValuesFor(worker?: WorkerOut): WorkerFormValues {
  return {
    company_id: worker?.company_id ?? 0,
    badge_code: worker?.badge_code ?? "",
    full_name: worker?.full_name ?? "",
    national_id: worker?.national_id ?? "",
    current_room_id: worker?.current_room_id ?? null,
    shift: worker?.shift ?? "",
    position: worker?.position ?? "",
    area: worker?.area ?? "",
    phone: worker?.phone ?? "",
  };
}

/**
 * Crear/editar trabajador. Solo la alcanza quien tiene `canManageWorkers`
 * (ADMIN): es el mismo formulario del panel web, portado sin cambios de fondo,
 * para el único rol de esta terminal que administra catálogo en vez de solo
 * consultarlo.
 */
export function WorkerFormDialog({
  worker,
  open,
  onOpenChange,
}: {
  /** Ausente = crear uno nuevo. */
  worker?: WorkerOut;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEdit = Boolean(worker);

  const createWorker = useCreateWorker();
  const updateWorker = useUpdateWorker(worker?.id ?? -1);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<WorkerFormValues>({
    resolver: zodResolver(workerSchema),
    defaultValues: defaultValuesFor(worker),
  });

  useEffect(() => {
    if (open) reset(defaultValuesFor(worker));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: WorkerFormValues): Promise<void> {
    try {
      if (isEdit) {
        await updateWorker.mutateAsync(values);
      } else {
        await createWorker.mutateAsync(values);
      }
      toast.success(isEdit ? "Trabajador actualizado." : "Trabajador creado.");
      onOpenChange(false);
    } catch (error) {
      const apiError = parseApiError(error);
      applyServerErrors(apiError, setError);
      toast.error(apiError.detail);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar trabajador" : "Nuevo trabajador"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel>Empresa</FieldLabel>
              <FieldContent>
                <CompanySelect
                  value={watch("company_id") || undefined}
                  onChange={(companyId) => setValue("company_id", companyId ?? 0)}
                />
                <FieldError errors={[errors.company_id]} />
              </FieldContent>
            </Field>
            <Field orientation="responsive">
              <FieldContent>
                <FieldLabel htmlFor="badge_code">Código/credencial</FieldLabel>
                <Input id="badge_code" className="h-12" {...register("badge_code")} />
                <FieldError errors={[errors.badge_code]} />
              </FieldContent>
              <FieldContent>
                <FieldLabel htmlFor="full_name">Nombre completo</FieldLabel>
                <Input id="full_name" className="h-12" {...register("full_name")} />
                <FieldError errors={[errors.full_name]} />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="national_id">RUN</FieldLabel>
              <FieldContent>
                <Input id="national_id" className="h-12" {...register("national_id")} />
                <FieldError errors={[errors.national_id]} />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Campamento y habitación</FieldLabel>
              <FieldContent>
                <RoomSelect
                  value={watch("current_room_id")}
                  onChange={(roomId) => setValue("current_room_id", roomId)}
                />
                <FieldError errors={[errors.current_room_id]} />
              </FieldContent>
            </Field>
            <Field orientation="responsive">
              <FieldContent>
                <FieldLabel htmlFor="shift">Turno</FieldLabel>
                <select
                  id="shift"
                  className="h-12 rounded-lg border bg-background px-3 text-base"
                  {...register("shift")}
                >
                  <option value="">Sin turno</option>
                  {SHIFT_PATTERNS.map((pattern) => (
                    <option key={pattern} value={pattern}>
                      {pattern}
                    </option>
                  ))}
                </select>
                <FieldError errors={[errors.shift]} />
              </FieldContent>
              <FieldContent>
                <FieldLabel htmlFor="position">Cargo</FieldLabel>
                <Input id="position" className="h-12" {...register("position")} />
                <FieldError errors={[errors.position]} />
              </FieldContent>
            </Field>
            <Field orientation="responsive">
              <FieldContent>
                <FieldLabel htmlFor="area">Área</FieldLabel>
                <Input id="area" className="h-12" {...register("area")} />
                <FieldError errors={[errors.area]} />
              </FieldContent>
              <FieldContent>
                <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
                <Input id="phone" className="h-12" {...register("phone")} />
                <FieldError errors={[errors.phone]} />
              </FieldContent>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" size="lg" className="h-12" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
