import { redirect } from 'next/navigation';
import { getSessionUser, loadStaffProfileForOrg, type StaffAuthContext } from '@/lib/staff-auth';

function loginRedirect(orgSlug: string, reason?: string): never {
  const params = new URLSearchParams();
  params.set('next', `/t/${orgSlug}/admin`);
  if (reason) params.set('reason', reason);
  redirect(`/login?${params.toString()}`);
}

/** Server Component guard for admin-only pages. Redirects non-admins to login. */
export async function requireAdminPage(orgSlug: string): Promise<StaffAuthContext> {
  const slug = orgSlug.trim();
  if (!slug) {
    redirect('/login?reason=no_org');
  }

  const user = await getSessionUser();
  if (!user) {
    loginRedirect(slug);
  }

  const resolved = await loadStaffProfileForOrg(user.id, slug);
  if (!resolved.ok) {
    loginRedirect(
      slug,
      resolved.reason === 'inactive' ? 'deactivated' : resolved.reason === 'invalid_org' ? 'no_org' : 'no_access'
    );
  }

  if (resolved.staff.role !== 'admin') {
    loginRedirect(slug, 'forbidden');
  }

  return {
    staff: resolved.staff,
    org: resolved.org,
    user: { id: user.id, email: user.email },
  };
}
