import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export type StaffRole = 'field' | 'supervisor' | 'admin';

export interface StaffProfile {
  id: string;
  org_id: string;
  full_name: string;
  email: string;
  role: StaffRole;
  active: boolean;
}

export interface StaffOrg {
  id: string;
  slug: string;
  name: string;
}

export interface StaffAuthContext {
  staff: StaffProfile;
  org: StaffOrg;
  user: { id: string; email: string | undefined };
}

const ALL_ROLES: StaffRole[] = ['field', 'supervisor', 'admin'];

function authJson(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }
  return user;
}

export async function loadStaffProfileForOrg(
  userId: string,
  orgSlug: string
): Promise<
  | { ok: true; staff: StaffProfile; org: StaffOrg }
  | { ok: false; reason: 'invalid_org' | 'no_profile' | 'inactive' }
> {
  const slug = orgSlug.trim();
  if (!slug) {
    return { ok: false, reason: 'invalid_org' };
  }

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organisations')
    .select('id, slug, name')
    .eq('slug', slug)
    .single();

  if (orgError || !org) {
    return { ok: false, reason: 'invalid_org' };
  }

  const { data: staff, error: staffError } = await supabaseAdmin
    .from('staff_profiles')
    .select('id, org_id, full_name, email, role, active')
    .eq('id', userId)
    .eq('org_id', org.id)
    .maybeSingle();

  if (staffError || !staff) {
    return { ok: false, reason: 'no_profile' };
  }

  if (!staff.active) {
    return { ok: false, reason: 'inactive' };
  }

  return {
    ok: true,
    staff: staff as StaffProfile,
    org: {
      id: org.id as string,
      slug: org.slug as string,
      name: org.name as string,
    },
  };
}

export async function requireStaffProfile(
  orgSlug: string,
  allowedRoles: StaffRole[] = ALL_ROLES
): Promise<StaffAuthContext | NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return authJson('Sign in required', 401);
  }

  const resolved = await loadStaffProfileForOrg(user.id, orgSlug);
  if (!resolved.ok) {
    if (resolved.reason === 'invalid_org') {
      return authJson('Invalid organisation', 404);
    }
    if (resolved.reason === 'inactive') {
      return authJson('Your staff account is deactivated', 403);
    }
    return authJson('You do not have access to this organisation', 403);
  }

  if (!allowedRoles.includes(resolved.staff.role)) {
    return authJson('Insufficient permissions', 403);
  }

  return {
    staff: resolved.staff,
    org: resolved.org,
    user: { id: user.id, email: user.email },
  };
}

export async function countActiveAdmins(orgId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('staff_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('role', 'admin')
    .eq('active', true);

  if (error) {
    throw error;
  }
  return count ?? 0;
}
