'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface JobOverviewEntry {
  id: string;
  name: string;
  activeStageName: string | null;
  checklistCompleted: number;
  checklistTotal: number;
  hasDailyNote: boolean;
  eodSubmittedToday: boolean;
}

export default function OverviewPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';

  const [jobs, setJobs] = useState<JobOverviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgSlug) {
      setError('Organisation is required');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/jobs/overview?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }: { res: Response; data: { ok?: boolean; jobs?: JobOverviewEntry[]; message?: string } }) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(typeof data?.message === 'string' ? data.message : 'Failed to load overview');
          return;
        }
        if (data?.ok && Array.isArray(data.jobs)) {
          setJobs(data.jobs);
        } else {
          setError('Invalid response');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load overview');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orgSlug]);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Jobs overview</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {loading && (
          <p className="text-gray-600">Loading…</p>
        )}

        {!loading && !error && jobs.length === 0 && (
          <p className="text-gray-600">No jobs yet.</p>
        )}

        {!loading && !error && jobs.length > 0 && (
          <ul className="space-y-3">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
              >
                <p className="font-medium text-gray-900">{job.name}</p>
                <p className="mt-1 text-sm text-gray-600">
                  {job.activeStageName ?? 'No active stage'}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                  <span>
                    Checklist {job.checklistCompleted} / {job.checklistTotal}
                  </span>
                  <span>{job.hasDailyNote ? <span className="text-[#698F00]">Note</span> : 'No note'}</span>
                  <span>{job.eodSubmittedToday ? <span className="text-[#698F00]">Done for today</span> : 'Not done'}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
