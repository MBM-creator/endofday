'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSectionDef } from '@/lib/paving-qa-v1-catalog';
import type { PavingSectionCode } from '@/lib/paving-qa-v1-types';

interface SectionState {
  section: PavingSectionCode;
  applicable: boolean;
  crewSubmittedAt: string | null;
  submissionStatus: string | null;
  cleared: boolean;
  clearReasons: string[];
  canSubmit: boolean;
  blockedBy: { section: string; reason: string }[] | null;
}

export default function PavingQaRunOverviewPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const jobId = (params?.jobId as string) ?? '';
  const runId = (params?.runId as string) ?? '';

  const [sectionStates, setSectionStates] = useState<SectionState[]>([]);
  const [runStatus, setRunStatus] = useState<string>('');
  const [finalAt, setFinalAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setSectionStates(Array.isArray(d.sectionStates) ? d.sectionStates : []);
        setRunStatus(String(d.run?.status ?? ''));
        setFinalAt(d.run?.supervisor_final_approved_at ?? null);
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
  }, [orgSlug, jobId, runId]);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href={`/t/${orgSlug}/jobs/${jobId}/qa`} className="text-sm text-[#698F00] hover:underline">
          ← Paving QA
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">QA run</h1>
        <p className="text-sm text-gray-600 mt-1">Status: {runStatus || '…'}</p>
        {finalAt && <p className="text-sm text-[#698F00] mt-1">Final approval recorded.</p>}

        <div className="mt-4 flex gap-3">
          <Link
            href={`/t/${orgSlug}/jobs/${jobId}/qa/paving/${runId}/supervisor`}
            className="text-sm font-medium text-[#698F00] hover:underline"
          >
            Supervisor
          </Link>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
        )}
        {loading && <p className="mt-4 text-gray-600">Loading…</p>}

        {!loading && !error && (
          <ul className="mt-6 space-y-2">
            {sectionStates.map((s) => {
              const def = getSectionDef(s.section);
              const title = def?.title ?? s.section;
              return (
                <li key={s.section} className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium text-gray-900">{title}</span>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {s.crewSubmittedAt && (
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800">Crew submitted</span>
                      )}
                      {s.cleared ? (
                        <span className="px-2 py-0.5 rounded bg-green-50 text-green-800">Cleared</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900">Not cleared</span>
                      )}
                      {!s.canSubmit && s.blockedBy && s.blockedBy.length > 0 && (
                        <span className="px-2 py-0.5 rounded bg-red-50 text-red-800">Blocked</span>
                      )}
                    </div>
                  </div>
                  {!s.canSubmit && s.blockedBy && s.blockedBy.length > 0 && (
                    <p className="mt-2 text-sm text-red-800">
                      {s.blockedBy.map((b) => b.reason).filter((x, i, a) => a.indexOf(x) === i).join(' · ')}
                    </p>
                  )}
                  {!s.cleared && s.clearReasons.length > 0 && (
                    <ul className="mt-2 text-xs text-gray-600 list-disc pl-4">
                      {s.clearReasons.slice(0, 4).map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href={`/t/${orgSlug}/jobs/${jobId}/qa/paving/${runId}/${encodeURIComponent(s.section)}`}
                    className="mt-3 inline-block text-sm text-[#698F00] font-medium hover:underline"
                  >
                    Open section →
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
