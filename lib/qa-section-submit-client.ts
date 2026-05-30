import { compressImageForUpload } from '@/lib/client-image-compression';

export const QA_PHOTO_413_MESSAGE =
  'Photo is too large to upload. Retake at lower resolution or choose a smaller image.';

type QaAnswers = Record<string, { result: string; note: string }>;

export type QaSectionSubmitResult = {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
  message: string | null;
  errors: string[] | null;
};

function appendUploadOnlyParam(url: string): string {
  return url.includes('?') ? `${url}&uploadOnly=1` : `${url}?uploadOnly=1`;
}

export async function uploadQaSectionPhotosOnly(options: {
  submitUrl: string;
  photoFiles: Record<string, File[]>;
}): Promise<QaSectionSubmitResult> {
  const uploadUrl = appendUploadOnlyParam(options.submitUrl);

  for (const [itemKey, files] of Object.entries(options.photoFiles)) {
    for (const file of files) {
      const uploadFile = await compressImageForUpload(file);
      const fd = new FormData();
      fd.append(`item_${itemKey}`, uploadFile);

      const res = await fetch(uploadUrl, { method: 'POST', body: fd });
      if (res.status === 413) {
        return {
          ok: false,
          status: 413,
          data: {},
          message: QA_PHOTO_413_MESSAGE,
          errors: null,
        };
      }

      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || data.ok !== true) {
        return parseSubmitResponse(res, data);
      }
    }
  }

  return {
    ok: true,
    status: 200,
    data: { ok: true },
    message: null,
    errors: null,
  };
}

function parseSubmitResponse(
  res: Response,
  data: Record<string, unknown>
): QaSectionSubmitResult {
  const message = typeof data.message === 'string' ? data.message : null;
  const errors = Array.isArray(data.errors)
    ? data.errors.filter((entry): entry is string => typeof entry === 'string')
    : null;

  return {
    ok: res.ok && data.ok === true,
    status: res.status,
    data,
    message,
    errors,
  };
}

/**
 * Upload QA section photos one at a time (avoids Vercel's ~4.5 MB request limit),
 * then submit answers in a final request with no files attached.
 */
export async function submitQaSectionWithPhotos(options: {
  submitUrl: string;
  answers: QaAnswers;
  photoFiles: Record<string, File[]>;
}): Promise<QaSectionSubmitResult> {
  const uploadUrl = appendUploadOnlyParam(options.submitUrl);

  for (const [itemKey, files] of Object.entries(options.photoFiles)) {
    for (const file of files) {
      const uploadFile = await compressImageForUpload(file);
      const fd = new FormData();
      fd.append(`item_${itemKey}`, uploadFile);

      const res = await fetch(uploadUrl, { method: 'POST', body: fd });
      if (res.status === 413) {
        return {
          ok: false,
          status: 413,
          data: {},
          message: QA_PHOTO_413_MESSAGE,
          errors: null,
        };
      }

      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || data.ok !== true) {
        return parseSubmitResponse(res, data);
      }
    }
  }

  const fd = new FormData();
  fd.set('answers', JSON.stringify(options.answers));
  const res = await fetch(options.submitUrl, { method: 'POST', body: fd });
  if (res.status === 413) {
    return {
      ok: false,
      status: 413,
      data: {},
      message: QA_PHOTO_413_MESSAGE,
      errors: null,
    };
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return parseSubmitResponse(res, data);
}
