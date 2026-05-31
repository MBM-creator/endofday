-- Allow image attachments on job notes (videos unchanged).

ALTER TABLE public.job_note_attachments
  DROP CONSTRAINT IF EXISTS job_note_attachments_media_type_check;

ALTER TABLE public.job_note_attachments
  ADD CONSTRAINT job_note_attachments_media_type_check
  CHECK (media_type IN ('video', 'image'));

COMMENT ON COLUMN public.job_note_attachments.media_type IS
  'Attachment kind: video (TUS upload) or image (server upload).';
