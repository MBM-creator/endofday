'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
  const router = useRouter();
  const orgSlug = (params?.orgSlug as string) ?? '';

  const [jobs, setJobs] = useState<Job[]>([]);
  const [ccProjects, setCcProjects] = useState<CcProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingProjectId, setCreatingProjectId] = useState<string | null>(null);

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

  function normalise(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function ccProjectForJob(job: Job): CcProject | null {
    if (job.cc_project_id) {
      return ccProjects.find((candidate) => candidate.project_id === job.cc_project_id) ?? null;
    }

    const title = normalise(job.cc_project_title_snapshot ?? job.name);
    if (!title) return null;

    const matches = ccProjects.filter((candidate) => normalise(candidate.project_title) === title);
    return matches.length === 1 ? matches[0] : null;
  }

  function jobPriority(job: Job): number {
    if (job.cc_project_id && job.cc_client_name_snapshot) return 4;
    if (job.cc_project_id) return 3;
    if (job.cc_project_title_snapshot || job.cc_client_name_snapshot) return 2;
    return 1;
  }

  function isTestJob(job: Job): boolean {
    const name = normalise(job.name);
    const title = normalise(job.cc_project_title_snapshot);
    const client = normalise(job.cc_client_name_snapshot);
    return /^test(?:\s|$)/.test(name) || /^test(?:\s|$)/.test(title) || /^test client/.test(client);
  }

  function isTestProject(project: CcProject): boolean {
    return /^test(?:\s|$)/.test(normalise(project.project_title)) || /^test client/.test(normalise(project.client_name));
  }

  const visibleJobs = React.useMemo(() => {
    const byKey = new Map<string, Job>();

    for (const job of jobs) {
      if (isTestJob(job)) continue;

      const project = ccProjectForJob(job);
      const titleKey = normalise(project?.project_title ?? job.cc_project_title_snapshot ?? job.name);
      const key = titleKey ? `title:${titleKey}` : project ? `cc:${project.project_id}` : `job:${job.id}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, job);
        continue;
      }

      const existingPriority = jobPriority(existing);
      const nextPriority = jobPriority(job);
      if (
        nextPriority > existingPriority ||
        (nextPriority === existingPriority && new Date(job.created_at).getTime() > new Date(existing.created_at).getTime())
      ) {
        byKey.set(key, job);
      }
    }

    return Array.from(byKey.values()).sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
    });
  }, [jobs, ccProjects]);

  const visibleJobTitleKeys = React.useMemo(() => {
    return new Set(
      visibleJobs.map((job) => {
        const project = ccProjectForJob(job);
        return normalise(project?.project_title ?? job.cc_project_title_snapshot ?? job.name);
      })
    );
  }, [visibleJobs, ccProjects]);

  const availableCcProjects = React.useMemo(() => {
    return ccProjects.filter((project) => {
      if (isTestProject(project)) return false;
      return !visibleJobTitleKeys.has(normalise(project.project_title));
    });
  }, [ccProjects, visibleJobTitleKeys]);

  function clientConnectLabel(job: Job): { title: string; client: string | null; address: string | null; isLinked: boolean } {
    const project = ccProjectForJob(job);

    return {
      title: project?.project_title ?? job.cc_project_title_snapshot ?? job.name,
      client: project ? ccClientDisplayName(project) : job.cc_client_name_snapshot ?? null,
      address: project?.site_address ?? null,
      isLinked: Boolean(project || job.cc_project_id || job.cc_client_id || job.cc_project_title_snapshot || job.cc_client_name_snapshot),
    };
  }

  async function createFromClientConnect(project: CcProject) {
    if (!orgSlug || creatingProjectId) return;
    setError(null);
    setCreatingProjectId(project.project_id);

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgSlug, ccProjectId: project.project_id }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.ok && data.job?.id) {
        router.push(`/t/${orgSlug}/jobs/${data.job.id}`);
        return;
      }

      setError(typeof data?.message === 'string' ? data.message : 'Failed to create Client Connect job');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Client Connect job');
    } finally {
      setCreatingProjectId(null);
    }
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

        {!loading && !error && visibleJobs.length === 0 && availableCcProjects.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
            No jobs yet.
          </div>
        )}

        {!loading && !error && (visibleJobs.length > 0 || availableCcProjects.length > 0) && (
          <ul className="space-y-3">
            {visibleJobs.map((job) => {
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
            {availableCcProjects.map((project) => (
              <li key={project.project_id}>
                <button
                  type="button"
                  onClick={() => createFromClientConnect(project)}
                  disabled={!!creatingProjectId}
                  className="block w-full rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-[#698F00] hover:shadow disabled:cursor-wait disabled:opacity-70"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-medium text-gray-900">{project.project_title}</span>
                    <span className="text-xs font-medium uppercase text-[#698F00]">
                      {project.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {[ccClientDisplayName(project), project.site_address].filter(Boolean).join(' — ')}
                  </p>
                  {creatingProjectId === project.project_id && (
                    <p className="mt-2 text-xs text-gray-500">Creating job…</p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
