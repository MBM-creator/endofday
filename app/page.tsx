import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">QA Checks</h1>
        <p className="text-gray-600 mb-8">
          Open a job and continue the QA checklist needed for today&apos;s work.
        </p>
        <Link
          href="/t/madebymobbs/jobs"
          className="inline-block bg-[#698F00] text-white py-3 px-6 rounded-lg font-medium hover:bg-[#5a7d00] transition-colors"
        >
          Open Jobs
        </Link>
        <p className="mt-4 text-sm text-gray-500">
          Select a job, then open today&apos;s QA.
        </p>
      </div>
    </div>
  );
}
