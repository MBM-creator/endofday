import { Upload } from 'tus-js-client';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export type TusUploadPreflight = {
  endpoint: string;
  bucket: string;
  path: string;
  metadata: Record<string, string>;
  headers: Record<string, string>;
};

export function readVideoDurationSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}

export async function uploadTusFile(
  file: File,
  preflight: TusUploadPreflight,
  onProgress?: (pct: number) => void
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error('Sign in again before uploading video');
  }

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: preflight.endpoint,
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000],
      removeFingerprintOnSuccess: true,
      metadata: preflight.metadata,
      headers: {
        ...preflight.headers,
        authorization: `Bearer ${accessToken}`,
        'x-upsert': 'false',
      },
      onError: (error) => reject(error),
      onProgress: (uploaded, total) => {
        if (total > 0 && onProgress) onProgress(Math.round((uploaded / total) * 100));
      },
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}
