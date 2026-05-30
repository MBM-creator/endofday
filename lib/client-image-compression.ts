const MAX_IMAGE_DIMENSION = 1800;
const JPEG_QUALITY = 0.82;
/** Keep each photo small enough that several can fit in one Vercel request (~4.5 MB cap). */
const TARGET_MAX_BYTES = 900 * 1024;
/** Total multipart body budget for QA section submits (answers JSON + photos). */
export const QA_UPLOAD_MAX_TOTAL_BYTES = 4 * 1024 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to read image'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Unable to prepare image'));
      },
      type,
      quality
    );
  });
}

export async function compressImagesForUpload(files: File[]): Promise<File[]> {
  return Promise.all(files.map((file) => compressImageForUpload(file)));
}

export function estimateUploadPayloadBytes(answersJson: string, files: File[]): number {
  return answersJson.length + files.reduce((sum, file) => sum + file.size, 0);
}

export async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size <= TARGET_MAX_BYTES && file.type !== 'image/heic' && file.type !== 'image/heif') {
    return file;
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    if (file.size > TARGET_MAX_BYTES) {
      throw new Error('This photo is too large to upload. Please choose a smaller image or take a lower-resolution photo.');
    }
    return file;
  }

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);
  if (blob.size >= file.size && file.size <= TARGET_MAX_BYTES) return file;

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}
