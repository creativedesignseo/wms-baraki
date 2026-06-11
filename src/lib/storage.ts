// Product image storage — SERVER ONLY.
// Provider images (UPCitemdb / OpenFoodFacts) are often http:// URLs, which a
// browser blocks as mixed content on our https app. So we MIRROR them into our
// own Supabase Storage bucket (https, public) and store that URL instead. The
// same bucket later receives operator-captured photos.

import { createAdminClient } from "@/lib/supabase/admin";

export const PRODUCT_IMAGES_BUCKET = "product-images";

const MAX_BYTES = 5_000_000; // 5 MB sanity cap

/** True when the URL already points at our own Storage bucket. */
export function isStoredImage(url: string | null): boolean {
  if (!url) return false;
  return url.includes(`/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`);
}

/**
 * Download an external image and upload it to our bucket; returns the public
 * https URL, or null on any failure (caller keeps the original URL as fallback).
 * Never throws.
 */
export async function mirrorImageToStorage(
  sourceUrl: string,
  warehouseId: string,
  productId: string,
): Promise<string | null> {
  try {
    if (!sourceUrl || isStoredImage(sourceUrl)) return null;
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;

    const ext = (contentType.split("/")[1] || "jpg")
      .split(";")[0]
      .split("+")[0]
      .replace("jpeg", "jpg");
    const path = `${warehouseId}/${productId}.${ext}`;
    const admin = createAdminClient();
    const { error } = await admin.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, bytes, {
      contentType,
      upsert: true,
    });
    if (error) return null;
    const { data } = admin.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
    return data.publicUrl || null;
  } catch {
    return null;
  }
}

/**
 * Upload raw image bytes (e.g. an operator photo) to the bucket and return the
 * public https URL. Never throws.
 */
export async function uploadProductImage(
  bytes: Uint8Array,
  contentType: string,
  warehouseId: string,
  productId: string,
): Promise<string | null> {
  try {
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;
    if (!contentType.startsWith("image/")) return null;
    const ext = (contentType.split("/")[1] || "jpg")
      .split(";")[0]
      .split("+")[0]
      .replace("jpeg", "jpg");
    const path = `${warehouseId}/${productId}.${ext}`;
    const admin = createAdminClient();
    const { error } = await admin.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, bytes, {
      contentType,
      upsert: true,
    });
    if (error) return null;
    const { data } = admin.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
    return data.publicUrl || null;
  } catch {
    return null;
  }
}
