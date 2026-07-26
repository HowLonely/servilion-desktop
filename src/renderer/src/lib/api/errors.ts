import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

// Formatos de error que devuelve el backend (ver AI_CONTEXT.md):
// - { detail: string } para errores generales (401, 404, 400, 500).
// - { detail: string, errors: [...] } para errores de validación (422).
export type ApiValidationError = {
  loc?: Array<string | number>;
  msg?: string;
  type?: string;
};

export type ApiErrorBody = {
  detail: string;
  errors?: ApiValidationError[];
};

const FALLBACK_MESSAGE = "Ocurrió un error inesperado. Intenta nuevamente.";

export function parseApiError(error: unknown): ApiErrorBody {
  if (
    error &&
    typeof error === "object" &&
    "detail" in error &&
    typeof (error as { detail?: unknown }).detail === "string"
  ) {
    return error as ApiErrorBody;
  }
  return { detail: FALLBACK_MESSAGE };
}

// Mapea errors[].loc (ej. ["body", "payload", "name"]) al último segmento,
// que corresponde al nombre del campo en el formulario de react-hook-form.
export function applyServerErrors<TFieldValues extends FieldValues>(
  apiError: ApiErrorBody,
  setError: UseFormSetError<TFieldValues>,
): void {
  for (const validationError of apiError.errors ?? []) {
    const field = validationError.loc?.at(-1);
    if (typeof field === "string" && validationError.msg) {
      setError(field as Path<TFieldValues>, { message: validationError.msg });
    }
  }
}
