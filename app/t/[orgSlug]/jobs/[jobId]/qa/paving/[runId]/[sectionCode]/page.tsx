'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getSectionItemsForSetup, parseRunSetup } from '@/lib/paving-qa-v1-catalog';
import type { PavingQaSetup, PavingSectionCode } from '@/lib/paving-qa-v1-types';
import { compressImageForUpload } from '@/lib/client-image-compression';

type Answers = Record<string, { result: string; note: string }>;

export default function PavingQaSectionPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const jobId = (params?.jobId as string) ?? '';
  const runId = (params?.runId as string) ?? '';
  const sectionCode = decodeURIComponent((params?.sectionCode as string) ?? '') as PavingSectionCode;

  const [setup, setSetup] = useState<PavingQaSetup | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [sectionStates, setSectionStates] = useState<
    { section: string; canSubmit: boolean; blockedBy: { section: string; reason: string }[] | null }[]
  >([]);
  const [runStatus, setRunStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoFiles, setPhotoFiles] = useState<Record<string, File[]>>({});

  const items = useMemo(() => (setup ? getSectionItemsForSetup(sectionCode, setup) : []), [setup, sectionCode]);

  useEffect(() => {
    if (!orgSlug || !jobId || !runId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/jobs/${jobId}/qa/runs/${runId}?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((r) => r.json().then((d) => ({ r, d })))
      .then(({ r, d }) => {
        if (cancelled) return;
        if (!r.ok) {
          setError(typeof d?.message === 'string' ? d.message : 'Failed to load');
          return;
        }
        const s = parseRunSetup(d.setup);
        setSetup(s);
        setRunStatus(String(d.run?.status ?? ''));
        setSectionStates(Array.isArray(d.sectionStates) ? d.sectionStates : []);
        const subs = Array.isArray(d.submissions) ? d.submissions : [];
        const mine = subs.find((x: { section_code: string }) => x.section_code === sectionCode);
        if (mine?.answers && typeof mine.answers === 'object') {
          const next: Answers = {};
          for (const [k, v] of Object.entries(mine.answers as Record<string, { result?: string; note?: string }>)) {
            next[k] = { result: String(v?.result ?? ''), note: String(v?.note ?? '') };
          }
          setAnswers(next);
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
  }, [orgSlug, jobId, runId, sectionCode]);

  const myState = sectionStates.find((x) => x.section === sectionCode);
  const isReadOnly = runStatus !== 'active';

  function setResult(key: string, result: string) {
    if (isReadOnly) return;
    setAnswers((prev) => ({
      ...prev,
      [key]: { result, note: prev[key]?.note ?? '' },
    }));
  }

  function setNote(key: string, note: string) {
    if (isReadOnly) return;
    setAnswers((prev) => ({
      ...prev,
      [key]: { result: prev[key]?.result ?? '', note },
    }));
  }

  async function addFiles(key: string, files: FileList | null) {
    if (isReadOnly) return;
    if (!files?.length) return;
    setError(null);
    try {
      const nextFiles = await Promise.all(Array.from(files).map((file) => compressImageForUpload(file)));
      setPhotoFiles((prev) => ({
        ...prev,
        [key]: [...(prev[key] ?? []), ...nextFiles],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prepare photo');
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isReadOnly) {
      setError('This run is complete, so section evidence is read-only.');
      return;
    }
    if (!myState?.canSubmit) {
      setError('This section is blocked until upstream work is cleared.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set('answers', JSON.stringify(answers));
      for (const [itemKey, files] of Object.entries(photoFiles)) {
        for (const file of files) {
          fd.append(`item_${itemKey}`, file);
        }
      }
      const res = await fetch(
        `/api/jobs/${jobId}/qa/runs/${runId}/sections/${encodeURIComponent(sectionCode)}/submit?orgSlug=${encodeURIComponent(orgSlug)}`,
        { method: 'POST', body: fd }
      );
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        const msg =
          typeof data?.message === 'string'
            ? data.message
            : Array.isArray(data?.errors)
              ? data.errors.join('; ')
              : 'Save failed';
        setError(msg);
        return;
      }
      setPhotoFiles({});
      window.location.reload();
    } catch {
      setError('Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <p className="text-red-800">Invalid run.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <Link href={`/t/${orgSlug}/jobs/${jobId}/qa/paving/${runId}`} className="text-sm text-[#698F00] hover:underline">
          ← Run overview
        </Link>
        <h1 className="mt-2 text-xl font-bold text-gray-900">Section</h1>
        <p className="text-sm text-gray-600 font-mono">{sectionCode}</p>

        {isReadOnly && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
            This run is {runStatus || 'not active'}, so section evidence is read-only.
          </div>
        )}

        {myState && !myState.canSubmit && myState.blockedBy && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {myState.blockedBy.map((b, i) => (
              <p key={i}>
                {b.reason}
                {b.section ? ` (${b.section})` : ''}
              </p>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {items.map((item) => (
            <div key={item.key} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-2">
              <p className="text-sm font-medium text-gray-900">{item.label}</p>
              <div className="flex flex-wrap gap-2">
                {(['pass', 'fail', ...(item.allowNa ? (['na'] as const) : [])] as const).map((r) => (
                  <label key={r} className="flex items-center gap-1 text-sm">
                    <input
                      type="radio"
                      name={`r-${item.key}`}
                      checked={(answers[item.key]?.result ?? '') === r}
                      disabled={isReadOnly}
                      onChange={() => setResult(item.key, r)}
                    />
                    {r}
                  </label>
                ))}
              </div>
              {(answers[item.key]?.result ?? '') === 'fail' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Note (required if failed)</label>
                  <textarea
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    rows={2}
                    value={answers[item.key]?.note ?? ''}
                    disabled={isReadOnly}
                    onChange={(e) => setNote(item.key, e.target.value)}
                  />
                </div>
              )}
              {item.requirePhoto && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Photos</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={isReadOnly}
                    onChange={(e) => addFiles(item.key, e.target.files)}
                  />
                  {(photoFiles[item.key]?.length ?? 0) > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{photoFiles[item.key]!.length} new file(s)</p>
                  )}
                </div>
              )}
            </div>
          ))}
          <button
            type="submit"
            disabled={saving || isReadOnly || !myState?.canSubmit}
            className="w-full bg-[#698F00] text-white py-2 rounded-lg font-medium disabled:bg-gray-400"
          >
            {saving ? 'Saving…' : 'Submit section evidence'}
          </button>
        </form>
      </div>
    </div>
  );
}
