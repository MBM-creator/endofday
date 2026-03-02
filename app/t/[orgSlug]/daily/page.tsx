'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import imageCompression from 'browser-image-compression';

interface UploadedPhoto {
  path: string;
  preview: string;
}

export default function DailyReportPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  const [draftId, setDraftId] = useState<string | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [crewName, setCrewName] = useState('');
  const [siteNumber, setSiteNumber] = useState('');
  const [summary, setSummary] = useState('');
  const [finishedPlan, setFinishedPlan] = useState<boolean | null>(null);
  const [notFinishedWhy, setNotFinishedWhy] = useState('');
  const [catchupPlan, setCatchupPlan] = useState('');
  const [siteLeftClean, setSiteLeftClean] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [lastEmailSent, setLastEmailSent] = useState<boolean | null>(null);
  const [lastEmailError, setLastEmailError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const setErrorRef = useRef(setError);
  setErrorRef.current = setError;

  // Catch Safari "expected pattern" errors that escape our try/catch (e.g. from fetch/stream)
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      const msg = typeof event.reason?.message === 'string' ? event.reason.message : String(event.reason ?? '');
      if (msg.includes('pattern') || msg.includes('did not match')) {
        event.preventDefault();
        event.stopPropagation();
        setErrorRef.current('Server error. Please try again or save your notes and refresh the page.');
      }
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, []);

  const ensureDraft = async (): Promise<string | null> => {
    if (draftId) return draftId;
    try {
      const res = await fetch('/api/daily-report/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgSlug }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Failed to start report');
        return null;
      }
      const id = data.draftId;
      if (id) setDraftId(id);
      return id ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start report');
      return null;
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setError(null);
    const newTotal = uploadedPhotos.length + files.length;
    if (newTotal > 10) {
      setError('Maximum 10 photos allowed');
      return;
    }

    const currentDraftId = await ensureDraft();
    if (!currentDraftId) return;

    setIsUploading(true);
    const compressionOptions = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      initialQuality: 0.82,
    };

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length });
      try {
        const compressed = await imageCompression(file, compressionOptions);
        const preview = URL.createObjectURL(compressed);
        const formData = new FormData();
        formData.append('file', compressed);

        const res = await fetch(`/api/daily-report/draft/${currentDraftId}/upload`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();

        if (!res.ok) {
          URL.revokeObjectURL(preview);
          setError(data.message || 'Failed to upload photo');
          break;
        }
        setUploadedPhotos((prev) => [...prev, { path: data.path, preview }]);
      } catch (err) {
        console.error('Upload error:', err);
        const msg = err instanceof Error ? err.message : '';
        const isSafariPatternError =
          typeof msg === 'string' && (msg.includes('expected pattern') || msg.includes('did not match the expected pattern'));
        setError(isSafariPatternError ? 'Could not process photos. Please try fewer or different images, or refresh and try again.' : 'Failed to upload image. Please try again.');
        break;
      }
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = async (index: number) => {
    const photo = uploadedPhotos[index];
    if (!photo) return;
    if (draftId) {
      try {
        await fetch(`/api/daily-report/draft/${draftId}/upload`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: photo.path }),
        });
      } catch (err) {
        console.warn('Failed to remove photo from server:', err);
      }
    }
    URL.revokeObjectURL(photo.preview);
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== index));
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

    if (uploadedPhotos.length < 3) return 'At least 3 photos are required';
    if (uploadedPhotos.length > 10) return 'Maximum 10 photos allowed';
    if (!draftId) return 'Please add at least 3 photos before submitting';

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

    if (!draftId) {
      setError('Please add at least 3 photos before submitting');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/daily-report/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          orgSlug,
          crewName: crewName.trim(),
          siteNumber: siteNumber.trim(),
          summary: summary.trim(),
          finishedPlan: finishedPlan!.toString(),
          notFinishedWhy: finishedPlan === false ? notFinishedWhy.trim() : '',
          catchupPlan: finishedPlan === false ? catchupPlan.trim() : '',
          siteLeftClean: siteLeftClean!.toString(),
        }),
      });

      const responseOk = response.ok;
      const requestIdFromHeader = response.headers.get('x-request-id') ?? '';
      const statusCode = response.status;

      let data: {
        ok?: boolean;
        message?: string;
        requestId?: string;
        errorCode?: string;
        reportId?: string;
        emailSent?: boolean;
        emailError?: string;
      };
      try {
        const buf = await response.arrayBuffer();
        const raw = new TextDecoder().decode(buf);
        data = raw ? JSON.parse(raw) : {};
      } catch {
        const rid = requestIdFromHeader;
        const formatErrorWithId = (msg: string) =>
          rid ? `${msg} Status: ${statusCode} · Request ID: ${rid}` : `${msg} Status: ${statusCode}`;
        if (responseOk) {
          setError(formatErrorWithId('Submission may have been received. If you don\'t see it in your reports, try again.'));
        } else {
          setError(formatErrorWithId('Server error. Please try again or save your notes and refresh the page.'));
        }
        return;
      }

      const requestId = data.requestId ?? requestIdFromHeader;
      const formatErrorWithId = (msg: string) =>
        requestId ? `${msg} Status: ${statusCode} · Request ID: ${requestId}` : `${msg} Status: ${statusCode}`;

      if (!responseOk || !data.ok) {
        let msg = data.message || 'Failed to submit report';
        if (data.errorCode) msg += ` (Code: ${data.errorCode})`;
        setError(formatErrorWithId(msg));
        return;
      }

      setSuccess(true);
      setLastEmailSent(data.emailSent === true);
      setLastEmailError(data.emailError ?? null);

      setCrewName('');
      setSiteNumber('');
      setSummary('');
      setFinishedPlan(null);
      setNotFinishedWhy('');
      setCatchupPlan('');
      setSiteLeftClean(null);
      setDraftId(null);
      uploadedPhotos.forEach((p) => URL.revokeObjectURL(p.preview));
      setUploadedPhotos([]);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
      const isSafariPatternError = msg.includes('pattern') || msg.includes('did not match');
      setError(isSafariPatternError ? 'Server error. Please try again or save your notes and refresh the page.' : (err instanceof Error ? err.message : 'An error occurred'));
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

        {draftId && (
          <div className="mb-4 p-3 bg-sky-50 border border-sky-200 rounded-lg text-sky-800 text-sm">
            Draft started — photos are saved as you add them.
            {uploadedPhotos.length > 0 && (
              <> {uploadedPhotos.length} photo{uploadedPhotos.length !== 1 ? 's' : ''} in this report.</>
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

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photos <span className="text-red-500">*</span> ({uploadedPhotos.length}/10)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoSelect}
              disabled={isUploading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#698F00] focus:border-transparent disabled:opacity-50"
            />
            <p className="mt-1 text-sm text-gray-500">
              {isUploading && uploadProgress
                ? `Uploading photo ${uploadProgress.current} of ${uploadProgress.total}…`
                : draftId
                  ? 'Photos are saved to your draft. Add more or remove any before submitting (min 3, max 10).'
                  : 'Add your first photo to start this report. Photos are uploaded and saved as you add them (min 3, max 10).'}
            </p>

            {uploadedPhotos.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                {uploadedPhotos.map((photo, index) => (
                  <div key={photo.path} className="relative group">
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

          {/* Submit button */}
          {uploadedPhotos.length > 0 && (
            <p className="text-sm text-gray-600">
              Submit report and {uploadedPhotos.length} photo{uploadedPhotos.length !== 1 ? 's' : ''}.
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting || isUploading}
            className="w-full bg-[#698F00] text-white py-3 px-6 rounded-lg font-medium hover:bg-[#5a7d00] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Submitting...' : isUploading ? (uploadProgress ? `Uploading ${uploadProgress.current}/${uploadProgress.total}…` : 'Uploading...') : 'Submit Report'}
          </button>
        </form>
      </div>
    </div>
  );
}
