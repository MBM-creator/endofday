'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ClientConnectJobSummary } from '@/components/ClientConnectJobSummary';
import type { CcProject } from '@/lib/cc-client';
import { getApplicableQaChecks } from '@/lib/cc-project-context';
import type { StaffRole } from '@/lib/daily-site-update-shared';
import {
  activeRunForType,
  bucketHubRuns,
  currentRunActionLabel,
  formatQaDateTime,
  qaNewRunPath,
  qaRunPath,
  qaTypeDisplayLabel,
  QA_CHECK_DESCRIPTIONS,
  runDisplayStatus,
  SIGN_OFF_DESCRIPTION,
  type QaHubRun,
} from '@/lib/qa-hub-display';

interface JobContext {
  name?: string;
  cc_project_id?: string | null;
  cc_client_id?: string | null;
  cc_project_title_snapshot?: string | null;
  cc_client_name_snapshot?: string | null;
}

export default function QaHubPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const jobId = (params?.jobId as string) ?? '';
  const [runs, setRuns] = useState<QaHubRun[]>([]);
  const [job, setJob] = useState<JobContext | null>(null);
  const [ccProject, setCcProject] = useState<CcProject | null>(null);
  const [viewerRole, setViewerRole] = useState<StaffRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [runsError, setRunsError] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  useEffect(() => {
    if (!orgSlug || !jobId) return;
    let cancelled = false;
    setLoading(true);
    setRunsError(false);
    setViewerRole(null);
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
        if (d.viewerRole === 'field' || d.viewerRole === 'supervisor' || d.viewerRole === 'admin') {
          setViewerRole(d.viewerRole);
        }
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

  const todayHref = `/t/${orgSlug}/jobs/${jobId}/today`;
  const detailHref = `/t/${orgSlug}/jobs/${jobId}`;
  const isSupervisorOrAdmin = viewerRole === 'supervisor' || viewerRole === 'admin';
  const linkedToRealCcProject = Boolean(job?.cc_project_id);
  const hasCcTradeData = Boolean(ccProject);
  const applicableChecks = getApplicableQaChecks(ccProject);
  const hasTradeQaChecks = applicableChecks.length > 0;
  const { activeRuns, historyRuns } = bucketHubRuns(runs);
  const primaryActiveRun = activeRuns[0] ?? null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href={todayHref} className="text-sm text-[#698F00] hover:underline">
            ← Today&apos;s Work
          </Link>
          <Link href={detailHref} className="ml-4 text-sm text-gray-600 hover:text-[#698F00] hover:underline">
            Full job detail
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{job?.name ?? 'QA checks'}</h1>
          <p className="mt-1 text-sm text-gray-600">Quality checks for this job.</p>
          {job && (
            <ClientConnectJobSummary
              job={job}
              compact
              className="mt-1"
              emptyText="No Client Connect project linked."
            />
          )}
        </div>

        {(!clientReady || loading) && <p className="text-gray-600">Loading…</p>}

        {clientReady && !loading && runsError && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-950">
            QA status is unavailable. Try again or open Today&apos;s Work.
          </div>
        )}

        {clientReady && !loading && !runsError && viewerRole && (
          <div className="space-y-6">

            {!runsError && linkedToRealCcProject && !hasCcTradeData && (
              <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-950">
                Client Connect project details are unavailable. Some checks may not apply until project data loads.
              </div>
            )}

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Current QA</h2>
              {activeRuns.length === 0 ? (
                <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                  <p className="text-sm text-gray-700">No active QA checklist on this job.</p>
                  {viewerRole === 'field' && (
                    <p className="mt-2 text-sm text-gray-600">
                      Ask your site supervisor to start the checklist for this job.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {activeRuns.map((run, index) => {
                    const isPrimary = index === 0;
                    const actionLabel = currentRunActionLabel(run);
                    const runHref = qaRunPath(orgSlug, jobId, run.id, run.qa_type);
                    return (
                      <div
                        key={run.id}
                        className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{qaTypeDisplayLabel(run.qa_type)}</p>
                            <p className="mt-1 text-sm text-gray-600">
                              <span className="font-medium text-gray-800">{runDisplayStatus(run)}</span>
                              {' · '}
                              Started {formatQaDateTime(run.started_at)}
                            </p>
                          </div>
                          <Link
                            href={runHref}
                            className={
                              isPrimary
                                ? 'inline-block py-2 px-4 rounded-lg font-medium text-white bg-[#698F00] hover:bg-[#5a7d00] transition-colors'
                                : 'inline-block py-2 px-4 rounded-lg font-medium text-[#698F00] border border-[#698F00]/30 hover:bg-[#698F00]/5 transition-colors'
                            }
                          >
                            {actionLabel}
                            {isPrimary ? ' →' : ''}
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {isSupervisorOrAdmin && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Start QA</h2>
                <div className="space-y-3">
                  {applicableChecks.map((checkType) => {
                    if (activeRunForType(runs, checkType)) return null;
                    return (
                      <div
                        key={checkType}
                        className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{qaTypeDisplayLabel(checkType)} QA</p>
                            <p className="mt-1 text-sm text-gray-600">{QA_CHECK_DESCRIPTIONS[checkType]}</p>
                          </div>
                          <Link
                            href={qaNewRunPath(orgSlug, jobId, checkType)}
                            className="inline-block py-2 px-4 rounded-lg font-medium text-white bg-[#698F00] hover:bg-[#5a7d00] transition-colors"
                          >
                            Start {qaTypeDisplayLabel(checkType)} QA
                          </Link>
                        </div>
                      </div>
                    );
                  })}

                  {!hasTradeQaChecks && !activeRunForType(runs, 'sign_off') && (
                    <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Supervisor sign-off</p>
                          <p className="mt-1 text-sm text-gray-600">{SIGN_OFF_DESCRIPTION}</p>
                        </div>
                        <Link
                          href={qaNewRunPath(orgSlug, jobId, 'sign_off')}
                          className="inline-block py-2 px-4 rounded-lg font-medium text-white bg-[#698F00] hover:bg-[#5a7d00] transition-colors"
                        >
                          Start supervisor sign-off
                        </Link>
                      </div>
                    </div>
                  )}

                  {hasTradeQaChecks &&
                    applicableChecks.every((checkType) => activeRunForType(runs, checkType)) && (
                      <p className="text-sm text-gray-600">
                        All applicable checklists are already active on this job.
                      </p>
                    )}
                </div>
              </section>
            )}

            {viewerRole === 'field' && (
              <section className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <p className="text-sm text-gray-700">
                  New QA checklists are started by your site supervisor.
                  {primaryActiveRun
                    ? ' Use Continue QA above to work on the active checklist.'
                    : ' Ask your supervisor to start the checklist for this job.'}
                </p>
              </section>
            )}

            {historyRuns.length > 0 && (
              <section>
                <button
                  type="button"
                  onClick={() => setHistoryOpen((open) => !open)}
                  className="text-sm font-medium text-[#698F00] hover:underline"
                >
                  {historyOpen ? 'Hide QA history' : 'Show QA history'}
                </button>
                {historyOpen && (
                  <ul className="mt-3 divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white">
                    {historyRuns.map((run) => {
                      const historyDate = run.supervisor_final_approved_at ?? run.completed_at ?? run.started_at;
                      return (
                        <li key={run.id} className="px-4 py-3 flex justify-between items-center gap-3">
                          <span className="text-sm text-gray-700">
                            {qaTypeDisplayLabel(run.qa_type)}
                            {' · '}
                            {runDisplayStatus(run)}
                            {' · '}
                            {formatQaDateTime(historyDate)}
                          </span>
                          <Link
                            href={qaRunPath(orgSlug, jobId, run.id, run.qa_type)}
                            className="shrink-0 text-sm text-[#698F00] hover:underline"
                          >
                            View QA
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
