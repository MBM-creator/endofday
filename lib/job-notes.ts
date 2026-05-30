export const JOB_NOTE_MAX_BODY_LENGTH = 5000;
export const JOB_NOTE_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const JOB_NOTE_VIDEO_MAX_SECONDS = 60;

export const JOB_NOTE_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;

export type JobNoteVideoMimeType = (typeof JOB_NOTE_VIDEO_MIME_TYPES)[number];

export function isAllowedJobNoteVideoMimeType(value: string): value is JobNoteVideoMimeType {
  return JOB_NOTE_VIDEO_MIME_TYPES.includes(value as JobNoteVideoMimeType);
}
