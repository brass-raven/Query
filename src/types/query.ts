export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  row_count: number;
  execution_time_ms: number;
}

export interface QueryHistoryEntry {
  id: number;
  query: string;
  connection_name: string;
  execution_time_ms: number;
  row_count: number;
  executed_at: string;
}

export interface SavedQuery {
  id: number;
  name: string;
  query: string;
  description: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}
