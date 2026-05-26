'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { CcProject } from '@/lib/cc-client';
import { ccClientDisplayName } from '@/lib/cc-client-display';

interface Job {
  id: string;
  organisation_id: string;
  name: string;
  site_id: string | null;
  created_at: string;
  cc_project_id?: string | null;
  cc_client_id?: string | null;
  cc_project_title_snapshot?: string | null;
  cc_client_name_snapshot?: string | null;
}

export default function JobsListPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';

  const [jobs, setJobs] = useState<Job[]>([]);
  const [ccProjects, setCcProjects] = useState<CcProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgSlug) {
      return;
    }

    let cancelled = false;

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
          setError(null);
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

  useEffect(() => {
    if (!orgSlug) return;

    let cancelled = false;
    fetch('/api/cc/projects')
      .then((res) => res.json())
      .then((data: { ok?: boolean; projects?: CcProject[] }) => {
        if (!cancelled && data?.ok && Array.isArray(data.projects)) {
          setCcProjects(data.projects);
        }
      })
      .catch(() => {
        if (!cancelled) setCcProjects([]);
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

  function clientConnectLabel(job: Job): { title: string; client: string | null; address: string | null; isLinked: boolean } {
    const project = job.cc_project_id
      ? ccProjects.find((candidate) => candidate.project_id === job.cc_project_id) ?? null
      : null;

    return {
      title: project?.project_title ?? job.cc_project_title_snapshot ?? job.name,
      client: project ? ccClientDisplayName(project) : job.cc_client_name_snapshot ?? null,
      address: project?.site_address ?? null,
      isLinked: Boolean(project || job.cc_project_id || job.cc_client_id || job.cc_project_title_snapshot || job.cc_client_name_snapshot),
    };
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          {orgSlug && (
            <Link
              href={`/t/${orgSlug}/jobs/new`}
              className="rounded-lg bg-[#698F00] px-4 py-2 text-sm font-medium text-white hover:bg-[#5a7d00]"
            >
              New job
            </Link>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {loading && (
          <p className="text-gray-600">Loading jobs…</p>
        )}

        {!loading && !error && jobs.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
            No jobs yet.
          </div>
        )}

        {!loading && !error && jobs.length > 0 && (
          <ul className="space-y-3">
            {jobs.map((job) => {
              const ccLabel = clientConnectLabel(job);
              return (
                <li key={job.id}>
                  <Link
                    href={`/t/${orgSlug}/jobs/${job.id}`}
                    className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-[#698F00] hover:shadow"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-medium text-gray-900">{ccLabel.title}</span>
                      {job.created_at && (
                        <span className="text-sm text-gray-500">
                          {formatDate(job.created_at)}
                        </span>
                      )}
                    </div>
                    {ccLabel.isLinked && (ccLabel.client || ccLabel.address) && (
                      <p className="mt-1 text-sm text-gray-600">
                        {[ccLabel.client, ccLabel.address].filter(Boolean).join(' — ')}
                      </p>
                    )}
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
