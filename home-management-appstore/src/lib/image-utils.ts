import { supabase } from "@/lib/supabase";

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

export async function optimizeImageFile(
  file: File,
  maxSize: number,
  quality: number,
): Promise<string> {
  // Auto-convert HEIC/HEIF to JPEG for cross-browser support.
  let processFile = file;
  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.(heic|heif)$/i.test(file.name);
  if (isHeic) {
    try {
      const heic2any = (await import("heic2any")).default;
      const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
      processFile = new File(
        [converted as Blob],
        file.name.replace(/\.(heic|heif)$/i, ".jpg"),
        { type: "image/jpeg" },
      );
    } catch {
      // heic2any failed — fall through to canvas attempt (works on iOS Safari natively).
    }
  }

  const fallback = await readFileAsDataUrl(processFile);
  try {
    const objectUrl = URL.createObjectURL(processFile);
    const image = new window.Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("image-load-failed"));
    });
    image.src = objectUrl;
    await loaded;

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) {
      URL.revokeObjectURL(objectUrl);
      return fallback;
    }

    const scale = Math.min(1, maxSize / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      URL.revokeObjectURL(objectUrl);
      return fallback;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(objectUrl);

    // Try progressively lower quality until under 200KB (~267K base64 chars).
    const MAX_CHARS = 270_000;
    let optimized = canvas.toDataURL("image/jpeg", quality);
    if (optimized.length > MAX_CHARS) {
      optimized = canvas.toDataURL("image/jpeg", 0.65);
    }
    if (optimized.length > MAX_CHARS) {
      optimized = canvas.toDataURL("image/jpeg", 0.45);
    }
    // Still too large — try at half the size.
    if (optimized.length > MAX_CHARS && canvas.width > 320) {
      const small = document.createElement("canvas");
      small.width = Math.round(canvas.width / 2);
      small.height = Math.round(canvas.height / 2);
      small.getContext("2d")?.drawImage(canvas, 0, 0, small.width, small.height);
      optimized = small.toDataURL("image/jpeg", 0.6);
    }
    if (!optimized || optimized.length > MAX_CHARS) return "";
    return optimized;
  } catch {
    // Fallback (original file) — only if within size limit.
    if (fallback.length > 270_000) return "";
    return fallback;
  }
}

// Uploads a base64 data-URL to Supabase Storage and returns the public URL.
// Falls back to the original base64 value if the upload fails, so callers
// always get a usable image string regardless of network state.
export async function uploadImageToStorage(base64: string, path: string): Promise<string> {
  const client = supabase;
  if (!client || !base64.startsWith("data:")) return base64;
  try {
    const [header, data] = base64.split(",");
    if (!data) return base64;
    const mime = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: mime });
    const { error } = await client.storage.from("homly-images").upload(path, blob, {
      contentType: mime,
      upsert: true,
    });
    if (error) return base64;
    const { data: urlData } = client.storage.from("homly-images").getPublicUrl(path);
    return urlData.publicUrl;
  } catch {
    return base64;
  }
}
