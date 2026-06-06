/** Default reporting timezone for Daily Site Updates and other QA daily filing. */
export const DEFAULT_REPORT_TIMEZONE = 'Australia/Melbourne';

export function resolveReportTimezone(orgTimezone?: string | null): string {
  const trimmed = orgTimezone?.trim();
  return trimmed || DEFAULT_REPORT_TIMEZONE;
}

/** Calendar date (YYYY-MM-DD) in the given IANA timezone. */
export function formatReportDateInTimezone(
  submittedAt: Date | string,
  timeZone: string = DEFAULT_REPORT_TIMEZONE
): string {
  const d = typeof submittedAt === 'string' ? new Date(submittedAt) : submittedAt;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function todayReportDate(timeZone: string = DEFAULT_REPORT_TIMEZONE): string {
  return formatReportDateInTimezone(new Date(), timeZone);
}

export function isValidReportDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
