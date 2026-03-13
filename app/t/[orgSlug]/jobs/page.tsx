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

export default function JobsListPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';

  const [jobs, setJobs] = useState<Job[]>([]);
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

    fetch(`/api/jobs?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(typeof data?.message === 'string' ? data.message : 'Failed to load jobs');
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
          setError(err instanceof Error ? err.message : 'Failed to load jobs');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orgSlug]);

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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Jobs</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {loading && (
          <p className="text-gray-600">Loading jobs…</p>
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
                <span className="font-medium text-gray-900">{job.name}</span>
                {job.created_at && (
                  <span className="ml-2 text-sm text-gray-500">
                    {formatDate(job.created_at)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
