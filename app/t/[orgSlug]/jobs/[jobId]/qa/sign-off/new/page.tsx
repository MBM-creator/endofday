'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { validateSignoffSetupV1 } from '@/lib/signoff-qa-v1-setup';
import {
  SIGNOFF_VIDEO_ACCEPT,
  uploadSignoffSetupEvidence,
  validateSignoffSetupVideo,
} from '@/lib/signoff-setup-upload';
import { compressImagesForUpload } from '@/lib/client-image-compression';
import {
  JOB_NOTE_VIDEO_MAX_BYTES,
  JOB_NOTE_VIDEO_MAX_SECONDS,
} from '@/lib/job-notes';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export default function NewSignOffQaRunPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const jobId = (params?.jobId as string) ?? '';
  const stageId = searchParams.get('stageId')?.trim() || null;

  const [role, setRole] = useState<string | null>(null);
  const [scopeDescription, setScopeDescription] = useState('');
  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const createdUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      for (const url of createdUrlsRef.current) URL.revokeObjectURL(url);
    };
  }, []);

  useEffect(() => {
    if (!orgSlug) return;
    fetch(`/api/auth/me?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && typeof d.staff?.role === 'string') setRole(d.staff.role);
      })
      .catch(() => {});
  }, [orgSlug]);

  async function onPhotoFilesSelected(files: FileList | null) {
    if (!files?.length) return;
    setApiError(null);
    try {
      const compressed = await compressImagesForUpload(Array.from(files));
      const previews = compressed.map((file) => {
        const url = URL.createObjectURL(file);
        createdUrlsRef.current.push(url);
        return url;
      });
      setPhotoFiles((prev) => [...prev, ...compressed]);
      setPhotoPreviews((prev) => [...prev, ...previews]);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to prepare photos');
    }
  }

  function onVideoSelected(file: File | null) {
    setVideoError(null);
    if (!file) {
      setVideoFile(null);
      return;
    }
    const message = validateSignoffSetupVideo(file);
    if (message) {
      setVideoError(message);
      setVideoFile(null);
      return;
    }
    setVideoFile(file);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    setVideoError(null);
    const parsed = validateSignoffSetupV1({
      scope_description: scopeDescription.trim() || undefined,
      supervisor_notes: supervisorNotes.trim() || undefined,
    });
    if (!parsed.ok) {
      setApiError(parsed.errors[0]?.message ?? 'Invalid setup');
      return;
    }
    setSaving(true);
    setUploadPct(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/qa/runs?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qaType: 'sign_off', setup: parsed.setup, stageId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data.run?.id) {
        setApiError(typeof data?.message === 'string' ? data.message : 'Could not start supervisor sign-off');
        return;
      }

      const runId = String(data.run.id);
      if (photoFiles.length > 0 || videoFile) {
        const uploadResult = await uploadSignoffSetupEvidence({
          orgSlug,
          jobId,
          runId,
          photoFiles,
          videoFile,
          onVideoProgress: videoFile ? setUploadPct : undefined,
        });
        if (!uploadResult.ok) {
          setApiError(
            `${uploadResult.message} The sign-off run was created — open it from QA checks to retry uploading evidence.`
          );
          router.push(`/t/${orgSlug}/jobs/${jobId}/qa/sign-off/${runId}`);
          return;
        }
      }

      router.push(`/t/${orgSlug}/jobs/${jobId}/qa/sign-off/${runId}`);
    } catch {
      setApiError('Could not start supervisor sign-off. Check your connection and try again.');
    } finally {
      setSaving(false);
      setUploadPct(null);
    }
  }

  const canCreate = role === 'supervisor' || role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <Link href={`/t/${orgSlug}/jobs/${jobId}/qa`} className="text-sm text-[#698F00] hover:underline">
          ← QA checks
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Supervisor sign-off</h1>
        <p className="mt-1 text-sm text-gray-600">
          Use when no trade-specific QA checklist applies. Record completion evidence and supervisor review.
        </p>

        {role !== null && !canCreate && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
            Starting supervisor sign-off is restricted to supervisors and admins.
          </div>
        )}
        {apiError && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{apiError}</div>}

        <form onSubmit={onSubmit} className="mt-6 space-y-6" noValidate>
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Scope / work description</label>
            <textarea
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#698F00]/40"
              value={scopeDescription}
              onChange={(e) => setScopeDescription(e.target.value)}
              placeholder="Briefly describe what is being signed off"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Supervisor/setup notes</label>
            <textarea
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#698F00]/40"
              value={supervisorNotes}
              onChange={(e) => setSupervisorNotes(e.target.value)}
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Photos (optional)</p>
              <p className="mt-1 text-xs text-gray-600">Add completion or site photos before starting the sign-off run.</p>
            </div>
            <label className="inline-flex items-center gap-2 py-1.5 px-3 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 cursor-pointer">
              Choose photos
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={saving}
                className="sr-only"
                onChange={(e) => {
                  void onPhotoFilesSelected(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            {photoPreviews.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {photoPreviews.map((url, index) => (
                  <img
                    key={url}
                    src={url}
                    alt={`Selected photo ${index + 1}`}
                    className="w-14 h-14 object-cover rounded border border-[#698F00]/40"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Video (optional)</p>
              <p className="mt-1 text-xs text-gray-600">
                MP4, MOV, or WebM up to {formatBytes(JOB_NOTE_VIDEO_MAX_BYTES)} and {JOB_NOTE_VIDEO_MAX_SECONDS} seconds.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 py-1.5 px-3 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 cursor-pointer">
              Choose video
              <input
                type="file"
                accept={SIGNOFF_VIDEO_ACCEPT}
                disabled={saving}
                className="sr-only"
                onChange={(e) => onVideoSelected(e.target.files?.[0] ?? null)}
              />
            </label>
            {videoFile && (
              <p className="text-sm text-gray-700">
                Selected: {videoFile.name} ({formatBytes(videoFile.size)})
              </p>
            )}
            {videoError && <p className="text-sm text-red-700">{videoError}</p>}
            {uploadPct != null && (
              <p className="text-xs text-gray-600">Uploading video… {uploadPct}%</p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || (role !== null && !canCreate)}
            className="w-full py-3 px-4 rounded-lg font-medium text-white bg-[#698F00] hover:bg-[#5a7d00] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (uploadPct != null ? `Uploading video… ${uploadPct}%` : 'Starting…') : 'Start supervisor sign-off'}
          </button>
        </form>
      </div>
    </div>
  );
}
