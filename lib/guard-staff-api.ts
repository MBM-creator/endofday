import { NextResponse } from 'next/server';
import { requireStaffProfile, type StaffAuthContext, type StaffRole } from '@/lib/staff-auth';

export async function guardStaffApi(
  orgSlug: string,
  allowedRoles?: StaffRole[]
): Promise<StaffAuthContext | NextResponse> {
  if (!orgSlug.trim()) {
    return NextResponse.json({ ok: false, message: 'orgSlug is required' }, { status: 400 });
  }
  return requireStaffProfile(orgSlug.trim(), allowedRoles);
}
