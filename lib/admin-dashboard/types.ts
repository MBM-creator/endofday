import type { QaType } from '@/lib/qa-run-bundle';

export type DashboardDateRange = 'today' | '7d' | '30d';

export type DashboardStatusFilter =
  | 'all'
  | 'active'
  | 'blocked'
  | 'needs_review'
  | 'complete'
  | 'missing_evidence';

export type DashboardFilters = {
  qaType: QaType | 'all';
  supervisorId: string | 'all';
  status: DashboardStatusFilter;
  range: DashboardDateRange;
  search: string;
};

export type DashboardSummaryCards = {
  activeQaRuns: number;
  jobsNeedingAttention: number;
  unresolvedQaIssues: number;
  sectionsAwaitingReview: number;
  jobsMissingEvidence: number;
  completedQaRunsThisWeek: number;
  supervisorsActiveToday: number;
  supervisorsActiveThisWeek: number;
};

export type SupervisorActivityStatus = 'good' | 'behind' | 'no_activity' | 'needs_review';

export type SupervisorActivityRow = {
  staffId: string;
  name: string;
  email: string;
  activeAssignedJobs: number | null;
  qaRunsTouchedToday: number;
  qaRunsTouchedInRange: number;
  sectionsSubmittedInRange: number;
  sectionsClearedInRange: number;
  openIssuesCount: number;
  lastQaActivityAt: string | null;
  photoCountInRange: number;
  status: SupervisorActivityStatus;
};

export type JobAttentionUrgency =
  | 'blocked_by_issue'
  | 'submitted_not_cleared'
  | 'missing_evidence'
  | 'stale_activity'
  | 'possible_missing_run';

export type JobAttentionRow = {
  jobId: string;
  jobName: string;
  clientName: string | null;
  projectTitle: string | null;
  activeStageName: string | null;
  qaType: QaType | null;
  qaTypeLabel: string;
  runId: string | null;
  runStatus: string | null;
  currentSectionStatus: string | null;
  currentSectionTitle: string | null;
  supervisorName: string | null;
  supervisorStaffId: string | null;
  lastActivityAt: string | null;
  issueCount: number;
  missingEvidenceCount: number;
  urgency: JobAttentionUrgency;
  urgencyLabel: string;
  links: {
    job: string;
    qaRun: string | null;
    evidence: string | null;
    supervisor: string | null;
    notes: string | null;
  };
};

export type ActivityFeedKind =
  | 'section_submitted'
  | 'issue_raised'
  | 'issue_rectified'
  | 'supervisor_approved'
  | 'photo_uploaded'
  | 'final_approval';

export type ActivityFeedItem = {
  id: string;
  kind: ActivityFeedKind;
  label: string;
  actorName: string | null;
  jobId: string;
  jobName: string;
  runId: string | null;
  sectionCode: string | null;
  sectionTitle: string | null;
  timestamp: string;
  href: string;
};

export type AdminDashboardData = {
  filters: DashboardFilters;
  rangeStart: string;
  rangeEnd: string;
  cards: DashboardSummaryCards;
  supervisorActivityLabel: string;
  supervisors: SupervisorActivityRow[];
  jobsNeedingAttention: JobAttentionRow[];
  activityFeed: ActivityFeedItem[];
};
