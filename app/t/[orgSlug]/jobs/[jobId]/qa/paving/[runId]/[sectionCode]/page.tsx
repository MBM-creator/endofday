'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

// V1 imports
import { getSectionItemsForSetup, parseRunSetup, getSectionDef } from '@/lib/paving-qa-v1-catalog';
import type { PavingQaSetup, PavingSectionCode } from '@/lib/paving-qa-v1-types';

// V2 imports
import { getV2SectionDefinition, isV2SectionCode, type PavingSectionCodeV2 } from '@/lib/paving-qa-v2-catalog';
import type { V2CatalogueItem } from '@/lib/paving-qa-v2-catalog';
import type { V2SectionUiState } from '@/lib/paving-qa-v2-graph';

type Answers = Record<string, { result: string; note: string }>;

type V2PhotoRow = {
  id: string;
  item_key: string;
  content_type: string;
  created_at: string | null;
  signed_url: string | null;
};

// ---------------------------------------------------------------------------
// Shared: saved photo thumbnails
// ---------------------------------------------------------------------------

function SavedPhotos({
  savedCount,
  loadedPhotos,
}: {
  savedCount: number;
  loadedPhotos: V2PhotoRow[] | null;
}) {
  if (savedCount === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-600">
        Saved evidence ({savedCount} photo{savedCount !== 1 ? 's' : ''})
      </p>
      {loadedPhotos === null ? (
        <p className="text-xs text-gray-400">Loading previews…</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {loadedPhotos.map((photo) =>
            photo.signed_url ? (
              <a
                key={photo.id}
                href={photo.signed_url}
                target="_blank"
                rel="noopener noreferrer"
                title={
                  photo.created_at
                    ? new Date(photo.created_at).toLocaleString('en-AU', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'View photo'
                }
              >
                <img
                  src={photo.signed_url}
                  alt="Evidence"
                  className="w-14 h-14 object-cover rounded border border-gray-200 hover:opacity-80 transition-opacity"
                />
              </a>
            ) : (
              <div
                key={photo.id}
                className="w-14 h-14 rounded border border-gray-200 bg-gray-50 flex items-center justify-center"
              >
                <span className="text-xs text-gray-400 text-center leading-tight px-1">No preview</span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared: new-file previews (shown before submit)
// ---------------------------------------------------------------------------

function NewFilePreviews({ previews }: { previews: string[] }) {
  if (previews.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-xs font-medium text-gray-600">
        {previews.length} new photo{previews.length !== 1 ? 's' : ''} selected
      </p>
      <div className="flex flex-wrap gap-1.5">
        {previews.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`New photo ${i + 1}`}
            className="w-14 h-14 object-cover rounded border border-[#698F00]/40"
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// V1 section page
// ---------------------------------------------------------------------------

function V1SectionPage({
  orgSlug,
  jobId,
  runId,
  sectionCode,
  setup,
  sectionState,
  runStatus,
  initialAnswers,
  existingPhotoCounts,
  photosByItem,
  photosLoaded,
}: {
  orgSlug: string;
  jobId: string;
  runId: string;
  sectionCode: PavingSectionCode;
  setup: PavingQaSetup;
  sectionState: { canSubmit: boolean; blockedBy: { section: string; reason: string }[] | null } | null;
  runStatus: string;
  initialAnswers?: Answers;
  existingPhotoCounts: Record<string, number>;
  photosByItem: Record<string, V2PhotoRow[]>;
  photosLoaded: boolean;
}) {
  const router = useRouter();
  const items = useMemo(() => getSectionItemsForSetup(sectionCode, setup), [sectionCode, setup]);
  const def = getSectionDef(sectionCode);
  const [answers, setAnswers] = useState<Answers>(initialAnswers ?? {});
  const [photoFiles, setPhotoFiles] = useState<Record<string, File[]>>({});
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track all created object URLs so we can revoke them on unmount
  const createdUrlsRef = useRef<string[]>([]);
  const isReadOnly = runStatus !== 'active';

  useEffect(() => {
    return () => {
      for (const url of createdUrlsRef.current) URL.revokeObjectURL(url);
    };
  }, []);

  function setResult(key: string, result: string) {
    if (isReadOnly) return;
    setAnswers((prev) => ({ ...prev, [key]: { result, note: prev[key]?.note ?? '' } }));
  }
  function setNote(key: string, note: string) {
    if (isReadOnly) return;
    setAnswers((prev) => ({ ...prev, [key]: { result: prev[key]?.result ?? '', note } }));
  }
  function addFiles(key: string, files: FileList | null) {
    if (isReadOnly || !files?.length) return;
    const newFiles = Array.from(files);
    const newPreviews = newFiles.map((f) => {
      const url = URL.createObjectURL(f);
      createdUrlsRef.current.push(url);
      return url;
    });
    setPhotoFiles((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), ...newFiles] }));
    setPhotoPreviews((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), ...newPreviews] }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isReadOnly) {
      setError('This run is complete — section evidence is read-only.');
      return;
    }
    if (!sectionState?.canSubmit) {
      setError('This section is blocked until upstream work is cleared.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const fd = new FormData();
      fd.set('answers', JSON.stringify(answers));
      for (const [itemKey, files] of Object.entries(photoFiles)) {
        for (const file of files) fd.append(`item_${itemKey}`, file);
      }
      const res = await fetch(
        `/api/jobs/${jobId}/qa/runs/${runId}/sections/${encodeURIComponent(sectionCode)}/submit?orgSlug=${encodeURIComponent(orgSlug)}`,
        { method: 'POST', body: fd }
      );
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(
          typeof data?.message === 'string'
            ? data.message
            : Array.isArray(data?.errors)
              ? data.errors.join('; ')
              : 'Save failed'
        );
        return;
      }
      setPhotoFiles({});
      setPhotoPreviews({});
      setSaved(true);
      setTimeout(() => router.push(`/t/${orgSlug}/jobs/${jobId}/qa/paving/${runId}`), 1500);
    } catch {
      setError('Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <Link
          href={`/t/${orgSlug}/jobs/${jobId}/qa/paving/${runId}`}
          className="text-sm text-[#698F00] hover:underline"
        >
          ← Run overview
        </Link>
        <h1 className="mt-2 text-xl font-bold text-gray-900">{def?.title ?? sectionCode}</h1>
        <p className="text-sm text-gray-500 font-mono">{sectionCode}</p>

        {isReadOnly && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
            This run is {runStatus || 'not active'} — evidence is read-only.
          </div>
        )}
        {sectionState && !sectionState.canSubmit && sectionState.blockedBy && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {sectionState.blockedBy.map((b, i) => (
              <p key={i}>
                {b.reason}
                {b.section ? ` (${b.section})` : ''}
              </p>
            ))}
          </div>
        )}
        {saved && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm font-medium">
            Evidence saved — returning to run overview…
          </div>
        )}
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {items.map((item) => {
            const savedCount = photosLoaded
              ? (photosByItem[item.key]?.length ?? 0)
              : (existingPhotoCounts[item.key] ?? 0);
            const loadedPhotos = photosLoaded ? (photosByItem[item.key] ?? []) : null;
            const newPreviews = photoPreviews[item.key] ?? [];

            return (
              <div
                key={item.key}
                className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-2"
              >
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <div className="flex flex-wrap gap-3">
                  {(['pass', 'fail', ...(item.allowNa ? ['na'] : [])] as string[]).map((r) => (
                    <label key={r} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name={`r-${item.key}`}
                        checked={(answers[item.key]?.result ?? '') === r}
                        disabled={isReadOnly}
                        onChange={() => setResult(item.key, r)}
                        className="accent-[#698F00]"
                      />
                      <span className="capitalize">{r}</span>
                    </label>
                  ))}
                </div>
                {(answers[item.key]?.result ?? '') === 'fail' && (
                  <textarea
                    placeholder="Note (required when failed)"
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    rows={2}
                    value={answers[item.key]?.note ?? ''}
                    disabled={isReadOnly}
                    onChange={(e) => setNote(item.key, e.target.value)}
                  />
                )}

                <SavedPhotos savedCount={savedCount} loadedPhotos={loadedPhotos} />

                {item.requirePhoto && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1.5">
                      {savedCount > 0 ? 'Add more photos (optional)' : 'Photos'}
                    </p>
                    <label
                      className={`inline-flex items-center gap-2 py-1.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        isReadOnly
                          ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                          : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-700 cursor-pointer'
                      }`}
                    >
                      <svg className="w-4 h-4 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {newPreviews.length > 0
                        ? `${newPreviews.length} photo${newPreviews.length !== 1 ? 's' : ''} selected`
                        : 'Choose photos'}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={isReadOnly}
                        className="sr-only"
                        onChange={(e) => addFiles(item.key, e.target.files)}
                      />
                    </label>
                    <NewFilePreviews previews={newPreviews} />
                  </div>
                )}
              </div>
            );
          })}
          <button
            type="submit"
            disabled={saving || isReadOnly || !sectionState?.canSubmit}
            className="w-full bg-[#698F00] text-white py-2 rounded-lg font-medium disabled:bg-gray-400"
          >
            {saving ? 'Saving…' : 'Submit section evidence'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// V2 section page
// ---------------------------------------------------------------------------

type V2SubmissionMeta = { status: string; submittedAt: string | null } | null;

function V2SectionPage({
  orgSlug,
  jobId,
  runId,
  sectionCode,
  items,
  sectionState,
  runStatus,
  initialAnswers,
  submissionMeta,
  existingPhotoCounts,
  photosByItem,
  photosLoaded,
}: {
  orgSlug: string;
  jobId: string;
  runId: string;
  sectionCode: PavingSectionCodeV2;
  items: V2CatalogueItem[];
  sectionState: V2SectionUiState;
  runStatus: string;
  initialAnswers: Answers;
  submissionMeta: V2SubmissionMeta;
  existingPhotoCounts: Record<string, number>;
  photosByItem: Record<string, V2PhotoRow[]>;
  photosLoaded: boolean;
}) {
  const router = useRouter();
  const def = getV2SectionDefinition(sectionCode);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [photoFiles, setPhotoFiles] = useState<Record<string, File[]>>({});
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createdUrlsRef = useRef<string[]>([]);

  const isReadOnly = runStatus !== 'active';
  const isBlocked = sectionState.status === 'blocked';
  const canSubmit = !isReadOnly && !isBlocked;

  useEffect(() => {
    return () => {
      for (const url of createdUrlsRef.current) URL.revokeObjectURL(url);
    };
  }, []);

  function setResult(key: string, result: string) {
    if (!canSubmit) return;
    setAnswers((prev) => ({ ...prev, [key]: { result, note: prev[key]?.note ?? '' } }));
  }
  function setNote(key: string, note: string) {
    if (!canSubmit) return;
    setAnswers((prev) => ({ ...prev, [key]: { result: prev[key]?.result ?? '', note } }));
  }
  function addFiles(key: string, files: FileList | null) {
    if (!canSubmit || !files?.length) return;
    const newFiles = Array.from(files);
    const newPreviews = newFiles.map((f) => {
      const url = URL.createObjectURL(f);
      createdUrlsRef.current.push(url);
      return url;
    });
    setPhotoFiles((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), ...newFiles] }));
    setPhotoPreviews((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), ...newPreviews] }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const fd = new FormData();
      fd.set('answers', JSON.stringify(answers));
      for (const [itemKey, files] of Object.entries(photoFiles)) {
        for (const file of files) fd.append(`item_${itemKey}`, file);
      }
      const res = await fetch(
        `/api/jobs/${jobId}/qa/runs/${runId}/sections/${encodeURIComponent(sectionCode)}/submit?orgSlug=${encodeURIComponent(orgSlug)}`,
        { method: 'POST', body: fd }
      );
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        const specificErrors = Array.isArray(data?.errors) && data.errors.length > 0
          ? (data.errors as string[]).join('\n')
          : null;
        setError(specificErrors ?? (typeof data?.message === 'string' ? data.message : 'Save failed'));
        return;
      }
      setPhotoFiles({});
      setPhotoPreviews({});
      setSaved(true);
      setTimeout(() => router.push(`/t/${orgSlug}/jobs/${jobId}/qa/paving/${runId}`), 1500);
    } catch {
      setError('Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <Link
          href={`/t/${orgSlug}/jobs/${jobId}/qa/paving/${runId}`}
          className="text-sm text-[#698F00] hover:underline"
        >
          ← Run overview
        </Link>

        <div className="flex items-center gap-2 mt-2">
          <h1 className="text-xl font-bold text-gray-900">{def?.title ?? sectionCode}</h1>
          <span className="px-1.5 py-0.5 text-xs rounded bg-[#698F00]/10 text-[#698F00] border border-[#698F00]/20">
            v2
          </span>
        </div>
        {def && <p className="text-sm text-gray-500 mt-1">{def.description}</p>}

        {isReadOnly && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
            This run is {runStatus || 'not active'} — evidence is read-only.
          </div>
        )}
        {isBlocked && sectionState.blockedBy && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            <p className="font-semibold mb-1">This section is blocked:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {sectionState.blockedBy.map((b) => (
                <li key={`${b.section}:${b.reason}`}>{b.reason}</li>
              ))}
            </ul>
          </div>
        )}
        {sectionState.status === 'issue_raised' && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            This section has an unresolved issue. Supervisor action required before it can be cleared.
          </div>
        )}
        {sectionState.status === 'cleared' && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            This section is cleared. You can re-submit to update evidence.
          </div>
        )}

        {/* Existing submission banner */}
        {submissionMeta && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-sm flex items-center justify-between flex-wrap gap-1">
            <span>
              Evidence on file —&nbsp;
              <span className="font-medium capitalize">
                {submissionMeta.status.replace(/_/g, ' ')}
              </span>
            </span>
            {submissionMeta.submittedAt && (
              <span className="text-blue-700 text-xs">
                {new Date(submissionMeta.submittedAt).toLocaleString('en-AU', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        )}

        {saved && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm font-medium">
            Evidence saved — returning to run overview…
          </div>
        )}
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm space-y-1">
            {error.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {items.map((item) => {
            const result = answers[item.key]?.result ?? '';
            // Use signed-URL photos when loaded, fall back to bare count until then
            const loadedPhotos = photosLoaded ? (photosByItem[item.key] ?? []) : null;
            const savedPhotoCount =
              loadedPhotos !== null ? loadedPhotos.length : (existingPhotoCounts[item.key] ?? 0);
            const newPreviews = photoPreviews[item.key] ?? [];

            return (
              <div
                key={item.key}
                className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  {item.requirePhoto && (
                    <span className="flex-none text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      Photo required
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  {!item.photoOnly &&
                    (item.allowNa
                      ? (['pass', 'fail', 'not_required'] as const)
                      : (['pass', 'fail'] as const)
                    ).map((r) => (
                      <label key={r} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name={`r-${item.key}`}
                          checked={result === r}
                          disabled={!canSubmit}
                          onChange={() => setResult(item.key, r)}
                          className="accent-[#698F00]"
                        />
                        <span>{r === 'not_required' ? 'N/A' : r.charAt(0).toUpperCase() + r.slice(1)}</span>
                      </label>
                    ))}
                </div>

                {/* Note field: always shown on fail; also shown when noteRequiredWhen matches
                    or when an existing note is present (so pre-populated notes remain visible) */}
                {!item.photoOnly &&
                  (result === 'fail' ||
                    (item.noteRequiredWhen ?? []).includes(result as 'pass' | 'fail' | 'not_required') ||
                    Boolean(answers[item.key]?.note)) &&
                  (() => {
                  const noteIsRequired =
                    result === 'fail' ||
                    (item.noteRequiredWhen ?? []).includes(result as 'pass' | 'fail' | 'not_required');
                  return (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-700">
                        Note{noteIsRequired ? <span className="text-red-500 ml-0.5">*</span> : null}
                      </p>
                      <textarea
                        placeholder={
                          item.notePrompt ??
                          (result === 'fail' ? 'Describe the issue (required)' : 'Note (required)')
                        }
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        rows={2}
                        value={answers[item.key]?.note ?? ''}
                        disabled={!canSubmit}
                        onChange={(e) => setNote(item.key, e.target.value)}
                      />
                    </div>
                  );
                })()}

                {/* Saved photo evidence — always visible when photos exist */}
                <SavedPhotos savedCount={savedPhotoCount} loadedPhotos={loadedPhotos} />

                {/* Upload section — photo-only items always show upload; others hide when N/A selected */}
                {item.requirePhoto && (item.photoOnly || result !== 'not_required') && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1.5">
                      {savedPhotoCount > 0 ? 'Add more photos (optional)' : 'Photos'}
                    </p>
                    <label
                      className={`inline-flex items-center gap-2 py-1.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        !canSubmit
                          ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                          : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-700 cursor-pointer'
                      }`}
                    >
                      <svg className="w-4 h-4 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {newPreviews.length > 0
                        ? `${newPreviews.length} photo${newPreviews.length !== 1 ? 's' : ''} selected`
                        : 'Choose photos'}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={!canSubmit}
                        className="sr-only"
                        onChange={(e) => addFiles(item.key, e.target.files)}
                      />
                    </label>
                    <NewFilePreviews previews={newPreviews} />
                  </div>
                )}
              </div>
            );
          })}

          {isBlocked ? (
            <p className="text-sm text-center text-gray-500">
              Submission unavailable — unblock upstream sections first.
            </p>
          ) : (
            <button
              type="submit"
              disabled={saving || !canSubmit}
              className="w-full bg-[#698F00] text-white py-2 rounded-lg font-medium disabled:bg-gray-400"
            >
              {saving ? 'Saving…' : 'Submit section evidence'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root page — detects version and renders the correct sub-component
// ---------------------------------------------------------------------------

export default function PavingQaSectionPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const jobId = (params?.jobId as string) ?? '';
  const runId = (params?.runId as string) ?? '';
  const sectionCodeRaw = decodeURIComponent((params?.sectionCode as string) ?? '');

  const [setupVersion, setSetupVersion] = useState<number | null>(null);
  const [v1Setup, setV1Setup] = useState<PavingQaSetup | null>(null);
  const [v1SectionStates, setV1SectionStates] = useState<
    { section: string; canSubmit: boolean; blockedBy: { section: string; reason: string }[] | null }[]
  >([]);
  const [v1InitialAnswers, setV1InitialAnswers] = useState<Answers>({});
  const [v1ExistingPhotoCounts, setV1ExistingPhotoCounts] = useState<Record<string, number>>({});
  const [v1PhotosByItem, setV1PhotosByItem] = useState<Record<string, V2PhotoRow[]>>({});
  const [v1PhotosLoaded, setV1PhotosLoaded] = useState(false);

  const [v2Items, setV2Items] = useState<V2CatalogueItem[]>([]);
  const [v2SectionStates, setV2SectionStates] = useState<V2SectionUiState[]>([]);
  const [v2InitialAnswers, setV2InitialAnswers] = useState<Answers>({});
  const [v2SubmissionMeta, setV2SubmissionMeta] = useState<V2SubmissionMeta>(null);
  const [v2ExistingPhotoCounts, setV2ExistingPhotoCounts] = useState<Record<string, number>>({});
  const [v2PhotosByItem, setV2PhotosByItem] = useState<Record<string, V2PhotoRow[]>>({});
  const [v2PhotosLoaded, setV2PhotosLoaded] = useState(false);

  const [runStatus, setRunStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgSlug || !jobId || !runId) return;
    let cancelled = false;
    setLoading(true);
    setV2PhotosByItem({});
    setV2PhotosLoaded(false);
    setV1PhotosByItem({});
    setV1PhotosLoaded(false);
    fetch(`/api/jobs/${jobId}/qa/runs/${runId}?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((r) => r.json().then((d) => ({ r, d })))
      .then(({ r, d }) => {
        if (cancelled) return;
        if (!r.ok) {
          setError(typeof d?.message === 'string' ? d.message : 'Failed to load');
          return;
        }

        setRunStatus(String(d.run?.status ?? ''));
        const ver = typeof d.setupVersion === 'number' ? d.setupVersion : null;
        setSetupVersion(ver);

        if (ver === 2) {
          if (isV2SectionCode(sectionCodeRaw)) {
            const def = getV2SectionDefinition(sectionCodeRaw as PavingSectionCodeV2);
            setV2Items(def?.items ?? []);
          }
          setV2SectionStates(
            Array.isArray(d.sectionStates) ? (d.sectionStates as V2SectionUiState[]) : []
          );

          // Pre-populate answers from any existing submission for this section
          const subs = Array.isArray(d.submissions) ? d.submissions : [];
          const mine = subs.find(
            (x: { section_code: string }) => x.section_code === sectionCodeRaw
          ) as
            | {
                section_code: string;
                submission_status?: string;
                answers?: unknown;
                submitted_at?: string | null;
              }
            | undefined;

          if (
            mine?.answers &&
            typeof mine.answers === 'object' &&
            !Array.isArray(mine.answers)
          ) {
            const next: Answers = {};
            for (const [k, val] of Object.entries(
              mine.answers as Record<string, { result?: string; note?: string }>
            )) {
              next[k] = { result: String(val?.result ?? ''), note: String(val?.note ?? '') };
            }
            setV2InitialAnswers(next);
          } else {
            setV2InitialAnswers({});
          }

          setV2SubmissionMeta(
            mine
              ? {
                  status: String(mine.submission_status ?? ''),
                  submittedAt: mine.submitted_at ? String(mine.submitted_at) : null,
                }
              : null
          );

          // Build per-item photo counts for the current section from the run-level photoRows
          const allPhotoRows = Array.isArray(d.photoRows)
            ? (d.photoRows as { section_code: string; item_key: string }[])
            : [];
          const counts: Record<string, number> = {};
          for (const row of allPhotoRows) {
            if (row.section_code === sectionCodeRaw) {
              counts[row.item_key] = (counts[row.item_key] ?? 0) + 1;
            }
          }
          setV2ExistingPhotoCounts(counts);

          // Non-blocking: load signed photo URLs after the form is visible
          fetch(
            `/api/jobs/${jobId}/qa/runs/${runId}/sections/${encodeURIComponent(sectionCodeRaw)}/photos?orgSlug=${encodeURIComponent(orgSlug)}`
          )
            .then((pr) => pr.json())
            .then((pd: { ok?: boolean; photos?: V2PhotoRow[] }) => {
              if (cancelled || !pd?.ok) return;
              const byItem: Record<string, V2PhotoRow[]> = {};
              for (const photo of pd.photos ?? []) {
                if (!byItem[photo.item_key]) byItem[photo.item_key] = [];
                byItem[photo.item_key].push(photo);
              }
              setV2PhotosByItem(byItem);
              setV2PhotosLoaded(true);
            })
            .catch(() => {
              // Graceful degradation — counts from photoRows still show, thumbnails just won't appear
              if (!cancelled) setV2PhotosLoaded(true);
            });
        } else {
          // V1 path
          const s = parseRunSetup(d.setup);
          setV1Setup(s);
          setV1SectionStates(Array.isArray(d.sectionStates) ? d.sectionStates : []);

          // Pre-populate answers from existing submission
          const subs = Array.isArray(d.submissions) ? d.submissions : [];
          const mine = subs.find(
            (x: { section_code: string }) => x.section_code === sectionCodeRaw
          );
          if (mine?.answers && typeof mine.answers === 'object') {
            const next: Answers = {};
            for (const [k, v] of Object.entries(
              mine.answers as Record<string, { result?: string; note?: string }>
            )) {
              next[k] = { result: String(v?.result ?? ''), note: String(v?.note ?? '') };
            }
            setV1InitialAnswers(next);
          }

          // Build per-item photo counts from photoRows (now included in v1 response)
          const allPhotoRows = Array.isArray(d.photoRows)
            ? (d.photoRows as { section_code: string; item_key: string }[])
            : [];
          const counts: Record<string, number> = {};
          for (const row of allPhotoRows) {
            if (row.section_code === sectionCodeRaw) {
              counts[row.item_key] = (counts[row.item_key] ?? 0) + 1;
            }
          }
          setV1ExistingPhotoCounts(counts);

          // Non-blocking: load signed photo URLs for v1 saved evidence
          fetch(
            `/api/jobs/${jobId}/qa/runs/${runId}/sections/${encodeURIComponent(sectionCodeRaw)}/photos?orgSlug=${encodeURIComponent(orgSlug)}`
          )
            .then((pr) => pr.json())
            .then((pd: { ok?: boolean; photos?: V2PhotoRow[] }) => {
              if (cancelled || !pd?.ok) return;
              const byItem: Record<string, V2PhotoRow[]> = {};
              for (const photo of pd.photos ?? []) {
                if (!byItem[photo.item_key]) byItem[photo.item_key] = [];
                byItem[photo.item_key].push(photo);
              }
              setV1PhotosByItem(byItem);
              setV1PhotosLoaded(true);
            })
            .catch(() => {
              if (!cancelled) setV1PhotosLoaded(true);
            });
        }
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgSlug, jobId, runId, sectionCodeRaw]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <Link
          href={`/t/${orgSlug}/jobs/${jobId}/qa/paving/${runId}`}
          className="text-sm text-[#698F00] hover:underline"
        >
          ← Run overview
        </Link>
        <p className="mt-4 text-red-800">{error}</p>
      </div>
    );
  }

  // V2 path
  if (setupVersion === 2) {
    if (!isV2SectionCode(sectionCodeRaw)) {
      return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
          <Link
            href={`/t/${orgSlug}/jobs/${jobId}/qa/paving/${runId}`}
            className="text-sm text-[#698F00] hover:underline"
          >
            ← Run overview
          </Link>
          <p className="mt-4 text-red-800">Unknown v2 section code: {sectionCodeRaw}</p>
        </div>
      );
    }
    const v2Code = sectionCodeRaw as PavingSectionCodeV2;
    const myState = v2SectionStates.find((s) => s.code === v2Code) ?? null;
    if (!myState) {
      return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
          <Link
            href={`/t/${orgSlug}/jobs/${jobId}/qa/paving/${runId}`}
            className="text-sm text-[#698F00] hover:underline"
          >
            ← Run overview
          </Link>
          <p className="mt-4 text-amber-800">
            Section <strong>{sectionCodeRaw}</strong> is not part of this run&apos;s setup.
          </p>
        </div>
      );
    }
    return (
      <V2SectionPage
        orgSlug={orgSlug}
        jobId={jobId}
        runId={runId}
        sectionCode={v2Code}
        items={v2Items}
        sectionState={myState}
        runStatus={runStatus}
        initialAnswers={v2InitialAnswers}
        submissionMeta={v2SubmissionMeta}
        existingPhotoCounts={v2ExistingPhotoCounts}
        photosByItem={v2PhotosByItem}
        photosLoaded={v2PhotosLoaded}
      />
    );
  }

  // V1 path
  if (!v1Setup) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <p className="text-red-800">Invalid run.</p>
      </div>
    );
  }

  const v1Code = sectionCodeRaw as PavingSectionCode;
  const myV1State = v1SectionStates.find((x) => x.section === v1Code) ?? null;

  return (
    <V1SectionPage
      orgSlug={orgSlug}
      jobId={jobId}
      runId={runId}
      sectionCode={v1Code}
      setup={v1Setup}
      sectionState={myV1State}
      runStatus={runStatus}
      initialAnswers={v1InitialAnswers}
      existingPhotoCounts={v1ExistingPhotoCounts}
      photosByItem={v1PhotosByItem}
      photosLoaded={v1PhotosLoaded}
    />
  );
}
