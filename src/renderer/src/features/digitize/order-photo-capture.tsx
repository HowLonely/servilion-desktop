import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, RefreshCw, RotateCw, Trash2, VideoOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useStationConfig } from "@/lib/use-station-config";
import { useTouchMode } from "@/lib/use-touch-mode";

import type { CameraRotation } from "@shared/types";

// Foto de la OT física al digitalizarla. La cámara es una cámara de documentos
// USB (JETION o similar) montada en un brazo sobre el mesón: Windows la ve como
// una webcam común (UVC), así que se lee con getUserMedia sin driver propio.
//
// La foto se toma antes de guardar la guía y queda en memoria; la sube a S3
// quien guarda la guía (ver `CreateOrderForm`), porque recién ahí existe el id
// al que se asocia.

/** Se pide lo más alto posible; Chromium baja a lo que la cámara soporte. */
const IDEAL_WIDTH = 4096;
const IDEAL_HEIGHT = 3072;
/** Lado mayor de la foto guardada: legible de sobra, y ~1-2 MB en JPEG. */
const MAX_PHOTO_SIDE = 3264;
const JPEG_QUALITY = 0.85;
/** Lado mayor de la vista en vivo. No hace falta dibujar 5 MP 30 veces por segundo. */
const MAX_PREVIEW_SIDE = 960;

const SHORTCUT_KEY = "F2";

/** Nombres con que suelen anunciarse las cámaras de documentos. */
const DOCUMENT_CAMERA = /jetion|document|doc\s?cam|visualizer|scanner/i;

type CameraState =
  | { status: "starting" }
  | { status: "live" }
  | { status: "no-camera" }
  | { status: "error"; detail: string };

