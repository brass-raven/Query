export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  is_primary_key: boolean;
}

export interface ForeignKeyInfo {
  constraint_name: string;
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

export interface TableInfo {
  table_name: string;
  columns: ColumnInfo[];
  foreign_keys: ForeignKeyInfo[];
}

export interface DatabaseSchema {
  tables: TableInfo[];
}

export interface ConnectionConfig {
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  readOnly?: boolean;
}

// Enhanced schema types for schema comparison feature

export interface IndexInfo {
  index_name: string;
  table_name: string;
  columns: string[];
  is_unique: boolean;
  is_primary: boolean;
  definition: string;
}

export interface ViewInfo {
  view_name: string;
  definition: string;
}

export interface RoutineInfo {
  routine_name: string;
  routine_type: string; // 'FUNCTION' or 'PROCEDURE'
  definition?: string;
  return_type?: string;
}

export interface EnhancedColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  is_primary_key: boolean;
  column_default?: string;
  character_maximum_length?: number;
  numeric_precision?: number;
  numeric_scale?: number;
  ordinal_position: number;
}

export interface EnhancedTableInfo {
  table_name: string;
  columns: EnhancedColumnInfo[];
  foreign_keys: ForeignKeyInfo[];
  indexes: IndexInfo[];
}

export interface EnhancedDatabaseSchema {
  tables: EnhancedTableInfo[];
  views: ViewInfo[];
  routines: RoutineInfo[];
}

// Schema comparison types

export type DiffStatus = 'identical' | 'modified' | 'added' | 'removed';

export type WarningSeverity = 'high' | 'medium' | 'low';

export interface ColumnChange {
  column_name: string;
  status: DiffStatus;
  source_definition?: EnhancedColumnInfo;
  target_definition?: EnhancedColumnInfo;
  changes: string[]; // e.g., ["type: VARCHAR(100) → VARCHAR(255)"]
}

export interface IndexChange {
  index_name: string;
  status: DiffStatus;
  source_definition?: string;
  target_definition?: string;
}

export interface ForeignKeyChange {
  constraint_name: string;
  status: DiffStatus;
  source_definition?: ForeignKeyInfo;
  target_definition?: ForeignKeyInfo;
}

export interface TableDifference {
  table_name: string;
  status: DiffStatus;
  column_changes: ColumnChange[];
  index_changes: IndexChange[];
  fk_changes: ForeignKeyChange[];
}

export interface ViewChange {
  view_name: string;
  status: DiffStatus;
  source_definition?: string;
  target_definition?: string;
  definition_changed: boolean;
}

export interface RoutineChange {
  routine_name: string;
  status: DiffStatus;
  source_definition?: string;
  target_definition?: string;
  definition_changed: boolean;
}

export interface ComparisonWarning {
  severity: WarningSeverity;
  warning_type: string; // 'data_loss', 'locking', 'breaking_change', 'info'
  message: string;
  affected_object: string;
  details?: string;
}

export interface ComparisonSummary {
  tables_modified: number;
  tables_added: number;
  tables_removed: number;
  indexes_missing: number;
  views_changed: number;
  routines_changed: number;
}

export interface SchemaComparison {
  source_connection: string;
  target_connection: string;
  summary: ComparisonSummary;
  table_differences: TableDifference[];
  view_differences: ViewChange[];
  routine_differences: RoutineChange[];
  warnings: ComparisonWarning[];
}
