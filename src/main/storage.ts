import type { StorageUploadRequest, StorageUploadResult } from "../shared/types";

// Subida de archivos a S3 con el POST prefirmado que firma el backend. El
// archivo nunca pasa por Django: el backend solo autoriza la subida (clave del
// objeto, tipo de contenido y vencimiento) y luego registra la clave en la guía.

/** Una foto de 5 MP en JPEG pesa ~1-3 MB; con internet de planta puede tardar. */
const UPLOAD_TIMEOUT_MS = 60_000;

/**
 * Solo se sube a S3. La URL la entrega el backend, pero el canal IPC lo puede
 * invocar cualquier código del renderer: sin este filtro sería un POST
 * arbitrario a cualquier host con los archivos del equipo.
 */
function isS3Url(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".amazonaws.com");
  } catch {
    return false;
  }
}

/** S3 responde los errores en XML: `<Error><Message>...</Message></Error>`. */
function s3ErrorMessage(body: string): string | null {
  const match = body.match(/<Message>([^<]*)<\/Message>/);
  return match ? match[1] : null;
}

export async function uploadToStorage(
  request: StorageUploadRequest,
): Promise<StorageUploadResult> {
  if (!isS3Url(request.uploadUrl)) {
    return { ok: false, detail: "Destino de subida no permitido." };
  }

  // El orden importa: S3 exige que los campos firmados vayan antes que `file`.
  const form = new FormData();
  for (const [key, value] of Object.entries(request.fields)) {
    form.append(key, value);
  }
  form.append(
    "file",
    new Blob([request.data], { type: request.contentType }),
    request.filename,
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(request.uploadUrl, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (response.ok) return { ok: true };

    const reason = s3ErrorMessage(await response.text());
    console.error(`S3 rechazó la subida (${response.status}):`, reason);
    return {
      ok: false,
      detail: `El almacenamiento rechazó la foto (${response.status}${reason ? `: ${reason}` : ""}).`,
    };
  } catch {
    return {
      ok: false,
      detail: "No se pudo subir la foto: revisa la conexión a internet.",
    };
  } finally {
    clearTimeout(timer);
  }
}
