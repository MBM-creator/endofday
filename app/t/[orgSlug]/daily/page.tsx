'use client';

import React, { useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import imageCompression from 'browser-image-compression';

interface CompressedPhoto {
  file: File;
  preview: string;
}

export default function DailyReportPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  const [crewName, setCrewName] = useState('');
  const [siteNumber, setSiteNumber] = useState('');
  const [summary, setSummary] = useState('');
  const [finishedPlan, setFinishedPlan] = useState<boolean | null>(null);
  const [notFinishedWhy, setNotFinishedWhy] = useState('');
  const [catchupPlan, setCatchupPlan] = useState('');
  const [siteLeftClean, setSiteLeftClean] = useState<boolean | null>(null);
  const [photos, setPhotos] = useState<CompressedPhoto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [lastEmailSent, setLastEmailSent] = useState<boolean | null>(null);
  const [lastEmailError, setLastEmailError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setError(null);

    // Check total count
    const newTotal = photos.length + files.length;
    if (newTotal > 10) {
      setError('Maximum 10 photos allowed');
      return;
    }

    try {
      const compressionOptions = {
        maxSizeMB: 2,
        maxWidthOrHeight: 2200,
        useWebWorker: true,
        initialQuality: 0.82,
      };

      const compressedFiles = await Promise.all(
        files.map(async (file) => {
          const compressed = await imageCompression(file, compressionOptions);
          const preview = URL.createObjectURL(compressed);
          return { file: compressed, preview };
        })
      );

      setPhotos((prev) => [...prev, ...compressedFiles]);
    } catch (err) {
      console.error('Compression error:', err);
      setError('Failed to compress images. Please try again.');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const photoToRemove = prev[index];
      if (photoToRemove?.preview) URL.revokeObjectURL(photoToRemove.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const validateForm = (): string | null => {
    if (!crewName.trim()) return 'Crew name is required';
    if (!siteNumber.trim()) return 'Site Number / Name is required';
    if (!summary.trim()) return "Today's summary is required";
    if (finishedPlan === null) return 'Please indicate if you finished everything planned today';

    if (finishedPlan === false) {
      if (!notFinishedWhy.trim()) return 'Please explain what was not finished and why';
      if (!catchupPlan.trim()) return 'Please provide a plan to make up the lost time';
    }

    if (siteLeftClean === null) return 'Please indicate if the site was left clean / tools in site box / materials under cover';

    if (photos.length < 3) return 'At least 3 photos are required';
    if (photos.length > 10) return 'Maximum 10 photos allowed';

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('orgSlug', orgSlug);
      formData.append('crewName', crewName.trim());
      formData.append('siteNumber', siteNumber.trim());
      formData.append('summary', summary.trim());
      formData.append('finishedPlan', finishedPlan!.toString());

      if (finishedPlan === false) {
        formData.append('notFinishedWhy', notFinishedWhy.trim());
        formData.append('catchupPlan', catchupPlan.trim());
      } else {
        // Ensure server doesn't accidentally see stale text from previous attempt
        formData.append('notFinishedWhy', '');
        formData.append('catchupPlan', '');
      }

      formData.append('siteLeftClean', siteLeftClean!.toString());

      photos.forEach((photo) => {
        formData.append('photos', photo.file);
      });

      const response = await fetch('/api/daily-report', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'Failed to submit report');
      }

      setSuccess(true);
      setLastEmailSent(data.emailSent === true);
      setLastEmailError(data.emailError ?? null);

      // Reset form
      setCrewName('');
      setSiteNumber('');
      setSummary('');
      setFinishedPlan(null);
      setNotFinishedWhy('');
      setCatchupPlan('');
      setSiteLeftClean(null);

      // Revoke previews + clear photos
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Daily Site Report</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
            <p>Report submitted successfully!</p>
            {lastEmailSent === false && (
              <p className="mt-2 text-amber-800 text-sm">
                The notification email could not be sent.
                {lastEmailError && ` (${lastEmailError})`}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Crew Name */}
          <div>
            <label htmlFor="crewName" className="block text-sm font-medium text-gray-700 mb-1">
              Crew name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="crewName"
              value={crewName}
              onChange={(e) => setCrewName(e.target.value)}
              placeholder="Crew 1 / Steve / Team A"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#698F00] focus:border-transparent"
              required
            />
          </div>

          {/* Site Number / Name */}
          <div>
            <label htmlFor="siteNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Site Number / Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="siteNumber"
              value={siteNumber}
              onChange={(e) => setSiteNumber(e.target.value)}
              placeholder="e.g. 024 or North Site"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#698F00] focus:border-transparent"
              required
            />
          </div>

          {/* Summary */}
          <div>
            <label htmlFor="summary" className="block text-sm font-medium text-gray-700 mb-1">
              Today&apos;s Summary <span className="text-red-500">*</span>
            </label>
            <textarea
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="What did you achieve today - be precise about tasks completed."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#698F00] focus:border-transparent"
              required
            />
          </div>

          {/* Finished Plan */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Did we finish everything planned today? <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFinishedPlan(true)}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  finishedPlan === true
                    ? 'bg-[#698F00] text-white border-[#698F00]'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setFinishedPlan(false)}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  finishedPlan === false
                    ? 'bg-[#698F00] text-white border-[#698F00]'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {/* Conditional fields when No */}
          {finishedPlan === false && (
            <div className="space-y-4 pl-4 border-l-4 border-[#698F00]">
              <div>
                <label htmlFor="notFinishedWhy" className="block text-sm font-medium text-gray-700 mb-1">
                  What was not finished and why? <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="notFinishedWhy"
                  value={notFinishedWhy}
                  onChange={(e) => setNotFinishedWhy(e.target.value)}
                  rows={3}
                  placeholder="List the tasks that were on the plan that did not get completed and why"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#698F00] focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label htmlFor="catchupPlan" className="block text-sm font-medium text-gray-700 mb-1">
                  Plan to make up the lost time <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="catchupPlan"
                  value={catchupPlan}
                  onChange={(e) => setCatchupPlan(e.target.value)}
                  rows={3}
                  placeholder="How can we get the project back on track so we can finish the project on time?"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#698F00] focus:border-transparent"
                  required
                />
              </div>
            </div>
          )}

          {/* Site Left Clean */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Site left clean / tools in site box / materials under cover <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSiteLeftClean(true)}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  siteLeftClean === true
                    ? 'bg-[#698F00] text-white border-[#698F00]'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setSiteLeftClean(false)}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  siteLeftClean === false
                    ? 'bg-[#698F00] text-white border-[#698F00]'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photos <span className="text-red-500">*</span> ({photos.length}/10)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoSelect}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#698F00] focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">Minimum 3 photos, maximum 10 photos required</p>

            {/* Photo previews */}
            {photos.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                {photos.map((photo, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={photo.preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-48 object-cover rounded-lg border border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove photo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#698F00] text-white py-3 px-6 rounded-lg font-medium hover:bg-[#5a7d00] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </form>
      </div>
    </div>
  );
}
