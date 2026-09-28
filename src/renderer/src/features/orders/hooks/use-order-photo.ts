import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { parseApiError } from "@/lib/api/errors";

import { ordersKeys } from "./use-orders";

import type { components } from "@/lib/api/schema";

type LaundryOrderOut = components["schemas"]["LaundryOrderOut"];

/**
 * Foto de la OT física: pide al backend un POST prefirmado, sube el archivo a
 * S3 desde main y confirma la clave del objeto en la guía.
 *
 * Mismo flujo que `useUploadOrderPhoto` del panel web, con una diferencia: la
 * subida a S3 no la hace el renderer (la CSP de la terminal no lo deja salir a
 * internet) sino main, por el puente `window.servilion.storage`.
 *
 * El id de la guía va en cada llamada y no al crear el hook porque en la
 * digitalización la foto se toma antes de que la guía exista.
 */
export function useUploadOrderPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      photo,
    }: {
      orderId: number;
      photo: Blob;
    }): Promise<LaundryOrderOut> => {
      const contentType = photo.type || "image/jpeg";
      const filename = `ot-${orderId}.${contentType === "image/png" ? "png" : "jpg"}`;

      const { data: upload, error: uploadError } = await api.POST(
        "/api/orders/{order_id}/photo-upload-url",
        {
          params: { path: { order_id: orderId } },
          body: { filename, content_type: contentType },
        },
      );
      if (uploadError) throw parseApiError(uploadError);

      const result = await window.servilion.storage.upload({
        uploadUrl: upload.upload_url,
        fields: upload.fields,
        filename,
        contentType,
        data: new Uint8Array(await photo.arrayBuffer()),
      });
      if (!result.ok) throw { detail: result.detail };

      const { data: order, error: confirmError } = await api.POST(
        "/api/orders/{order_id}/photo-confirm",
        {
          params: { path: { order_id: orderId } },
          body: { object_key: upload.object_key },
        },
      );
      if (confirmError) throw parseApiError(confirmError);
      return order;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.detail(order.id) });
    },
  });
}
