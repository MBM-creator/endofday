type ClientConnectJob = {
  cc_project_id?: string | null;
  cc_quote_id?: string | null;
  cc_client_id?: string | null;
  cc_project_title_snapshot?: string | null;
  cc_client_name_snapshot?: string | null;
};

type ClientConnectJobSummaryProps = {
  job: ClientConnectJob;
  emptyText?: string;
  className?: string;
  compact?: boolean;
};

export function ClientConnectJobSummary({
  job,
  emptyText = 'No Client Connect project linked.',
  className = '',
  compact = false,
}: ClientConnectJobSummaryProps) {
  const hasLink = Boolean(
    job.cc_project_id ||
      job.cc_quote_id ||
      job.cc_client_id ||
      job.cc_project_title_snapshot ||
      job.cc_client_name_snapshot
  );

  if (!hasLink) {
    return (
      <p className={`text-sm text-gray-500 ${className}`.trim()}>
        {emptyText}
      </p>
    );
  }

  const title = job.cc_project_title_snapshot || 'Linked Client Connect project';
  const client = job.cc_client_name_snapshot;
  const isPending = !job.cc_project_id && !job.cc_quote_id;

  if (compact) {
    return (
      <p className={`text-sm text-gray-600 ${className}`.trim()}>
        {isPending ? 'Pending Client Connect:' : 'Client Connect:'}{' '}
        <span className="font-medium text-gray-900">{title}</span>
        {client ? ` — ${client}` : ''}
      </p>
    );
  }

  return (
    <div className={`rounded-lg border border-[#698F00]/30 bg-[#698F00]/5 px-3 py-2 ${className}`.trim()}>
      <p className="text-xs font-medium uppercase tracking-wide text-[#5a7d00]">
        {isPending ? 'Pending Client Connect' : 'Client Connect'}
      </p>
      <p className="mt-0.5 text-sm font-medium text-gray-900">{title}</p>
      {client && <p className="text-sm text-gray-600">{client}</p>}
    </div>
  );
}
