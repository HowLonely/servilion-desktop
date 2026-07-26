import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const APP_TIME_ZONE = "America/Santiago";

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return formatInTimeZone(value, APP_TIME_ZONE, "dd-MM-yyyy HH:mm");
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return formatInTimeZone(value, APP_TIME_ZONE, "dd-MM-yyyy");
}

// Convierte una fecha local (America/Santiago) elegida en un <input type="datetime-local">
// a un ISO string en UTC, listo para enviar al backend.
export function localInputToIsoUtc(localValue: string): string {
  return fromZonedTime(localValue, APP_TIME_ZONE).toISOString();
}

// Convierte un rango de fechas (America/Santiago, <input type="date">) al día
// completo en UTC, listo para enviar al backend como date_from/date_to.
export function dayRangeToIsoUtc(
  dateFromLocal: string,
  dateToLocal: string,
): { date_from: string; date_to: string } {
  return {
    date_from: fromZonedTime(`${dateFromLocal}T00:00:00`, APP_TIME_ZONE).toISOString(),
    date_to: fromZonedTime(`${dateToLocal}T23:59:59`, APP_TIME_ZONE).toISOString(),
  };
}

// Fecha (YYYY-MM-DD) de hace `daysAgo` días, en America/Santiago.
export function dateInputDaysAgo(daysAgo: number): string {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return formatInTimeZone(date, APP_TIME_ZONE, "yyyy-MM-dd");
}
