'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function NewChecklistTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = (params?.orgSlug as string) ?? '';

  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Template name is required');
      return;
    }

    if (!orgSlug) {
      setError('Organisation is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/checklist-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgSlug, name: trimmedName }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.ok && data?.template?.id) {
        router.push(`/t/${orgSlug}/checklist-templates/${data.template.id}`);
        return;
      }

      setError(typeof data?.message === 'string' ? data.message : 'Failed to create template');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">New checklist template</h1>

        {!orgSlug && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            Organisation is required.
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {orgSlug && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="templateName" className="block text-sm font-medium text-gray-700 mb-1">
                Template name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="templateName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Standard site setup"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#698F00] focus:border-transparent"
                required
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#698F00] text-white py-3 px-6 rounded-lg font-medium hover:bg-[#5a7d00] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating…' : 'Create template'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
