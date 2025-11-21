use crate::models::{
    EnhancedColumnInfo, EnhancedDatabaseSchema, EnhancedTableInfo, ForeignKeyInfo, IndexInfo,
    RoutineInfo, ViewInfo,
};
use crate::constants::{WARNING_TYPE_DATA_LOSS, WARNING_TYPE_BREAKING_CHANGE, SQL_NULLABLE_YES};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "lowercase")]
pub enum DiffStatus {
    Identical,
    Modified,
    Added,
    Removed,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ColumnChange {
    pub column_name: String,
    pub status: DiffStatus,
    pub source_definition: Option<EnhancedColumnInfo>,
    pub target_definition: Option<EnhancedColumnInfo>,
    pub changes: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct IndexChange {
    pub index_name: String,
    pub status: DiffStatus,
    pub source_definition: Option<IndexInfo>,
    pub target_definition: Option<IndexInfo>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ForeignKeyChange {
    pub constraint_name: String,
    pub status: DiffStatus,
    pub source_definition: Option<ForeignKeyInfo>,
    pub target_definition: Option<ForeignKeyInfo>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TableDifference {
    pub table_name: String,
    pub status: DiffStatus,
    pub column_changes: Vec<ColumnChange>,
    pub index_changes: Vec<IndexChange>,
    pub fk_changes: Vec<ForeignKeyChange>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ViewChange {
    pub view_name: String,
    pub status: DiffStatus,
    pub source_definition: Option<String>,
    pub target_definition: Option<String>,
    pub definition_changed: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RoutineChange {
    pub routine_name: String,
    pub status: DiffStatus,
    pub source_definition: Option<RoutineInfo>,
    pub target_definition: Option<RoutineInfo>,
    pub definition_changed: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "lowercase")]
pub enum WarningSeverity {
    High,
    Medium,
    Low,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ComparisonWarning {
    pub severity: WarningSeverity,
    pub warning_type: String, // 'data_loss', 'locking', 'breaking_change', 'info'
    pub message: String,
    pub affected_object: String,
    pub details: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ComparisonSummary {
    pub tables_modified: usize,
    pub tables_added: usize,
    pub tables_removed: usize,
    pub indexes_missing: usize,
    pub views_changed: usize,
    pub routines_changed: usize,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SchemaComparison {
    pub source_connection: String,
    pub target_connection: String,
    pub summary: ComparisonSummary,
    pub table_differences: Vec<TableDifference>,
    pub view_differences: Vec<ViewChange>,
    pub routine_differences: Vec<RoutineChange>,
    pub warnings: Vec<ComparisonWarning>,
}

// Compare two enhanced database schemas
pub fn compare_schemas(
    source: &EnhancedDatabaseSchema,
    target: &EnhancedDatabaseSchema,
    source_connection: String,
    target_connection: String,
) -> SchemaComparison {
    let table_differences = compare_tables(&source.tables, &target.tables);
    let view_differences = compare_views(&source.views, &target.views);
    let routine_differences = compare_routines(&source.routines, &target.routines);
    let warnings = generate_warnings(&table_differences, &view_differences, &routine_differences);

    let summary = ComparisonSummary {
        tables_modified: table_differences
            .iter()
            .filter(|t| matches!(t.status, DiffStatus::Modified))
            .count(),
        tables_added: table_differences
            .iter()
            .filter(|t| matches!(t.status, DiffStatus::Added))
            .count(),
        tables_removed: table_differences
            .iter()
            .filter(|t| matches!(t.status, DiffStatus::Removed))
            .count(),
        indexes_missing: table_differences
            .iter()
            .flat_map(|t| &t.index_changes)
            .filter(|i| matches!(i.status, DiffStatus::Added | DiffStatus::Removed))
            .count(),
        views_changed: view_differences
            .iter()
            .filter(|v| matches!(v.status, DiffStatus::Modified | DiffStatus::Added | DiffStatus::Removed))
            .count(),
        routines_changed: routine_differences
            .iter()
            .filter(|r| matches!(r.status, DiffStatus::Modified | DiffStatus::Added | DiffStatus::Removed))
            .count(),
    };

    SchemaComparison {
        source_connection,
        target_connection,
        summary,
        table_differences,
        view_differences,
        routine_differences,
        warnings,
    }
}

// Compare tables
fn compare_tables(
    source_tables: &[EnhancedTableInfo],
    target_tables: &[EnhancedTableInfo],
) -> Vec<TableDifference> {
    let mut differences = Vec::new();

    // Create maps for quick lookup
    let source_map: HashMap<String, &EnhancedTableInfo> = source_tables
        .iter()
        .map(|t| (t.table_name.clone(), t))
        .collect();

    let target_map: HashMap<String, &EnhancedTableInfo> = target_tables
        .iter()
        .map(|t| (t.table_name.clone(), t))
        .collect();

    // All unique table names
    let mut all_table_names: HashSet<String> = HashSet::new();
    all_table_names.extend(source_map.keys().cloned());
    all_table_names.extend(target_map.keys().cloned());

    for table_name in all_table_names {
        let source_table = source_map.get(&table_name);
        let target_table = target_map.get(&table_name);

        let (status, column_changes, index_changes, fk_changes) = match (source_table, target_table) {
            (Some(src), Some(tgt)) => {
                // Table exists in both - check for modifications
                let col_changes = compare_columns(&src.columns, &tgt.columns);
                let idx_changes = compare_indexes(&src.indexes, &tgt.indexes);
                let fk_changes = compare_foreign_keys(&src.foreign_keys, &tgt.foreign_keys);

                let is_modified = !col_changes.is_empty() || !idx_changes.is_empty() || !fk_changes.is_empty();

                (
                    if is_modified {
                        DiffStatus::Modified
                    } else {
                        DiffStatus::Identical
                    },
                    col_changes,
                    idx_changes,
                    fk_changes,
                )
            }
            (Some(_), None) => {
                // Table only in source (will be added to target)
                (DiffStatus::Added, vec![], vec![], vec![])
            }
            (None, Some(_)) => {
                // Table only in target (will be removed from target)
                (DiffStatus::Removed, vec![], vec![], vec![])
            }
            (None, None) => unreachable!(),
        };

        differences.push(TableDifference {
            table_name,
            status,
            column_changes,
            index_changes,
            fk_changes,
        });
    }

    differences
}

// Compare columns
fn compare_columns(
    source_cols: &[EnhancedColumnInfo],
    target_cols: &[EnhancedColumnInfo],
) -> Vec<ColumnChange> {
    let mut changes = Vec::new();

    let source_map: HashMap<String, &EnhancedColumnInfo> = source_cols
        .iter()
        .map(|c| (c.column_name.clone(), c))
        .collect();

    let target_map: HashMap<String, &EnhancedColumnInfo> = target_cols
        .iter()
        .map(|c| (c.column_name.clone(), c))
        .collect();

    let mut all_columns: HashSet<String> = HashSet::new();
    all_columns.extend(source_map.keys().cloned());
    all_columns.extend(target_map.keys().cloned());

    for col_name in all_columns {
        let source_col = source_map.get(&col_name);
        let target_col = target_map.get(&col_name);

        let (status, change_details) = match (source_col, target_col) {
            (Some(src), Some(tgt)) => {
                let mut details = Vec::new();

                // Check for differences
                if src.data_type != tgt.data_type {
                    details.push(format!("type: {} → {}", tgt.data_type, src.data_type));
                }
                if src.is_nullable != tgt.is_nullable {
                    details.push(format!(
                        "nullable: {} → {}",
                        tgt.is_nullable, src.is_nullable
                    ));
                }
                if src.column_default != tgt.column_default {
                    details.push(format!(
                        "default: {:?} → {:?}",
                        tgt.column_default, src.column_default
                    ));
                }
                if src.character_maximum_length != tgt.character_maximum_length {
                    details.push(format!(
                        "max_length: {:?} → {:?}",
                        tgt.character_maximum_length, src.character_maximum_length
                    ));
                }

                let status = if details.is_empty() {
                    DiffStatus::Identical
                } else {
                    DiffStatus::Modified
                };

                (status, details)
            }
            (Some(_), None) => (DiffStatus::Added, vec![]),
            (None, Some(_)) => (DiffStatus::Removed, vec![]),
            (None, None) => unreachable!(),
        };

        changes.push(ColumnChange {
            column_name: col_name,
            status,
            source_definition: source_col.cloned().cloned(),
            target_definition: target_col.cloned().cloned(),
            changes: change_details,
        });
    }

    changes
}

// Compare indexes
fn compare_indexes(source_indexes: &[IndexInfo], target_indexes: &[IndexInfo]) -> Vec<IndexChange> {
    let mut changes = Vec::new();

    let source_map: HashMap<String, &IndexInfo> = source_indexes
        .iter()
        .map(|i| (i.index_name.clone(), i))
        .collect();

    let target_map: HashMap<String, &IndexInfo> = target_indexes
        .iter()
        .map(|i| (i.index_name.clone(), i))
        .collect();

    let mut all_indexes: HashSet<String> = HashSet::new();
    all_indexes.extend(source_map.keys().cloned());
    all_indexes.extend(target_map.keys().cloned());

    for index_name in all_indexes {
        let source_idx = source_map.get(&index_name);
        let target_idx = target_map.get(&index_name);

        let status = match (source_idx, target_idx) {
            (Some(src), Some(tgt)) => {
                // Check if index definition changed
                if src.definition != tgt.definition
                    || src.columns != tgt.columns
                    || src.is_unique != tgt.is_unique
                {
                    DiffStatus::Modified
                } else {
                    DiffStatus::Identical
                }
            }
            (Some(_), None) => DiffStatus::Added,
            (None, Some(_)) => DiffStatus::Removed,
            (None, None) => unreachable!(),
        };

        changes.push(IndexChange {
            index_name,
            status,
            source_definition: source_idx.cloned().cloned(),
            target_definition: target_idx.cloned().cloned(),
        });
    }

    changes
}

// Compare foreign keys
fn compare_foreign_keys(
    source_fks: &[ForeignKeyInfo],
    target_fks: &[ForeignKeyInfo],
) -> Vec<ForeignKeyChange> {
    let mut changes = Vec::new();

    let source_map: HashMap<String, &ForeignKeyInfo> = source_fks
        .iter()
        .map(|fk| (fk.constraint_name.clone(), fk))
        .collect();

    let target_map: HashMap<String, &ForeignKeyInfo> = target_fks
        .iter()
        .map(|fk| (fk.constraint_name.clone(), fk))
        .collect();

    let mut all_fks: HashSet<String> = HashSet::new();
    all_fks.extend(source_map.keys().cloned());
    all_fks.extend(target_map.keys().cloned());

    for fk_name in all_fks {
        let source_fk = source_map.get(&fk_name);
        let target_fk = target_map.get(&fk_name);

        let status = match (source_fk, target_fk) {
            (Some(src), Some(tgt)) => {
                if src.column_name != tgt.column_name
                    || src.foreign_table_name != tgt.foreign_table_name
                    || src.foreign_column_name != tgt.foreign_column_name
                {
                    DiffStatus::Modified
                } else {
                    DiffStatus::Identical
                }
            }
            (Some(_), None) => DiffStatus::Added,
            (None, Some(_)) => DiffStatus::Removed,
            (None, None) => unreachable!(),
        };

        changes.push(ForeignKeyChange {
            constraint_name: fk_name,
            status,
            source_definition: source_fk.cloned().cloned(),
            target_definition: target_fk.cloned().cloned(),
        });
    }

    changes
}

// Compare views
fn compare_views(source_views: &[ViewInfo], target_views: &[ViewInfo]) -> Vec<ViewChange> {
    let mut changes = Vec::new();

    let source_map: HashMap<String, &ViewInfo> = source_views
        .iter()
        .map(|v| (v.view_name.clone(), v))
        .collect();

    let target_map: HashMap<String, &ViewInfo> = target_views
        .iter()
        .map(|v| (v.view_name.clone(), v))
        .collect();

    let mut all_views: HashSet<String> = HashSet::new();
    all_views.extend(source_map.keys().cloned());
    all_views.extend(target_map.keys().cloned());

    for view_name in all_views {
        let source_view = source_map.get(&view_name);
        let target_view = target_map.get(&view_name);

        let (status, definition_changed) = match (source_view, target_view) {
            (Some(src), Some(tgt)) => {
                let changed = src.definition.trim() != tgt.definition.trim();
                (
                    if changed {
                        DiffStatus::Modified
                    } else {
                        DiffStatus::Identical
                    },
                    changed,
                )
            }
            (Some(_), None) => (DiffStatus::Added, false),
            (None, Some(_)) => (DiffStatus::Removed, false),
            (None, None) => unreachable!(),
        };

        changes.push(ViewChange {
            view_name,
            status,
            source_definition: source_view.map(|v| v.definition.clone()),
            target_definition: target_view.map(|v| v.definition.clone()),
            definition_changed,
        });
    }

    changes
}

// Compare routines
fn compare_routines(
    source_routines: &[RoutineInfo],
    target_routines: &[RoutineInfo],
) -> Vec<RoutineChange> {
    let mut changes = Vec::new();

    let source_map: HashMap<String, &RoutineInfo> = source_routines
        .iter()
        .map(|r| (r.routine_name.clone(), r))
        .collect();

    let target_map: HashMap<String, &RoutineInfo> = target_routines
        .iter()
        .map(|r| (r.routine_name.clone(), r))
        .collect();

    let mut all_routines: HashSet<String> = HashSet::new();
    all_routines.extend(source_map.keys().cloned());
    all_routines.extend(target_map.keys().cloned());

    for routine_name in all_routines {
        let source_routine = source_map.get(&routine_name);
        let target_routine = target_map.get(&routine_name);

        let (status, definition_changed) = match (source_routine, target_routine) {
            (Some(src), Some(tgt)) => {
                let changed = src.definition != tgt.definition
                    || src.routine_type != tgt.routine_type
                    || src.return_type != tgt.return_type;
                (
                    if changed {
                        DiffStatus::Modified
                    } else {
                        DiffStatus::Identical
                    },
                    changed,
                )
            }
            (Some(_), None) => (DiffStatus::Added, false),
            (None, Some(_)) => (DiffStatus::Removed, false),
            (None, None) => unreachable!(),
        };

        changes.push(RoutineChange {
            routine_name,
            status,
            source_definition: source_routine.cloned().cloned(),
            target_definition: target_routine.cloned().cloned(),
            definition_changed,
        });
    }

    changes
}

// Generate warnings based on detected changes
fn generate_warnings(
    table_diffs: &[TableDifference],
    _view_diffs: &[ViewChange],
    _routine_diffs: &[RoutineChange],
) -> Vec<ComparisonWarning> {
    let mut warnings = Vec::new();

    for table_diff in table_diffs {
        // Warn about dropped tables
        if matches!(table_diff.status, DiffStatus::Removed) {
            warnings.push(ComparisonWarning {
                severity: WarningSeverity::High,
                warning_type: WARNING_TYPE_DATA_LOSS.to_string(),
                message: format!("Dropping table '{}' will result in data loss", table_diff.table_name),
                affected_object: table_diff.table_name.clone(),
                details: Some("Consider backing up data before proceeding".to_string()),
            });
        }

        // Warn about dropped columns
        for col_change in &table_diff.column_changes {
            if matches!(col_change.status, DiffStatus::Removed) {
                warnings.push(ComparisonWarning {
                    severity: WarningSeverity::High,
                    warning_type: WARNING_TYPE_DATA_LOSS.to_string(),
                    message: format!(
                        "Dropping column '{}.{}' will result in data loss",
                        table_diff.table_name, col_change.column_name
                    ),
                    affected_object: format!("{}.{}", table_diff.table_name, col_change.column_name),
                    details: Some("Consider backing up column data first".to_string()),
                });
            }

            // Warn about type changes
            if matches!(col_change.status, DiffStatus::Modified) {
                if col_change.changes.iter().any(|c| c.starts_with("type:")) {
                    warnings.push(ComparisonWarning {
                        severity: WarningSeverity::Medium,
                        warning_type: WARNING_TYPE_BREAKING_CHANGE.to_string(),
                        message: format!(
                            "Changing data type for column '{}.{}' may cause issues",
                            table_diff.table_name, col_change.column_name
                        ),
                        affected_object: format!("{}.{}", table_diff.table_name, col_change.column_name),
                        details: Some("Ensure data is compatible with new type".to_string()),
                    });
                }
            }
        }
    }

    warnings
}

/// Generate PostgreSQL migration script from schema comparison
pub fn generate_migration_script(comparison: &SchemaComparison) -> String {
    let mut script = String::new();
    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");

    // Header
    script.push_str(&format!(
        "-- ============================================\n\
         -- Schema Migration Script\n\
         -- Source: {}\n\
         -- Target: {}\n\
         -- Generated: {}\n\
         -- ============================================\n\n",
        comparison.source_connection, comparison.target_connection, timestamp
    ));

    script.push_str(
        "-- WARNING: This script will make changes to the target database!\n\
         -- Review carefully before executing.\n\n",
    );

    let mut has_changes = false;

    // Table modifications
    let modified_tables: Vec<_> = comparison
        .table_differences
        .iter()
        .filter(|t| matches!(t.status, DiffStatus::Modified))
        .collect();

    if !modified_tables.is_empty() {
        has_changes = true;
        script.push_str(
            "-- ============================================\n\
             -- TABLE MODIFICATIONS\n\
             -- ============================================\n\n",
        );

        for table_diff in modified_tables {
            script.push_str(&format!("-- Modify table: {}\n", table_diff.table_name));

            // Column changes
            for col_change in &table_diff.column_changes {
                match col_change.status {
                    DiffStatus::Added => {
                        if let Some(target_def) = &col_change.target_definition {
                            let nullable = if target_def.is_nullable == SQL_NULLABLE_YES {
                                "NULL"
                            } else {
                                "NOT NULL"
                            };
                            let default = target_def
                                .column_default
                                .as_ref()
                                .map(|d| format!(" DEFAULT {}", d))
                                .unwrap_or_default();
                            script.push_str(&format!(
                                "ALTER TABLE {} ADD COLUMN {} {} {}{};\n",
                                table_diff.table_name,
                                col_change.column_name,
                                target_def.data_type,
                                nullable,
                                default
                            ));
                        }
                    }
                    DiffStatus::Removed => {
                        script.push_str(&format!(
                            "-- WARNING: Dropping column will cause data loss!\n\
                             ALTER TABLE {} DROP COLUMN {};\n",
                            table_diff.table_name, col_change.column_name
                        ));
                    }
                    DiffStatus::Modified => {
                        if let Some(target_def) = &col_change.target_definition {
                            // Type changes
                            if col_change.changes.iter().any(|c| c.starts_with("type:")) {
                                script.push_str(&format!(
                                    "ALTER TABLE {} ALTER COLUMN {} TYPE {};\n",
                                    table_diff.table_name, col_change.column_name, target_def.data_type
                                ));
                            }

                            // Nullable changes
                            if col_change
                                .changes
                                .iter()
                                .any(|c| c.starts_with("nullable:"))
                            {
                                let nullable_clause = if target_def.is_nullable == SQL_NULLABLE_YES {
                                    "DROP NOT NULL"
                                } else {
                                    "SET NOT NULL"
                                };
                                script.push_str(&format!(
                                    "ALTER TABLE {} ALTER COLUMN {} {};\n",
                                    table_diff.table_name, col_change.column_name, nullable_clause
                                ));
                            }

                            // Default changes
                            if col_change
                                .changes
                                .iter()
                                .any(|c| c.starts_with("default:"))
                            {
                                if let Some(default_val) = &target_def.column_default {
                                    script.push_str(&format!(
                                        "ALTER TABLE {} ALTER COLUMN {} SET DEFAULT {};\n",
                                        table_diff.table_name, col_change.column_name, default_val
                                    ));
                                } else {
                                    script.push_str(&format!(
                                        "ALTER TABLE {} ALTER COLUMN {} DROP DEFAULT;\n",
                                        table_diff.table_name, col_change.column_name
                                    ));
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }

            // Index changes
            for idx_change in &table_diff.index_changes {
                match idx_change.status {
                    DiffStatus::Added => {
                        if let Some(idx_info) = &idx_change.target_definition {
                            script.push_str(&format!("{};\n", idx_info.definition));
                        }
                    }
                    DiffStatus::Removed => {
                        script.push_str(&format!("DROP INDEX IF EXISTS {};\n", idx_change.index_name));
                    }
                    DiffStatus::Modified => {
                        // Drop and recreate
                        script.push_str(&format!("DROP INDEX IF EXISTS {};\n", idx_change.index_name));
                        if let Some(idx_info) = &idx_change.target_definition {
                            script.push_str(&format!("{};\n", idx_info.definition));
                        }
                    }
                    _ => {}
                }
            }

            // Foreign key changes
            for fk_change in &table_diff.fk_changes {
                match fk_change.status {
                    DiffStatus::Added => {
                        if let Some(target_fk) = &fk_change.target_definition {
                            script.push_str(&format!(
                                "ALTER TABLE {} ADD CONSTRAINT {} FOREIGN KEY ({}) REFERENCES {} ({});\n",
                                target_fk.table_name,
                                fk_change.constraint_name,
                                target_fk.column_name,
                                target_fk.foreign_table_name,
                                target_fk.foreign_column_name
                            ));
                        }
                    }
                    DiffStatus::Removed => {
                        if let Some(source_fk) = &fk_change.source_definition {
                            script.push_str(&format!(
                                "ALTER TABLE {} DROP CONSTRAINT IF EXISTS {};\n",
                                source_fk.table_name, fk_change.constraint_name
                            ));
                        }
                    }
                    DiffStatus::Modified => {
                        // Drop and recreate
                        if let Some(source_fk) = &fk_change.source_definition {
                            script.push_str(&format!(
                                "ALTER TABLE {} DROP CONSTRAINT IF EXISTS {};\n",
                                source_fk.table_name, fk_change.constraint_name
                            ));
                        }
                        if let Some(target_fk) = &fk_change.target_definition {
                            script.push_str(&format!(
                                "ALTER TABLE {} ADD CONSTRAINT {} FOREIGN KEY ({}) REFERENCES {} ({});\n",
                                target_fk.table_name,
                                fk_change.constraint_name,
                                target_fk.column_name,
                                target_fk.foreign_table_name,
                                target_fk.foreign_column_name
                            ));
                        }
                    }
                    _ => {}
                }
            }

            script.push('\n');
        }
    }

    // New tables
    let new_tables: Vec<_> = comparison
        .table_differences
        .iter()
        .filter(|t| matches!(t.status, DiffStatus::Added))
        .collect();

    if !new_tables.is_empty() {
        has_changes = true;
        script.push_str(
            "-- ============================================\n\
             -- NEW TABLES\n\
             -- ============================================\n\n",
        );

        for table_diff in new_tables {
            script.push_str(&format!("-- Create table: {}\n", table_diff.table_name));
            script.push_str(&format!("CREATE TABLE {} (\n", table_diff.table_name));

            let columns: Vec<String> = table_diff
                .column_changes
                .iter()
                .filter_map(|col| {
                    if let Some(target_def) = &col.target_definition {
                        let nullable = if target_def.is_nullable == SQL_NULLABLE_YES {
                            "NULL"
                        } else {
                            "NOT NULL"
                        };
                        let default = target_def
                            .column_default
                            .as_ref()
                            .map(|d| format!(" DEFAULT {}", d))
                            .unwrap_or_default();
                        let pk = if target_def.is_primary_key {
                            " PRIMARY KEY"
                        } else {
                            ""
                        };
                        Some(format!(
                            "  {} {} {}{}{}",
                            col.column_name, target_def.data_type, nullable, default, pk
                        ))
                    } else {
                        None
                    }
                })
                .collect();

            script.push_str(&columns.join(",\n"));
            script.push_str("\n);\n\n");

            // Indexes for new table
            for idx_change in &table_diff.index_changes {
                if let Some(idx_info) = &idx_change.target_definition {
                    script.push_str(&format!("{};\n", idx_info.definition));
                }
            }

            // Foreign keys for new table
            for fk_change in &table_diff.fk_changes {
                if let Some(target_fk) = &fk_change.target_definition {
                    script.push_str(&format!(
                        "ALTER TABLE {} ADD CONSTRAINT {} FOREIGN KEY ({}) REFERENCES {} ({});\n",
                        target_fk.table_name,
                        fk_change.constraint_name,
                        target_fk.column_name,
                        target_fk.foreign_table_name,
                        target_fk.foreign_column_name
                    ));
                }
            }

            script.push('\n');
        }
    }

    // Dropped tables
    let dropped_tables: Vec<_> = comparison
        .table_differences
        .iter()
        .filter(|t| matches!(t.status, DiffStatus::Removed))
        .collect();

    if !dropped_tables.is_empty() {
        has_changes = true;
        script.push_str(
            "-- ============================================\n\
             -- DROPPED TABLES\n\
             -- ============================================\n\n",
        );

        for table_diff in dropped_tables {
            script.push_str(&format!(
                "-- WARNING: Dropping table will cause data loss!\n\
                 DROP TABLE IF EXISTS {} CASCADE;\n\n",
                table_diff.table_name
            ));
        }
    }

    // View changes
    let view_changes: Vec<_> = comparison
        .view_differences
        .iter()
        .filter(|v| !matches!(v.status, DiffStatus::Identical))
        .collect();

    if !view_changes.is_empty() {
        has_changes = true;
        script.push_str(
            "-- ============================================\n\
             -- VIEWS\n\
             -- ============================================\n\n",
        );

        for view_change in view_changes {
            match view_change.status {
                DiffStatus::Added | DiffStatus::Modified => {
                    script.push_str(&format!("DROP VIEW IF EXISTS {};\n\n", view_change.view_name));
                    if let Some(def) = &view_change.target_definition {
                        script.push_str(&format!("CREATE VIEW {} AS\n{};\n\n", view_change.view_name, def));
                    }
                }
                DiffStatus::Removed => {
                    script.push_str(&format!("DROP VIEW IF EXISTS {};\n\n", view_change.view_name));
                }
                _ => {}
            }
        }
    }

    // Routine changes
    let routine_changes: Vec<_> = comparison
        .routine_differences
        .iter()
        .filter(|r| !matches!(r.status, DiffStatus::Identical))
        .collect();

    if !routine_changes.is_empty() {
        has_changes = true;
        script.push_str(
            "-- ============================================\n\
             -- FUNCTIONS/PROCEDURES\n\
             -- ============================================\n\n",
        );

        for routine_change in routine_changes {
            match routine_change.status {
                DiffStatus::Added | DiffStatus::Modified => {
                    script.push_str(&format!(
                        "DROP FUNCTION IF EXISTS {} CASCADE;\n\n",
                        routine_change.routine_name
                    ));
                    if let Some(routine_info) = &routine_change.target_definition {
                        if let Some(def) = &routine_info.definition {
                            script.push_str(&format!("{};\n\n", def));
                        }
                    }
                }
                DiffStatus::Removed => {
                    script.push_str(&format!(
                        "DROP FUNCTION IF EXISTS {} CASCADE;\n\n",
                        routine_change.routine_name
                    ));
                }
                _ => {}
            }
        }
    }

    // Footer
    script.push_str("-- ============================================\n");
    script.push_str("-- END OF MIGRATION SCRIPT\n");

    if !has_changes {
        script.push_str("-- No changes detected.\n");
    } else {
        let total_changes = comparison.summary.tables_added
            + comparison.summary.tables_removed
            + comparison.summary.tables_modified
            + comparison.summary.views_changed
            + comparison.summary.routines_changed;

        script.push_str(&format!("-- Total affected objects: {}\n", total_changes));

        if !comparison.warnings.is_empty() {
            script.push_str(&format!("-- Warnings: {}\n", comparison.warnings.len()));
        }
    }

    script.push_str("-- ============================================\n");

    script
}
