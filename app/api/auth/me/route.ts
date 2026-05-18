import { NextRequest, NextResponse } from 'next/server';
import { guardStaffApi } from '@/lib/guard-staff-api';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';
  const auth = await guardStaffApi(orgSlug);
  if (auth instanceof NextResponse) {
    return auth;
  }

  return NextResponse.json({
    ok: true,
    staff: {
      id: auth.staff.id,
      fullName: auth.staff.full_name,
      email: auth.staff.email,
      role: auth.staff.role,
      active: auth.staff.active,
    },
    org: {
      id: auth.org.id,
      slug: auth.org.slug,
      name: auth.org.name,
    },
  });
}
