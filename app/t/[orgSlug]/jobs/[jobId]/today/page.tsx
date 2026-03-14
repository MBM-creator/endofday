'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Job {
  id: string;
  organisation_id: string;
  name: string;
  site_id: string | null;
  created_at: string;
  active_stage_id?: string | null;
}

interface ChecklistTemplateItem {
  item_type: string;
  label: string;
  sort_order: number;
}

interface Stage {
  id: string;
  job_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  checklist_template_id?: string | null;
  checklist_templates?: { name: string; checklist_template_items?: ChecklistTemplateItem[] } | null;
}

interface PreCommencementPhoto {
  id: string;
  storage_path: string;
  created_at: string;
  url: string;
}

interface JobBrief {
  id: string;
  job_id: string;
  content: string | null;
  updated_at: string;
}

export default function TodaysWorkPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const jobId = (params?.jobId as string) ?? '';

  const [job, setJob] = useState<Job | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [brief, setBrief] = useState<JobBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  const [photos, setPhotos] = useState<PreCommencementPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);

  // Resolve job and stages (required for active stage)
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

  // Fetch brief and photos when job is available (section-level errors only)
  useEffect(() => {
    if (!job || !orgSlug || !jobId) return;
    let cancelled = false;

    setBrief(null);
    setPhotos([]);
    setBriefError(null);
    setPhotosError(null);
    setBriefLoading(true);
    setPhotosLoading(true);

    const briefPromise = fetch(`/api/jobs/${jobId}/brief?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((res) => res.json())
      .then((data: { ok?: boolean; brief?: JobBrief | null; message?: string }) => {
        if (cancelled) return;
        if (!data?.ok) {
          setBriefError(typeof data?.message === 'string' ? data.message : 'Failed to load job brief');
          return;
        }
        setBrief(data.brief ?? null);
      })
      .catch((err) => {
        if (!cancelled) setBriefError(err instanceof Error ? err.message : 'Failed to load job brief');
      })
      .finally(() => {
        if (!cancelled) setBriefLoading(false);
      });

    const photosPromise = fetch(`/api/jobs/${jobId}/photos?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((res) => res.json())
      .then((data: { ok?: boolean; photos?: PreCommencementPhoto[]; message?: string }) => {
        if (cancelled) return;
        if (!data?.ok || !Array.isArray(data.photos)) {
          setPhotosError(typeof data?.message === 'string' ? data.message : 'Failed to load photos');
          return;
        }
        setPhotos(data.photos);
      })
      .catch((err) => {
        if (!cancelled) setPhotosError(err instanceof Error ? err.message : 'Failed to load photos');
      })
      .finally(() => {
        if (!cancelled) setPhotosLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [job, jobId, orgSlug]);

  const activeStage = job && stages.length > 0
    ? stages.find((s) => s.id === job.active_stage_id) ?? null
    : null;

  const hasActiveStage = !!activeStage;

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

        {!loading && !error && job && !hasActiveStage && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-gray-900">{job.name}</h1>
            <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
              <p className="text-gray-700">No active stage set. Set the active stage on the job detail page.</p>
              <Link
                href={`/t/${orgSlug}/jobs/${jobId}`}
                className="mt-3 inline-block text-sm font-medium text-[#698F00] hover:underline"
              >
                Go to job detail
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && job && hasActiveStage && activeStage && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{job.name}</h1>
              <p className="mt-1 text-lg font-medium text-[#698F00]">{activeStage.name}</p>
              <span className="text-xs font-medium text-[#698F00] bg-[#698F00]/20 px-2 py-0.5 rounded">
                Today&apos;s stage
              </span>
            </div>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Job brief</h2>
              {briefLoading && <p className="text-gray-600 text-sm">Loading…</p>}
              {briefError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                  {briefError}
                </div>
              )}
              {!briefLoading && !briefError && (
                <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                  {brief && brief.content !== null && brief.content !== '' ? (
                    <pre className="whitespace-pre-wrap font-sans text-gray-900 text-sm break-words">
                      {brief.content}
                    </pre>
                  ) : (
                    <p className="text-gray-500 text-sm">No job brief yet.</p>
                  )}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Pre-commencement photos</h2>
              {photosLoading && <p className="text-gray-600 text-sm">Loading…</p>}
              {photosError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                  {photosError}
                </div>
              )}
              {!photosLoading && !photosError && photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((photo) => (
                    <img
                      key={photo.id}
                      src={photo.url}
                      alt="Pre-commencement photo"
                      className="w-full aspect-square object-cover rounded-lg border border-gray-200 bg-gray-100"
                    />
                  ))}
                </div>
              )}
              {!photosLoading && !photosError && photos.length === 0 && (
                <p className="text-gray-500 text-sm">No photos yet.</p>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Checklist</h2>
              {activeStage.checklist_templates?.checklist_template_items &&
              activeStage.checklist_templates.checklist_template_items.length > 0 ? (
                (() => {
                  const items = [...activeStage.checklist_templates.checklist_template_items].sort(
                    (a, b) => a.sort_order - b.sort_order
                  );
                  const byType = {
                    tools: items.filter((i) => i.item_type === 'tools'),
                    materials: items.filter((i) => i.item_type === 'materials'),
                    qc: items.filter((i) => i.item_type === 'qc'),
                  };
                  const groups = [
                    { key: 'tools' as const, label: 'Tools', list: byType.tools },
                    { key: 'materials' as const, label: 'Materials', list: byType.materials },
                    { key: 'qc' as const, label: 'QC', list: byType.qc },
                  ];
                  return (
                    <div className="space-y-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                      {groups.map(
                        (g) =>
                          g.list.length > 0 && (
                            <div key={g.key}>
                              <span className="font-medium text-gray-700">{g.label}:</span>
                              <ul className="mt-0.5 ml-3 list-disc text-gray-600 text-sm">
                                {g.list.map((item, idx) => (
                                  <li key={idx}>{item.label}</li>
                                ))}
                              </ul>
                            </div>
                          )
                      )}
                    </div>
                  );
                })()
              ) : (
                <p className="text-gray-500 text-sm">No checklist items for this stage.</p>
              )}
            </section>

            <p className="pt-2">
              <Link
                href={`/t/${orgSlug}/jobs/${jobId}`}
                className="text-sm font-medium text-[#698F00] hover:underline"
              >
                Full job detail
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
