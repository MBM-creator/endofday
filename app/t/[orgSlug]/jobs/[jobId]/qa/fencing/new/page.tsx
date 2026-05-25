'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FENCING_FENCE_TYPE_LABELS, FENCING_FENCE_TYPES, type FencingFenceType } from '@/lib/fencing-qa-v1-types';
import { validateFencingSetupV1 } from '@/lib/fencing-qa-v1-setup';

type FieldErrors = Partial<Record<'fence_type', string>>;

export default function NewFencingQaRunPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const jobId = (params?.jobId as string) ?? '';
  const stageId = searchParams.get('stageId')?.trim() || null;

  const [role, setRole] = useState<string | null>(null);
  const [fenceType, setFenceType] = useState<FencingFenceType | ''>('');
  const [existingFenceRemoval, setExistingFenceRemoval] = useState(false);
  const [gate, setGate] = useState(false);
  const [plinth, setPlinth] = useState(false);
  const [capping, setCapping] = useState(false);
  const [finishCoating, setFinishCoating] = useState(false);
  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orgSlug) return;
    fetch(`/api/auth/me?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && typeof d.staff?.role === 'string') setRole(d.staff.role);
      })
      .catch(() => {});
  }, [orgSlug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    const parsed = validateFencingSetupV1({
      fence_type: fenceType || undefined,
      existing_fence_removal: existingFenceRemoval,
      gate,
      plinth,
      capping,
      finish_coating: finishCoating,
      supervisor_notes: supervisorNotes.trim() || undefined,
    });
    if (!parsed.ok) {
      const next: FieldErrors = {};
      for (const err of parsed.errors) next[err.field as keyof FieldErrors] = err.message;
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/qa/runs?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qaType: 'fencing', setup: parsed.setup, stageId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setApiError(typeof data?.message === 'string' ? data.message : 'Could not start fencing QA');
        return;
      }
      router.push(`/t/${orgSlug}/jobs/${jobId}/qa/fencing/${data.run.id}`);
    } catch {
      setApiError('Could not start fencing QA. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  const canCreate = role === 'supervisor' || role === 'admin';
  const options: { key: string; label: string; value: boolean; setValue: (value: boolean) => void }[] = [
    { key: 'existing_fence_removal', label: 'Existing fence removal', value: existingFenceRemoval, setValue: setExistingFenceRemoval },
    { key: 'gate', label: 'Gate', value: gate, setValue: setGate },
    { key: 'plinth', label: 'Plinth', value: plinth, setValue: setPlinth },
    { key: 'capping', label: 'Capping', value: capping, setValue: setCapping },
    { key: 'finish_coating', label: 'Finish/coating', value: finishCoating, setValue: setFinishCoating },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <Link href={`/t/${orgSlug}/jobs/${jobId}/qa`} className="text-sm text-[#698F00] hover:underline">
          ← QA checks
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">New fencing QA run</h1>
        <p className="mt-1 text-sm text-gray-600">Photo-first internal QA evidence for fencing set-out, post holes, frame, cladding, gates and final supervisor review.</p>

        {role !== null && !canCreate && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
            Fencing QA setup is restricted to supervisors and admins.
          </div>
        )}
        {apiError && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{apiError}</div>}

        <form onSubmit={onSubmit} className="mt-6 space-y-6" noValidate>
          <fieldset className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-3">
            <legend className="text-sm font-semibold text-gray-900 px-1">Fence type</legend>
            {FENCING_FENCE_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer">
                <input type="radio" name="fence_type" checked={fenceType === type} onChange={() => setFenceType(type)} className="accent-[#698F00]" />
                <span className="text-sm text-gray-900">{FENCING_FENCE_TYPE_LABELS[type]}</span>
              </label>
            ))}
            {fieldErrors.fence_type && <p className="text-xs text-red-700">{fieldErrors.fence_type}</p>}
          </fieldset>

          <fieldset className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-3">
            <legend className="text-sm font-semibold text-gray-900 px-1">Applicable options</legend>
            {options.map((option) => (
              <label key={option.key} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer">
                <span className="text-sm text-gray-900">{option.label}</span>
                <input type="checkbox" checked={option.value} onChange={(e) => option.setValue(e.target.checked)} className="accent-[#698F00]" />
              </label>
            ))}
          </fieldset>

          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Supervisor/setup notes</label>
            <textarea rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#698F00]/40" value={supervisorNotes} onChange={(e) => setSupervisorNotes(e.target.value)} />
          </div>

          <button type="submit" disabled={saving || !canCreate} className="w-full bg-[#698F00] text-white py-2.5 rounded-lg font-medium disabled:bg-gray-400">
            {saving ? 'Starting…' : 'Start Fencing QA'}
          </button>
        </form>
      </div>
    </div>
  );
}
