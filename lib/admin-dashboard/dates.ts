import type { DashboardDateRange } from './types';

export function resolveDateRange(range: DashboardDateRange): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end);

  if (range === 'today') {
    start.setUTCHours(0, 0, 0, 0);
    return { start, end };
  }

  if (range === '30d') {
    start.setUTCDate(start.getUTCDate() - 30);
    return { start, end };
  }

  start.setUTCDate(start.getUTCDate() - 7);
  return { start, end };
}

export function isInRange(iso: string | null | undefined, start: Date, end: Date): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;
  return time >= start.getTime() && time <= end.getTime();
}

export function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function startOfWeekUtc(): Date {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
