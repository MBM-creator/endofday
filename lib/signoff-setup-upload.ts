import { compressImagesForUpload } from '@/lib/client-image-compression';
import { readVideoDurationSeconds, uploadTusFile, type TusUploadPreflight } from '@/lib/client-tus-upload';
import {
  JOB_NOTE_VIDEO_MAX_BYTES,
  JOB_NOTE_VIDEO_MAX_SECONDS,
  JOB_NOTE_VIDEO_MIME_TYPES,
} from '@/lib/job-notes';
import { uploadQaSectionPhotosOnly } from '@/lib/qa-section-submit-client';
import {
  SIGNOFF_SECTION_CODE,
  SIGNOFF_SETUP_PHOTO_ITEM,
} from '@/lib/signoff-qa-evidence';

export const SIGNOFF_VIDEO_ACCEPT = JOB_NOTE_VIDEO_MIME_TYPES.join(',');

export function validateSignoffSetupVideo(file: File): string | null {
  const mimeType = (file.type || '').toLowerCase();
  if (!JOB_NOTE_VIDEO_MIME_TYPES.includes(mimeType as (typeof JOB_NOTE_VIDEO_MIME_TYPES)[number])) {
    return 'Video must be MP4, MOV, or WebM';
  }
  if (file.size > JOB_NOTE_VIDEO_MAX_BYTES) {
    return 'Video must be 50MB or smaller';
  }
  return null;
}

export async function uploadSignoffSetupEvidence(options: {
  orgSlug: string;
  jobId: string;
  runId: string;
  photoFiles: File[];
  videoFile: File | null;
  onVideoProgress?: (pct: number) => void;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const sectionUrl = `/api/jobs/${options.jobId}/qa/runs/${options.runId}/sections/${encodeURIComponent(SIGNOFF_SECTION_CODE)}`;
  const submitUrl = `${sectionUrl}/submit?orgSlug=${encodeURIComponent(options.orgSlug)}`;

  if (options.photoFiles.length > 0) {
    const compressed = await compressImagesForUpload(options.photoFiles);
    const photoResult = await uploadQaSectionPhotosOnly({
      submitUrl,
      photoFiles: { [SIGNOFF_SETUP_PHOTO_ITEM]: compressed },
    });
    if (!photoResult.ok) {
      return {
        ok: false,
        message: photoResult.message ?? photoResult.errors?.join('\n') ?? 'Photo upload failed',
      };
    }
  }

  if (options.videoFile) {
    const videoError = validateSignoffSetupVideo(options.videoFile);
    if (videoError) return { ok: false, message: videoError };

    const durationSeconds = await readVideoDurationSeconds(options.videoFile);
    if (
      durationSeconds != null &&
      Number.isFinite(durationSeconds) &&
      durationSeconds > JOB_NOTE_VIDEO_MAX_SECONDS + 1
    ) {
      return { ok: false, message: 'Video must be 60 seconds or shorter' };
    }

    const preflightRes = await fetch(
      `${sectionUrl}/video/preflight?orgSlug=${encodeURIComponent(options.orgSlug)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: options.videoFile.name,
          mimeType: options.videoFile.type,
          fileSizeBytes: options.videoFile.size,
          durationSeconds,
        }),
      }
    );
    const preflight = (await preflightRes.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
      upload?: TusUploadPreflight;
    };
    if (!preflightRes.ok || !preflight.ok || !preflight.upload) {
      return {
        ok: false,
        message: typeof preflight.message === 'string' ? preflight.message : 'Failed to prepare video upload',
      };
    }

    await uploadTusFile(options.videoFile, preflight.upload, options.onVideoProgress);

    const completeRes = await fetch(
      `${sectionUrl}/video/complete?orgSlug=${encodeURIComponent(options.orgSlug)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storagePath: preflight.upload.path,
          fileName: options.videoFile.name,
          mimeType: options.videoFile.type,
          fileSizeBytes: options.videoFile.size,
          durationSeconds,
        }),
      }
    );
    const complete = (await completeRes.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    if (!completeRes.ok || !complete.ok) {
      return {
        ok: false,
        message: typeof complete.message === 'string' ? complete.message : 'Failed to save uploaded video',
      };
    }
  }

  return { ok: true };
}
