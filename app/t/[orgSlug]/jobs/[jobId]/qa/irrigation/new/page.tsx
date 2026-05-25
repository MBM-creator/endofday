'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  IRRIGATION_QA_TYPE_LABELS,
  IRRIGATION_QA_TYPES,
  IRRIGATION_SYSTEM_TYPE_LABELS,
  IRRIGATION_SYSTEM_TYPES,
  IRRIGATION_WATER_SOURCE_LABELS,
  IRRIGATION_WATER_SOURCES,
  type IrrigationQaType,
  type IrrigationSystemType,
  type IrrigationWaterSource,
} from '@/lib/irrigation-qa-v1-types';
import { validateIrrigationSetupV1 } from '@/lib/irrigation-qa-v1-setup';

type FieldErrors = Partial<Record<'irrigation_type' | 'water_sources' | 'system_types', string>>;

export default function NewIrrigationQaRunPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const jobId = (params?.jobId as string) ?? '';
  const stageId = searchParams.get('stageId')?.trim() || null;

  const [role, setRole] = useState<string | null>(null);
  const [irrigationType, setIrrigationType] = useState<IrrigationQaType | ''>('');
  const [waterSources, setWaterSources] = useState<IrrigationWaterSource[]>([]);
  const [systemTypes, setSystemTypes] = useState<IrrigationSystemType[]>([]);
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

  function toggleWaterSource(source: IrrigationWaterSource) {
    setWaterSources((prev) => prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]);
  }

  function toggleSystemType(type: IrrigationSystemType) {
    setSystemTypes((prev) => prev.includes(type) ? prev.filter((s) => s !== type) : [...prev, type]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    const parsed = validateIrrigationSetupV1({
      irrigation_type: irrigationType || undefined,
      water_sources: waterSources,
      system_types: systemTypes,
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
        body: JSON.stringify({ qaType: 'irrigation', setup: parsed.setup, stageId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setApiError(typeof data?.message === 'string' ? data.message : 'Could not start irrigation QA');
        return;
      }
      router.push(`/t/${orgSlug}/jobs/${jobId}/qa/irrigation/${data.run.id}`);
    } catch {
      setApiError('Could not start irrigation QA. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  const canCreate = role === 'supervisor' || role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <Link href={`/t/${orgSlug}/jobs/${jobId}/qa`} className="text-sm text-[#698F00] hover:underline">
          ← QA checks
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">New irrigation QA run</h1>
        <p className="mt-1 text-sm text-gray-600">
          Photo-first internal QA evidence for irrigation workmanship, before-cover records, controller setup and handover.
        </p>

        {role !== null && !canCreate && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
            Irrigation QA setup is restricted to supervisors and admins. Contact your site supervisor to start a new run.
          </div>
        )}
        {apiError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{apiError}</div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-6" noValidate>
          <fieldset className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-3">
            <legend className="text-sm font-semibold text-gray-900 px-1">Irrigation type</legend>
            {IRRIGATION_QA_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer">
                <input type="radio" name="irrigation_type" checked={irrigationType === type} onChange={() => setIrrigationType(type)} className="accent-[#698F00]" />
                <span className="text-sm text-gray-900">{IRRIGATION_QA_TYPE_LABELS[type]}</span>
              </label>
            ))}
            {fieldErrors.irrigation_type && <p className="text-xs text-red-700">{fieldErrors.irrigation_type}</p>}
          </fieldset>

          <fieldset className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-3">
            <legend className="text-sm font-semibold text-gray-900 px-1">Water source</legend>
            {IRRIGATION_WATER_SOURCES.map((source) => (
              <label key={source} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer">
                <input type="checkbox" checked={waterSources.includes(source)} onChange={() => toggleWaterSource(source)} className="accent-[#698F00]" />
                <span className="text-sm text-gray-900">{IRRIGATION_WATER_SOURCE_LABELS[source]}</span>
              </label>
            ))}
            {fieldErrors.water_sources && <p className="text-xs text-red-700">{fieldErrors.water_sources}</p>}
          </fieldset>

          <fieldset className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-3">
            <legend className="text-sm font-semibold text-gray-900 px-1">System type</legend>
            {IRRIGATION_SYSTEM_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer">
                <input type="checkbox" checked={systemTypes.includes(type)} onChange={() => toggleSystemType(type)} className="accent-[#698F00]" />
                <span className="text-sm text-gray-900">{IRRIGATION_SYSTEM_TYPE_LABELS[type]}</span>
              </label>
            ))}
            {fieldErrors.system_types && <p className="text-xs text-red-700">{fieldErrors.system_types}</p>}
          </fieldset>

          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Supervisor/setup notes</label>
            <textarea rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#698F00]/40" value={supervisorNotes} onChange={(e) => setSupervisorNotes(e.target.value)} />
          </div>

          <button type="submit" disabled={saving || !canCreate} className="w-full bg-[#698F00] text-white py-2.5 rounded-lg font-medium disabled:bg-gray-400">
            {saving ? 'Starting…' : 'Start Irrigation QA'}
          </button>
        </form>
      </div>
    </div>
  );
}
