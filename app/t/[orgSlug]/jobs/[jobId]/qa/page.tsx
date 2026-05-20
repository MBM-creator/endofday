'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ClientConnectJobSummary } from '@/components/ClientConnectJobSummary';

interface RunRow {
  id: string;
  status: string;
  started_at: string;
}

interface JobContext {
  cc_project_id?: string | null;
  cc_client_id?: string | null;
  cc_project_title_snapshot?: string | null;
  cc_client_name_snapshot?: string | null;
}

export default function PavingQaHubPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const jobId = (params?.jobId as string) ?? '';
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [job, setJob] = useState<JobContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgSlug || !jobId) return;
    let cancelled = false;
    fetch(`/api/jobs/${jobId}/qa/runs?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((r) => r.json().then((d) => ({ r, d })))
      .then(({ r, d }) => {
        if (cancelled) return;
        if (!r.ok) {
          setError(typeof d?.message === 'string' ? d.message : 'Failed to load');
          return;
        }
        setRuns(Array.isArray(d.runs) ? d.runs : []);
        setJob(d.job && typeof d.job === 'object' ? d.job : null);
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
  }, [orgSlug, jobId]);

  const active = runs.find((x) => x.status === 'active');

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href={`/t/${orgSlug}/jobs/${jobId}`} className="text-sm text-[#698F00] hover:underline">
            ← Back to job
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Paving QA</h1>
          <p className="mt-1 text-sm text-gray-600">Evidence runs for this job.</p>
          {job && (
            <ClientConnectJobSummary
              job={job}
              compact
              className="mt-1"
              emptyText="No Client Connect project linked."
            />
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
        )}
        {loading && <p className="text-gray-600">Loading…</p>}

        {!loading && !error && (
          <div className="space-y-4">
            {active && (
              <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <p className="text-sm font-medium text-gray-900">Active run</p>
                <Link
                  href={`/t/${orgSlug}/jobs/${jobId}/qa/paving/${active.id}`}
                  className="mt-2 inline-block text-[#698F00] font-medium hover:underline"
                >
                  Open run →
                </Link>
              </div>
            )}
            <Link
              href={`/t/${orgSlug}/jobs/${jobId}/qa/paving/new`}
              className={`inline-block py-2 px-4 rounded-lg font-medium text-white transition-colors ${
                active ? 'bg-gray-400 cursor-not-allowed pointer-events-none' : 'bg-[#698F00] hover:bg-[#5a7d00]'
              }`}
              aria-disabled={!!active}
            >
              Start new paving QA run
            </Link>
            {active && (
              <p className="text-xs text-gray-500">Complete or cancel the active run before starting another.</p>
            )}

            {runs.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">All runs</h2>
                <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white">
                  {runs.map((r) => (
                    <li key={r.id} className="px-4 py-3 flex justify-between items-center">
                      <span className="text-sm text-gray-700">
                        {new Date(r.started_at).toLocaleString()} — {r.status}
                      </span>
                      <Link
                        href={`/t/${orgSlug}/jobs/${jobId}/qa/paving/${r.id}`}
                        className="text-sm text-[#698F00] hover:underline"
                      >
                        View
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
