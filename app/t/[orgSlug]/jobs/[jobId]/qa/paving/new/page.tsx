'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NewPavingQaRunPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const jobId = (params?.jobId as string) ?? '';

  const [installMethod, setInstallMethod] = useState<'crushed_rock_wet_bed' | 'concrete_adhesive'>(
    'crushed_rock_wet_bed'
  );
  const [materialType, setMaterialType] = useState<'consistent_thickness' | 'variable_thickness_natural_stone'>(
    'consistent_thickness'
  );
  const [isDriveway, setIsDriveway] = useState(false);
  const [isPoolArea, setIsPoolArea] = useState(false);
  const [hasSteps, setHasSteps] = useState(false);
  const [isCrossover, setIsCrossover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/qa/runs?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setup: {
            install_method: installMethod,
            material_type: materialType,
            is_driveway: isDriveway,
            is_pool_area: isPoolArea,
            has_steps: hasSteps,
            is_crossover: isCrossover,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setErr(typeof data?.message === 'string' ? data.message : 'Could not start run');
        return;
      }
      router.push(`/t/${orgSlug}/jobs/${jobId}/qa/paving/${data.run.id}`);
    } catch {
      setErr('Could not start run');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <Link href={`/t/${orgSlug}/jobs/${jobId}/qa`} className="text-sm text-[#698F00] hover:underline">
          ← Paving QA
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">New paving QA run</h1>
        <p className="mt-1 text-sm text-gray-600">Choose install path and site flags. You cannot change these after the run starts.</p>

        {err && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{err}</div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Install method</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={installMethod}
              onChange={(e) => setInstallMethod(e.target.value as typeof installMethod)}
            >
              <option value="crushed_rock_wet_bed">Crushed rock + wet bed</option>
              <option value="concrete_adhesive">Concrete / adhesive</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Material type</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={materialType}
              onChange={(e) => setMaterialType(e.target.value as typeof materialType)}
            >
              <option value="consistent_thickness">Consistent thickness</option>
              <option value="variable_thickness_natural_stone">Variable thickness natural stone</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={isDriveway} onChange={(e) => setIsDriveway(e.target.checked)} />
            Driveway
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={isPoolArea} onChange={(e) => setIsPoolArea(e.target.checked)} />
            Pool area
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={hasSteps} onChange={(e) => setHasSteps(e.target.checked)} />
            Steps
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={isCrossover} onChange={(e) => setIsCrossover(e.target.checked)} />
            Crossover
          </label>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#698F00] text-white py-2 rounded-lg font-medium hover:bg-[#5a7d00] disabled:bg-gray-400"
          >
            {saving ? 'Starting…' : 'Start run'}
          </button>
        </form>
      </div>
    </div>
  );
}
