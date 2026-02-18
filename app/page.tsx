import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Daily Reports</h1>
        <p className="text-gray-600 mb-8">
          Submit your daily site reports quickly and easily.
        </p>
        <Link
          href="/t/madebymobbs/daily"
          className="inline-block bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Go to Report Form
        </Link>
        <p className="mt-4 text-sm text-gray-500">
          URL format: /t/[orgSlug]/daily
        </p>
      </div>
    </div>
  );
}
