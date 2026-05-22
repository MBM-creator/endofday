import { redirect } from 'next/navigation';

export default async function DailyReportPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  redirect(`/t/${orgSlug}/jobs`);
}
