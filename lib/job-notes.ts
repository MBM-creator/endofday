export const JOB_NOTE_MAX_BODY_LENGTH = 5000;
export const JOB_NOTE_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const JOB_NOTE_VIDEO_MAX_SECONDS = 60;

export const JOB_NOTE_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;

export type JobNoteVideoMimeType = (typeof JOB_NOTE_VIDEO_MIME_TYPES)[number];

export const JOB_NOTE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const JOB_NOTE_IMAGE_MAX_PER_NOTE = 10;

export const JOB_NOTE_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export type JobNoteImageMimeType = (typeof JOB_NOTE_IMAGE_MIME_TYPES)[number];

export function isAllowedJobNoteVideoMimeType(value: string): value is JobNoteVideoMimeType {
  return JOB_NOTE_VIDEO_MIME_TYPES.includes(value as JobNoteVideoMimeType);
}

export function isAllowedJobNoteImageMimeType(value: string): value is JobNoteImageMimeType {
  if (JOB_NOTE_IMAGE_MIME_TYPES.includes(value as JobNoteImageMimeType)) return true;
  return value.startsWith('image/');
}
