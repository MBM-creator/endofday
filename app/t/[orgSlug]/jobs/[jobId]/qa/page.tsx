'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ClientConnectJobSummary } from '@/components/ClientConnectJobSummary';
import type { CcProject } from '@/lib/cc-client';

interface RunRow {
  id: string;
  status: string;
  started_at: string;
  qa_type?: string | null;
  setup_version?: number | null;
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
  const [ccProject, setCcProject] = useState<CcProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [runsError, setRunsError] = useState(false);

  useEffect(() => {
    if (!orgSlug || !jobId) return;
    let cancelled = false;
    fetch(`/api/jobs/${jobId}/qa/runs?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((r) => r.json().then((d) => ({ r, d })))
      .then(({ r, d }) => {
        if (cancelled) return;
        if (!r.ok) {
          setRunsError(true);
          return;
        }
        setRuns(Array.isArray(d.runs) ? d.runs : []);
        setJob(d.job && typeof d.job === 'object' ? d.job : null);
        setCcProject(d.ccProject && typeof d.ccProject === 'object' ? d.ccProject : null);
      })
      .catch(() => {
        if (!cancelled) setRunsError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgSlug, jobId]);

  const activePaving = runs.find((x) => x.status === 'active' && (x.qa_type ?? 'paving') === 'paving');
  const activeIrrigation = runs.find((x) => x.status === 'active' && x.qa_type === 'irrigation');
  const activeFencing = runs.find((x) => x.status === 'active' && x.qa_type === 'fencing');
  const linkedToRealCcProject = Boolean(job?.cc_project_id);
  const applicableTrades = new Set(ccProject?.trades ?? []);
  const hasCcTradeData = Boolean(ccProject);
  // Show paving QA for any job that is not explicitly linked to a CC project
  // that excludes paving. When runsError, job is null → not linked → always show.
  const pavingApplicable = !linkedToRealCcProject || applicableTrades.has('paving');
  const irrigationApplicable = applicableTrades.has('irrigation');
  const fencingApplicable = applicableTrades.has('fencing');
  const hasExistingPavingRuns = runs.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href={`/t/${orgSlug}/jobs/${jobId}`} className="text-sm text-[#698F00] hover:underline">
            ← Back to job
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">QA checks</h1>
          <p className="mt-1 text-sm text-gray-600">Evidence checks matched to the linked Client Connect project.</p>
          {job && (
            <ClientConnectJobSummary
              job={job}
              compact
              className="mt-1"
              emptyText="No Client Connect project linked."
            />
          )}
        </div>

        {loading && <p className="text-gray-600">Loading…</p>}

        {!loading && (
          <div className="space-y-4">
            {runsError && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-950">
                Client Connect project data is unavailable. Local QA checks can still be used.
              </div>
            )}

            {!runsError && linkedToRealCcProject && !hasCcTradeData && (
              <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-950">
                Client Connect project details are unavailable, so QA filtering cannot be confirmed.
              </div>
            )}

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Available QA checks</h2>
              <div className="space-y-3">
                {pavingApplicable && (
                  <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Paving QA</p>
                        <p className="mt-1 text-sm text-gray-600">
                          Evidence run for paving works, base preparation, set-out, surface and supervisor sign-off.
                        </p>
                      </div>
                      {activePaving ? (
                        <Link
                          href={`/t/${orgSlug}/jobs/${jobId}/qa/paving/${activePaving.id}`}
                          className="inline-block py-2 px-4 rounded-lg font-medium text-white bg-[#698F00] hover:bg-[#5a7d00] transition-colors"
                        >
                          Open active Paving QA run →
                        </Link>
                      ) : (
                        <Link
                          href={`/t/${orgSlug}/jobs/${jobId}/qa/paving/new`}
                          className="inline-block py-2 px-4 rounded-lg font-medium text-white bg-[#698F00] hover:bg-[#5a7d00] transition-colors"
                        >
                          Start Paving QA
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {irrigationApplicable && (
                  <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Irrigation QA</p>
                        <p className="mt-1 text-sm text-gray-600">
                          Evidence run for irrigation water source checks, before-cover records, controller setup, testing and handover.
                        </p>
                      </div>
                      {activeIrrigation ? (
                        <Link
                          href={`/t/${orgSlug}/jobs/${jobId}/qa/irrigation/${activeIrrigation.id}`}
                          className="inline-block py-2 px-4 rounded-lg font-medium text-white bg-[#698F00] hover:bg-[#5a7d00] transition-colors"
                        >
                          Open active Irrigation QA run →
                        </Link>
                      ) : (
                        <Link
                          href={`/t/${orgSlug}/jobs/${jobId}/qa/irrigation/new`}
                          className="inline-block py-2 px-4 rounded-lg font-medium text-white bg-[#698F00] hover:bg-[#5a7d00] transition-colors"
                        >
                          Start Irrigation QA
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {fencingApplicable && (
                  <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Fencing QA</p>
                        <p className="mt-1 text-sm text-gray-600">
                          Evidence run for fencing property protection, set-out, post holes, frame, cladding, gates and final supervisor review.
                        </p>
                      </div>
                      {activeFencing ? (
                        <Link
                          href={`/t/${orgSlug}/jobs/${jobId}/qa/fencing/${activeFencing.id}`}
                          className="inline-block py-2 px-4 rounded-lg font-medium text-white bg-[#698F00] hover:bg-[#5a7d00] transition-colors"
                        >
                          Open active Fencing QA run →
                        </Link>
                      ) : (
                        <Link
                          href={`/t/${orgSlug}/jobs/${jobId}/qa/fencing/new`}
                          className="inline-block py-2 px-4 rounded-lg font-medium text-white bg-[#698F00] hover:bg-[#5a7d00] transition-colors"
                        >
                          Start Fencing QA
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {!pavingApplicable && !irrigationApplicable && !fencingApplicable && (
                  <div className="p-4 bg-white border border-gray-200 rounded-lg text-sm text-gray-600">
                    No QA checks are configured for this project&apos;s Client Connect trades yet.
                  </div>
                )}
              </div>
            </section>

            {hasExistingPavingRuns && (
              <section className="mt-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">QA runs</h2>
                <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white">
                  {runs.map((r) => (
                    <li key={r.id} className="px-4 py-3 flex justify-between items-center">
                      <span className="text-sm text-gray-700">
                        {new Date(r.started_at).toLocaleString()} — {(r.qa_type ?? 'paving')} — {r.status}
                      </span>
                      <Link
                        href={(r.qa_type ?? 'paving') === 'irrigation'
                          ? `/t/${orgSlug}/jobs/${jobId}/qa/irrigation/${r.id}`
                          : r.qa_type === 'fencing'
                            ? `/t/${orgSlug}/jobs/${jobId}/qa/fencing/${r.id}`
                            : `/t/${orgSlug}/jobs/${jobId}/qa/paving/${r.id}`}
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
