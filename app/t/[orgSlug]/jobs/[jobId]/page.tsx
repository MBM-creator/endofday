'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface Job {
  id: string;
  organisation_id: string;
  name: string;
  site_id: string | null;
  created_at: string;
}

interface Stage {
  id: string;
  job_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export default function JobDetailPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const jobId = (params?.jobId as string) ?? '';

  const [job, setJob] = useState<Job | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgSlug || !jobId) {
      setError('Job not found');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setJob(null);
    setStages([]);

    fetch(`/api/jobs?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(typeof data?.message === 'string' ? data.message : 'Failed to load job');
          return;
        }
        if (!data?.ok || !Array.isArray(data.jobs)) {
          setError('Invalid response');
          return;
        }
        const found = data.jobs.find((j: Job) => j.id === jobId);
        if (!found) {
          setError('Job not found');
          return;
        }
        setJob(found);

        return fetch(`/api/stages?jobId=${encodeURIComponent(jobId)}`);
      })
      .then((stagesRes) => {
        if (cancelled || stagesRes === undefined) return undefined;
        return stagesRes.json().then((stagesData: { ok?: boolean; stages?: Stage[]; message?: string }) => ({ stagesRes, stagesData }));
      })
      .then((next) => {
        if (cancelled || next === undefined) return;
        const { stagesRes, stagesData } = next;
        if (!stagesRes.ok) {
          setError(typeof stagesData?.message === 'string' ? stagesData.message : 'Failed to load stages');
          return;
        }
        if (stagesData?.ok && Array.isArray(stagesData.stages)) {
          setStages(stagesData.stages);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load job');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orgSlug, jobId]);

  function formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { dateStyle: 'short' });
    } catch {
      return '';
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {loading && (
          <p className="text-gray-600">Loading…</p>
        )}

        {!loading && !error && job && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">{job.name}</h1>
              {job.created_at && (
                <p className="mt-1 text-sm text-gray-500">{formatDate(job.created_at)}</p>
              )}
            </div>

            <h2 className="text-lg font-semibold text-gray-900 mb-3">Stages</h2>
            {stages.length === 0 ? (
              <p className="text-gray-600">No stages yet.</p>
            ) : (
              <ul className="space-y-3">
                {stages.map((stage) => (
                  <li
                    key={stage.id}
                    className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
                  >
                    <span className="font-medium text-gray-900">{stage.name}</span>
                    {stage.created_at && (
                      <span className="ml-2 text-sm text-gray-500">
                        {formatDate(stage.created_at)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