export function OrderPhotoCapture({
  photo,
  onChange,
}: {
  photo: Blob | null;
  onChange: (photo: Blob | null) => void;
}) {
  const { config, update } = useStationConfig();
  const touchMode = useTouchMode();
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[] | null>(null);
  const [camera, setCamera] = useState<CameraState>({ status: "starting" });
  const [capturing, setCapturing] = useState(false);

  const rotation: CameraRotation = config?.cameraRotation ?? 0;
  const deviceId = useMemo(
    () => pickDevice(devices, config?.cameraDeviceId),
    [devices, config?.cameraDeviceId],
  );
  // La cámara solo está encendida mientras no hay foto: con la foto tomada no
  // hay nada que mirar en vivo, y se libera el dispositivo.
  const live = photo === null;

  const photoUrl = useObjectUrl(photo);

  // --- Cámaras conectadas (se vuelve a mirar si enchufan o sacan una) ---
  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const found = await listCameras();
      if (!cancelled) setDevices(found);
    }

    void refresh();
    navigator.mediaDevices.addEventListener("devicechange", refresh);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener("devicechange", refresh);
    };
  }, []);

  // --- Flujo de video de la cámara elegida ---
  useEffect(() => {
    if (!live || devices === null) return;
    if (!deviceId) {
      setCamera({ status: "no-camera" });
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    setCamera({ status: "starting" });

    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: IDEAL_WIDTH },
          height: { ideal: IDEAL_HEIGHT },
        },
      })
      .then(async (opened) => {
        if (cancelled) {
          stopStream(opened);
          return;
        }
        stream = opened;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = opened;
        await video.play();
        if (!cancelled) setCamera({ status: "live" });
      })
      .catch((error: unknown) => {
        if (!cancelled) setCamera({ status: "error", detail: cameraErrorMessage(error) });
      });

    return () => {
      cancelled = true;
      if (stream) stopStream(stream);
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [live, deviceId, devices]);

  // --- Vista en vivo, ya girada como va a quedar la foto ---
  useEffect(() => {
    if (camera.status !== "live" || !live) return;
    let frame = 0;

    function draw() {
      const video = videoRef.current;
      const canvas = previewRef.current;
      if (video && canvas && video.videoWidth > 0) {
        drawRotated(video, canvas, rotation, MAX_PREVIEW_SIDE);
      }
      frame = requestAnimationFrame(draw);
    }

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [camera.status, live, rotation]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || camera.status !== "live" || video.videoWidth === 0) return;
    setCapturing(true);
    try {
      const canvas = document.createElement("canvas");
      drawRotated(video, canvas, rotation, MAX_PHOTO_SIDE);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
      );
      if (blob) onChange(blob);
    } finally {
      setCapturing(false);
    }
  }, [camera.status, rotation, onChange]);

  // F2 toma la foto (o la repite) sin soltar el teclado, que es como se
  // digitaliza. No se usa Enter porque ya agrega prendas y guarda la guía.
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key !== SHORTCUT_KEY) return;
      event.preventDefault();
      if (live) void capture();
      else onChange(null);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [live, capture, onChange]);

  function rotate() {
    void update({ cameraRotation: (((rotation + 90) % 360) as CameraRotation) });
  }

  const cameras = devices ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex aspect-[4/3] w-full max-w-2xl items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
        {/* El <video> no se muestra: es la fuente que se dibuja en el canvas. */}
        <video ref={videoRef} muted playsInline className="hidden" />

        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Foto de la OT"
            className="h-full w-full object-contain"
          />
        ) : camera.status === "live" ? (
          <canvas ref={previewRef} className="h-full w-full object-contain" />
        ) : (
          <CameraPlaceholder camera={camera} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {live ? (
          <>
            <Button
              type="button"
              size="lg"
              className="h-12 px-6 text-base"
              disabled={camera.status !== "live" || capturing}
              onClick={() => void capture()}
            >
              <Camera className="size-5" />
              Tomar foto
              {!touchMode && <ShortcutHint />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12"
              disabled={camera.status !== "live"}
              onClick={rotate}
            >
              <RotateCw className="size-5" />
              Girar
            </Button>
            {cameras.length > 1 && (
              <select
                aria-label="Cámara"
                className="h-12 min-w-0 max-w-72 rounded-lg border bg-background px-3 text-base"
                value={deviceId ?? ""}
                onChange={(event) => void update({ cameraDeviceId: event.target.value })}
              >
                {cameras.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Cámara ${index + 1}`}
                  </option>
                ))}
              </select>
            )}
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 px-6 text-base"
              onClick={() => onChange(null)}
            >
              <RefreshCw className="size-5" />
              Repetir foto
              {!touchMode && <ShortcutHint />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="h-12 text-muted-foreground hover:text-destructive"
              onClick={() => onChange(null)}
            >
              <Trash2 className="size-5" />
              Quitar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ShortcutHint() {
  return (
    <kbd className="ml-1 rounded border border-current/30 px-1.5 py-0.5 font-mono text-xs">
      {SHORTCUT_KEY}
    </kbd>
  );
}

function CameraPlaceholder({ camera }: { camera: CameraState }) {
  if (camera.status === "starting") {
    return <p className="text-base text-muted-foreground">Encendiendo cámara…</p>;
  }

  const detail =
    camera.status === "no-camera"
      ? "No se detectó ninguna cámara conectada a este equipo."
      : camera.status === "error"
        ? camera.detail
        : "";

  return (
    <div className="flex max-w-sm flex-col items-center gap-2 px-6 text-center">
      <VideoOff className="size-8 text-muted-foreground" />
      <p className="text-base font-medium">{detail}</p>
      <p className="text-sm text-muted-foreground">
        La foto es opcional: la OT se puede guardar igual.
      </p>
    </div>
  );
}

// --- Utilidades ---

async function listCameras(): Promise<MediaDeviceInfo[]> {
  let cameras = (await navigator.mediaDevices.enumerateDevices()).filter(
    (device) => device.kind === "videoinput",
  );
  // Sin un permiso concedido antes, Chromium devuelve las cámaras sin nombre ni
  // id. Abrir y cerrar una cualquiera destraba la lista completa.
  if (cameras.length > 0 && cameras.every((device) => !device.deviceId)) {
    try {
      stopStream(await navigator.mediaDevices.getUserMedia({ video: true }));
      cameras = (await navigator.mediaDevices.enumerateDevices()).filter(
        (device) => device.kind === "videoinput",
      );
    } catch {
      // Se queda con la lista anónima; el error real lo mostrará el flujo.
    }
  }
  return cameras.filter((device) => device.deviceId);
}

/**
 * La guardada en Ajustes si sigue conectada; si no, la que tenga nombre de
 * cámara de documentos (un notebook trae además su webcam frontal); si no, la
 * primera.
 */
function pickDevice(
  devices: MediaDeviceInfo[] | null,
  saved: string | undefined,
): string | null {
  if (!devices || devices.length === 0) return null;
  if (saved && devices.some((device) => device.deviceId === saved)) return saved;
  const documentCamera = devices.find((device) => DOCUMENT_CAMERA.test(device.label));
  return (documentCamera ?? devices[0]).deviceId;
}

function stopStream(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop();
}

/** Dibuja el cuadro actual del video en `canvas`, girado y acotado a `maxSide`. */
function drawRotated(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  rotation: CameraRotation,
  maxSide: number,
) {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const width = Math.round(video.videoWidth * scale);
  const height = Math.round(video.videoHeight * scale);
  const sideways = rotation === 90 || rotation === 270;

  const targetWidth = sideways ? height : width;
  const targetHeight = sideways ? width : height;
  if (canvas.width !== targetWidth) canvas.width = targetWidth;
  if (canvas.height !== targetHeight) canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) return;
  context.save();
  context.translate(targetWidth / 2, targetHeight / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.drawImage(video, -width / 2, -height / 2, width, height);
  context.restore();
}

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  switch (name) {
    case "NotAllowedError":
      return "Windows no deja usar la cámara. Revisa Configuración › Privacidad › Cámara.";
    case "NotReadableError":
      return "La cámara está ocupada por otro programa. Ciérralo e intenta de nuevo.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "La cámara elegida ya no está conectada.";
    default:
      return "No se pudo encender la cámara.";
  }
}

/** URL local para mostrar un Blob, revocada al cambiar o desmontar. */
function useObjectUrl(blob: Blob | null): string | null {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
}
