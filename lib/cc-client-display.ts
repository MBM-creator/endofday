import type { CcProject } from '@/lib/cc-client';

export function ccClientDisplayName(project: Pick<CcProject, 'client_name' | 'client_contact'>): string {
  const clientName = project.client_name.trim();
  const clientContact = project.client_contact?.trim();
  return clientContact ? `${clientName} — ${clientContact}` : clientName;
}
