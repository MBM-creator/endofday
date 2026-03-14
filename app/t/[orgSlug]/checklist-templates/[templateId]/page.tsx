'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface ChecklistTemplate {
  id: string;
  organisation_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface ChecklistTemplateItem {
  id: string;
  template_id: string;
  item_type: string;
  label: string;
  sort_order: number;
}

const ITEM_TYPES = ['tools', 'materials', 'qc'] as const;

type ItemRow = { id: string; type: (typeof ITEM_TYPES)[number]; label: string };

function itemToRow(item: ChecklistTemplateItem): ItemRow {
  const type = ITEM_TYPES.includes(item.item_type as (typeof ITEM_TYPES)[number])
    ? (item.item_type as (typeof ITEM_TYPES)[number])
    : 'tools';
  return { id: item.id, type, label: item.label };
}

export default function EditChecklistTemplatePage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const templateId = (params?.templateId as string) ?? '';

  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [name, setName] = useState('');
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgSlug || !templateId) {
      setError('Template not found');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/checklist-templates/${templateId}?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(typeof data?.message === 'string' ? data.message : 'Failed to load template');
          return;
        }
        if (data?.ok && data?.template) {
          setTemplate(data.template);
          setName(data.template.name ?? '');
          const list = Array.isArray(data.items) ? data.items.map(itemToRow) : [];
          setItems(list.length ? list : [{ id: '', type: 'tools', label: '' }]);
        } else {
          setError('Invalid response');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load template');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orgSlug, templateId]);

  const addItem = () => {
    setItems((prev) => [...prev, { id: `new-${Date.now()}`, type: 'tools', label: '' }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: 'type' | 'label', value: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSaveError('Template name is required');
      return;
    }
    const validItems = items
      .map((row) => ({ type: row.type, label: row.label.trim() }))
      .filter((row) => row.label.length > 0);

    if (!orgSlug || !templateId) {
      setSaveError('Invalid context');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/checklist-templates/${templateId}?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, items: validItems }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.ok) {
        setTemplate(data.template ?? template);
        const list = Array.isArray(data.items) ? data.items.map(itemToRow) : [];
        setItems(list.length ? list : [{ id: '', type: 'tools', label: '' }]);
        return;
      }
      setSaveError(typeof data?.message === 'string' ? data.message : 'Failed to save');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <p className="text-gray-600">Loading template…</p>
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error ?? 'Template not found'}
          </div>
          {orgSlug && (
            <Link href={`/t/${orgSlug}/checklist-templates`} className="text-[#698F00] hover:underline">
              Back to checklist templates
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          {orgSlug && (
            <Link
              href={`/t/${orgSlug}/checklist-templates`}
              className="text-sm text-gray-600 hover:text-[#698F00]"
            >
              ← Checklist templates
            </Link>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit template</h1>

        {saveError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {saveError}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label htmlFor="templateName" className="block text-sm font-medium text-gray-700 mb-1">
              Template name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="templateName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#698F00] focus:border-transparent"
              required
              disabled={isSaving}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Items</label>
              <button
                type="button"
                onClick={addItem}
                className="text-sm text-[#698F00] hover:underline"
              >
                Add item
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Type: tools, materials, or qc. Blank rows are ignored when saving.
            </p>
            <ul className="space-y-3">
              {items.map((row, index) => (
                <li
                  key={row.id || `row-${index}`}
                  className="flex flex-wrap gap-2 items-center p-3 bg-white border border-gray-200 rounded-lg"
                >
                  <select
                    value={row.type}
                    onChange={(e) => updateItem(index, 'type', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#698F00] focus:border-transparent min-w-[100px]"
                    disabled={isSaving}
                  >
                    {ITEM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={row.label}
                    onChange={(e) => updateItem(index, 'label', e.target.value)}
                    placeholder="Label"
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#698F00] focus:border-transparent"
                    disabled={isSaving}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                    disabled={isSaving}
                    aria-label="Remove item"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-[#698F00] text-white py-3 px-6 rounded-lg font-medium hover:bg-[#5a7d00] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  );
}
