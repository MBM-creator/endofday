import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/staff-auth';
import { loadAdminDashboardData, parseDashboardFilters } from '@/lib/admin-dashboard/load-dashboard-data';
import { normalizeSupabaseError } from '@/lib/job-org-validation';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';
  const auth = await requireAdmin(orgSlug);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const filters = parseDashboardFilters(request.nextUrl.searchParams);

  try {
    const data = await loadAdminDashboardData(auth.org.id, auth.org.slug, filters);
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    console.error('[admin/dashboard GET]', normalizeSupabaseError(error));
    return NextResponse.json({ ok: false, message: 'Failed to load admin dashboard' }, { status: 500 });
  }
}
