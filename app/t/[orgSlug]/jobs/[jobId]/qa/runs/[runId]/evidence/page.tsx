import Link from 'next/link';
import { QaEvidenceGallery } from '@/components/QaEvidenceGallery';
import { requireSupervisorOrAdminPage } from '@/lib/require-supervisor-or-admin-page';

export default async function QaEvidencePage({
  params,
}: {
  params: Promise<{ orgSlug: string; jobId: string; runId: string }>;
}) {
  const { orgSlug, jobId, runId } = await params;
  const nextPath = `/t/${orgSlug}/jobs/${jobId}/qa/runs/${runId}/evidence`;
  await requireSupervisorOrAdminPage(orgSlug, nextPath);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/t/${orgSlug}/admin`}
          className="mb-4 inline-block text-sm text-[#698F00] hover:underline"
        >
          ← Admin dashboard
        </Link>
        <QaEvidenceGallery orgSlug={orgSlug} jobId={jobId} runId={runId} />
      </div>
    </div>
  );
}
