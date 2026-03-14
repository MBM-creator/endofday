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
  id: string;
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
  daily_note?: string | null;
  daily_note_updated_at?: string | null;
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
  const [activeStage, setActiveStage] = useState<Stage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [brief, setBrief] = useState<JobBrief | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);

  const [photos, setPhotos] = useState<PreCommencementPhoto[]>([]);
  const [photosError, setPhotosError] = useState<string | null>(null);

  const [completions, setCompletions] = useState<Record<string, string>>({});
  const [completionsError, setCompletionsError] = useState<string | null>(null);
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);

  const [dailyNote, setDailyNote] = useState('');
  const [dailyNoteSaving, setDailyNoteSaving] = useState(false);
  const [dailyNoteError, setDailyNoteError] = useState<string | null>(null);

  // Single consolidated load for Today's Work data
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
    setActiveStage(null);
    setBrief(null);
    setPhotos([]);
    setCompletions({});
    setBriefError(null);
    setPhotosError(null);
    setCompletionsError(null);
    setDailyNote('');
    setDailyNoteError(null);

    fetch(`/api/jobs/${jobId}/today?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }: {
        res: Response;
        data: {
          ok?: boolean;
          job?: Job;
          activeStage?: Stage | null;
          brief?: JobBrief | null;
          photos?: PreCommencementPhoto[];
          completions?: Record<string, string>;
          briefError?: string | null;
          photosError?: string | null;
          message?: string;
        };
      }) => {
        if (cancelled) return;
        if (!res.ok || !data?.ok) {
          setError(typeof data?.message === 'string' ? data.message : 'Failed to load page');
          return;
        }
        if (!data.job) {
          setError('Job not found');
          return;
        }
        setJob(data.job);
        setActiveStage(data.activeStage ?? null);
        setBrief(data.brief ?? null);
        setPhotos(Array.isArray(data.photos) ? data.photos : []);
        setCompletions(typeof data.completions === 'object' && data.completions != null ? data.completions : {});
        setBriefError(data.briefError ?? null);
        setPhotosError(data.photosError ?? null);
        setDailyNote(data.activeStage?.daily_note ?? '');
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load page');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orgSlug, jobId]);

  async function toggleCompletion(itemId: string, currentlyCompleted: boolean) {
    if (!activeStage?.id || !orgSlug || togglingItemId) return;
    setTogglingItemId(itemId);
    const nextCompleted = !currentlyCompleted;
    setCompletionsError(null);
    setCompletions((prev) => {
      const next = { ...prev };
      if (nextCompleted) {
        next[itemId] = new Date().toISOString();
      } else {
        delete next[itemId];
      }
      return next;
    });
    try {
      const res = await fetch(
        `/api/stages/${activeStage.id}/checklist-completions?orgSlug=${encodeURIComponent(orgSlug)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checklistTemplateItemId: itemId, completed: nextCompleted }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setCompletions((prev) => {
          const revert = { ...prev };
          if (nextCompleted) delete revert[itemId];
          else revert[itemId] = new Date().toISOString();
          return revert;
        });
        setCompletionsError(typeof data?.message === 'string' ? data.message : 'Could not save');
      }
    } catch {
      setCompletions((prev) => {
        const revert = { ...prev };
        if (nextCompleted) delete revert[itemId];
        else revert[itemId] = new Date().toISOString();
        return revert;
      });
      setCompletionsError('Could not save');
    } finally {
      setTogglingItemId(null);
    }
  }

  async function saveDailyNote() {
    if (!activeStage?.id || !orgSlug || dailyNoteSaving) return;
    setDailyNoteSaving(true);
    setDailyNoteError(null);
    try {
      const res = await fetch(
        `/api/stages/${activeStage.id}/daily-note?orgSlug=${encodeURIComponent(orgSlug)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: dailyNote }),
        }
      );
      const data = await res.json();
      if (res.ok && data?.ok) {
        setDailyNote(data.dailyNote ?? '');
      } else {
        setDailyNoteError(typeof data?.message === 'string' ? data.message : 'Could not save note');
      }
    } catch {
      setDailyNoteError('Could not save note');
    } finally {
      setDailyNoteSaving(false);
    }
  }

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
              {briefError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                  {briefError}
                </div>
              )}
              {!briefError && (
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
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Daily notes</h2>
              {dailyNoteError && (
                <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                  {dailyNoteError}
                </div>
              )}
              <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <textarea
                  value={dailyNote}
                  onChange={(e) => setDailyNote(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#698F00] focus:border-transparent text-gray-900 text-sm resize-y min-h-[80px]"
                  placeholder="Notes for today's stage…"
                  disabled={dailyNoteSaving}
                  aria-label="Daily notes"
                />
                <button
                  type="button"
                  onClick={saveDailyNote}
                  disabled={dailyNoteSaving}
                  className="mt-2 bg-[#698F00] text-white py-2 px-4 rounded-lg font-medium hover:bg-[#5a7d00] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {dailyNoteSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Pre-commencement photos</h2>
              {photosError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                  {photosError}
                </div>
              )}
              {!photosError && photos.length > 0 && (
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
              {!photosError && photos.length === 0 && (
                <p className="text-gray-500 text-sm">No photos yet.</p>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Checklist</h2>
              {completionsError && (
                <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                  {completionsError}
                </div>
              )}
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
                  const checklistDisabled = !!togglingItemId;
                  return (
                    <div className="space-y-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                      {groups.map(
                        (g) =>
                          g.list.length > 0 && (
                            <div key={g.key}>
                              <span className="font-medium text-gray-700">{g.label}:</span>
                              <ul className="mt-0.5 ml-3 list-none text-gray-600 text-sm space-y-1">
                                {g.list.map((item) => (
                                  <li key={item.id} className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      id={`check-${item.id}`}
                                      checked={!!completions[item.id]}
                                      onChange={() => toggleCompletion(item.id, !!completions[item.id])}
                                      disabled={checklistDisabled}
                                      className="h-4 w-4 rounded border-gray-300 text-[#698F00] focus:ring-[#698F00] disabled:opacity-50"
                                      aria-label={item.label}
                                    />
                                    <label htmlFor={`check-${item.id}`} className="flex-1 cursor-pointer">
                                      {item.label}
                                    </label>
                                  </li>
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
