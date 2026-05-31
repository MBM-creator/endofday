import { redirect } from 'next/navigation';
import { getSessionUser, loadStaffProfileForOrg, isSupervisorOrAdminRole, type StaffAuthContext } from '@/lib/staff-auth';

function loginRedirect(orgSlug: string, nextPath: string, reason?: string): never {
  const params = new URLSearchParams();
  params.set('next', nextPath);
  if (reason) params.set('reason', reason);
  redirect(`/login?${params.toString()}`);
}

/** Server Component guard for supervisor/admin pages (e.g. evidence gallery). */
export async function requireSupervisorOrAdminPage(orgSlug: string, nextPath: string): Promise<StaffAuthContext> {
  const slug = orgSlug.trim();
  if (!slug) {
    redirect('/login?reason=no_org');
  }

  const user = await getSessionUser();
  if (!user) {
    loginRedirect(slug, nextPath);
  }

  const resolved = await loadStaffProfileForOrg(user.id, slug);
  if (!resolved.ok) {
    loginRedirect(
      slug,
      nextPath,
      resolved.reason === 'inactive' ? 'deactivated' : resolved.reason === 'invalid_org' ? 'no_org' : 'no_access'
    );
  }

  if (!isSupervisorOrAdminRole(resolved.staff.role)) {
    loginRedirect(slug, nextPath, 'forbidden');
  }

  return {
    staff: resolved.staff,
    org: resolved.org,
    user: { id: user.id, email: user.email },
  };
}
