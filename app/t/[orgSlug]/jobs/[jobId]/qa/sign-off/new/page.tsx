'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { validateSignoffSetupV1 } from '@/lib/signoff-qa-v1-setup';

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
    const parsed = validateSignoffSetupV1({
      scope_description: scopeDescription.trim() || undefined,
      supervisor_notes: supervisorNotes.trim() || undefined,
    });
    if (!parsed.ok) {
      setApiError(parsed.errors[0]?.message ?? 'Invalid setup');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/qa/runs?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qaType: 'sign_off', setup: parsed.setup, stageId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setApiError(typeof data?.message === 'string' ? data.message : 'Could not start supervisor sign-off');
        return;
      }
      router.push(`/t/${orgSlug}/jobs/${jobId}/qa/sign-off/${data.run.id}`);
    } catch {
      setApiError('Could not start supervisor sign-off. Check your connection and try again.');
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

          <button
            type="submit"
            disabled={saving || (role !== null && !canCreate)}
            className="w-full py-3 px-4 rounded-lg font-medium text-white bg-[#698F00] hover:bg-[#5a7d00] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Starting…' : 'Start supervisor sign-off'}
          </button>
        </form>
      </div>
    </div>
  );
}
