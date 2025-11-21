import type { DiffStatus, WarningSeverity } from "../types";

// Diff Status Constants
export const DIFF_STATUS = {
  IDENTICAL: 'identical' as DiffStatus,
  MODIFIED: 'modified' as DiffStatus,
  ADDED: 'added' as DiffStatus,
  REMOVED: 'removed' as DiffStatus,
} as const;

// Warning Severity Constants
export const WARNING_SEVERITY = {
  HIGH: 'high' as WarningSeverity,
  MEDIUM: 'medium' as WarningSeverity,
  LOW: 'low' as WarningSeverity,
} as const;
