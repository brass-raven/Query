use crate::models::{
    ColumnInfo, ConnectionConfig, DatabaseSchema, ForeignKeyInfo, QueryResult, TableInfo,
    EnhancedColumnInfo, EnhancedDatabaseSchema, EnhancedTableInfo, IndexInfo, RoutineInfo, ViewInfo,
};
use sqlx::postgres::PgPool;
use sqlx::{Column, Row};

#[tauri::command]
pub async fn test_postgres_connection(config: ConnectionConfig) -> Result<String, String> {
    let connection_string = format!(
        "postgres://{}:{}@{}:{}/{}",
        config.username, config.password, config.host, config.port, config.database
    );

    let pool = PgPool::connect(&connection_string)
        .await
        .map_err(|e| format!("Error connecting to database: {}", e))?;

    pool.close().await;

    Ok(format!(
        "Successfully connected to {}:{}/{}",
        config.host, config.port, config.database
    ))
}

#[tauri::command]
pub async fn execute_query(
    config: ConnectionConfig,
    query: String,
) -> Result<QueryResult, String> {
    // Read-only mode validation
    if config.read_only {
        let trimmed_query = query.trim().to_uppercase();
        let allowed_commands = ["SELECT", "DESCRIBE", "DESC", "SHOW", "EXPLAIN"];
        let is_allowed = allowed_commands.iter().any(|cmd| trimmed_query.starts_with(cmd));

        if !is_allowed {
            return Err(
                "Read-only mode: Only SELECT, DESCRIBE, DESC, SHOW, and EXPLAIN queries are allowed"
                    .to_string(),
            );
        }
    }

    let start = std::time::Instant::now();

    let connection_string = format!(
        "postgres://{}:{}@{}:{}/{}",
        config.username, config.password, config.host, config.port, config.database
    );

    let pool = PgPool::connect(&connection_string)
        .await
        .map_err(|e| format!("Error connecting to database: {}", e))?;

    let rows = sqlx::query(&query)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Error executing query: {}", e))?;

    pool.close().await;

    // Extract column names
    let mut columns = Vec::new();
    if let Some(first_row) = rows.first() {
        for column in first_row.columns() {
            columns.push(column.name().to_string());
        }
    }

    // Convert rows to JSON
    let mut result_rows = Vec::new();
    for row in rows.iter() {
        let mut result_row = Vec::new();
        for (i, _column) in row.columns().iter().enumerate() {
            let value = if let Ok(v) = row.try_get::<String, _>(i) {
                serde_json::json!(v)
            } else if let Ok(v) = row.try_get::<i32, _>(i) {
                serde_json::json!(v)
            } else if let Ok(v) = row.try_get::<i64, _>(i) {
                serde_json::json!(v)
            } else if let Ok(v) = row.try_get::<bool, _>(i) {
                serde_json::json!(v)
            } else if let Ok(v) = row.try_get::<f64, _>(i) {
                serde_json::json!(v)
            } else {
                serde_json::Value::Null
            };
            result_row.push(value);
        }
        result_rows.push(result_row);
    }

    let execution_time_ms = start.elapsed().as_millis();
    let row_count = result_rows.len();

    Ok(QueryResult {
        columns,
        rows: result_rows,
        row_count,
        execution_time_ms,
    })
}

#[tauri::command]
pub async fn get_database_schema(
    config: ConnectionConfig,
    schema: Option<String>,
) -> Result<DatabaseSchema, String> {
    let connection_string = format!(
        "postgres://{}:{}@{}:{}/{}",
        config.username, config.password, config.host, config.port, config.database
    );

    let pool = PgPool::connect(&connection_string)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    let schema_name = schema.unwrap_or_else(|| "public".to_string());

    let table_rows = sqlx::query(
        "SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = $1
         AND table_type = 'BASE TABLE'
         ORDER BY table_name",
    )
    .bind(&schema_name)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Failed to fetch tables: {}", e))?;

    let mut tables = Vec::new();

    for table_row in table_rows {
        let table_name: String = table_row
            .try_get("table_name")
            .map_err(|e| format!("Failed to get table name: {}", e))?;

        // Get primary key columns for this table
        let pk_rows = sqlx::query(
            "SELECT kcu.column_name
             FROM information_schema.table_constraints tco
             JOIN information_schema.key_column_usage kcu
               ON kcu.constraint_name = tco.constraint_name
               AND kcu.constraint_schema = tco.constraint_schema
             WHERE tco.constraint_type = 'PRIMARY KEY'
               AND kcu.table_schema = $1
               AND kcu.table_name = $2
             ORDER BY kcu.ordinal_position",
        )
        .bind(&schema_name)
        .bind(&table_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Failed to fetch primary keys: {}", e))?;

        // Build a set of primary key column names for fast lookup
        let mut pk_columns = std::collections::HashSet::new();
        for pk_row in pk_rows {
            let pk_col: String = pk_row
                .try_get("column_name")
                .map_err(|e| format!("Failed to get pk column name: {}", e))?;
            pk_columns.insert(pk_col);
        }

        let column_rows = sqlx::query(
            "SELECT column_name, data_type, is_nullable
             FROM information_schema.columns
             WHERE table_schema = $1
             AND table_name = $2
             ORDER BY ordinal_position",
        )
        .bind(&schema_name)
        .bind(&table_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Failed to fetch columns: {}", e))?;

        let mut columns = Vec::new();
        for col_row in column_rows {
            let column_name: String = col_row
                .try_get("column_name")
                .map_err(|e| format!("Failed to get column name: {}", e))?;

            columns.push(ColumnInfo {
                column_name: column_name.clone(),
                data_type: col_row
                    .try_get("data_type")
                    .map_err(|e| format!("Failed to get data type: {}", e))?,
                is_nullable: col_row
                    .try_get("is_nullable")
                    .map_err(|e| format!("Failed to get is_nullable: {}", e))?,
                is_primary_key: pk_columns.contains(&column_name),
            });
        }

        // Get foreign keys for this table
        let fk_rows = sqlx::query(
            "SELECT
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
             FROM information_schema.table_constraints AS tc
             JOIN information_schema.key_column_usage AS kcu
               ON tc.constraint_name = kcu.constraint_name
               AND tc.table_schema = kcu.table_schema
             JOIN information_schema.constraint_column_usage AS ccu
               ON ccu.constraint_name = tc.constraint_name
               AND ccu.table_schema = tc.table_schema
             WHERE tc.constraint_type = 'FOREIGN KEY'
               AND tc.table_schema = $1
               AND tc.table_name = $2",
        )
        .bind(&schema_name)
        .bind(&table_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Failed to fetch foreign keys: {}", e))?;

        let mut foreign_keys = Vec::new();
        for fk_row in fk_rows {
            let constraint_name: String = fk_row
                .try_get("constraint_name")
                .map_err(|e| format!("Failed to get constraint name: {}", e))?;
            let column_name: String = fk_row
                .try_get("column_name")
                .map_err(|e| format!("Failed to get column name: {}", e))?;
            let foreign_table_name: String = fk_row
                .try_get("foreign_table_name")
                .map_err(|e| format!("Failed to get foreign table name: {}", e))?;
            let foreign_column_name: String = fk_row
                .try_get("foreign_column_name")
                .map_err(|e| format!("Failed to get foreign column name: {}", e))?;

            foreign_keys.push(ForeignKeyInfo {
                constraint_name,
                table_name: table_name.clone(),
                column_name,
                foreign_table_name,
                foreign_column_name,
            });
        }

        tables.push(TableInfo {
            table_name,
            columns,
            foreign_keys,
        });
    }

    pool.close().await;

    Ok(DatabaseSchema { tables })
}

#[tauri::command]
pub async fn get_database_schemas(config: ConnectionConfig) -> Result<Vec<String>, String> {
    let connection_string = format!(
        "postgres://{}:{}@{}:{}/{}",
        config.username, config.password, config.host, config.port, config.database
    );

    let pool = PgPool::connect(&connection_string)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    let schema_rows = sqlx::query(
        "SELECT schema_name
         FROM information_schema.schemata
         WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
         AND schema_name NOT LIKE 'pg_temp_%'
         AND schema_name NOT LIKE 'pg_toast_temp_%'
         ORDER BY schema_name",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Failed to fetch schemas: {}", e))?;

    let mut schemas = Vec::new();
    for row in schema_rows {
        let schema_name: String = row
            .try_get("schema_name")
            .map_err(|e| format!("Failed to get schema name: {}", e))?;
        schemas.push(schema_name);
    }

    pool.close().await;

    Ok(schemas)
}

#[tauri::command]
pub async fn get_enhanced_database_schema(
    config: ConnectionConfig,
    schema: Option<String>,
) -> Result<EnhancedDatabaseSchema, String> {
    let connection_string = format!(
        "postgres://{}:{}@{}:{}/{}",
        config.username, config.password, config.host, config.port, config.database
    );

    let pool = PgPool::connect(&connection_string)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    let schema_name = schema.unwrap_or_else(|| "public".to_string());

    // Fetch tables
    let table_rows = sqlx::query(
        "SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = $1
         AND table_type = 'BASE TABLE'
         ORDER BY table_name",
    )
    .bind(&schema_name)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Failed to fetch tables: {}", e))?;

    let mut tables = Vec::new();

    for table_row in table_rows {
        let table_name: String = table_row
            .try_get("table_name")
            .map_err(|e| format!("Failed to get table name: {}", e))?;

        // Get primary key columns for this table
        let pk_rows = sqlx::query(
            "SELECT kcu.column_name
             FROM information_schema.table_constraints tco
             JOIN information_schema.key_column_usage kcu
               ON kcu.constraint_name = tco.constraint_name
               AND kcu.constraint_schema = tco.constraint_schema
             WHERE tco.constraint_type = 'PRIMARY KEY'
               AND kcu.table_schema = $1
               AND kcu.table_name = $2
             ORDER BY kcu.ordinal_position",
        )
        .bind(&schema_name)
        .bind(&table_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Failed to fetch primary keys: {}", e))?;

        let mut pk_columns = std::collections::HashSet::new();
        for pk_row in pk_rows {
            let pk_col: String = pk_row
                .try_get("column_name")
                .map_err(|e| format!("Failed to get pk column name: {}", e))?;
            pk_columns.insert(pk_col);
        }

        // Fetch enhanced column information
        let column_rows = sqlx::query(
            "SELECT
                column_name,
                data_type,
                is_nullable,
                column_default,
                character_maximum_length,
                numeric_precision,
                numeric_scale,
                ordinal_position
             FROM information_schema.columns
             WHERE table_schema = $1
             AND table_name = $2
             ORDER BY ordinal_position",
        )
        .bind(&schema_name)
        .bind(&table_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Failed to fetch columns: {}", e))?;

        let mut columns = Vec::new();
        for col_row in column_rows {
            let column_name: String = col_row
                .try_get("column_name")
                .map_err(|e| format!("Failed to get column name: {}", e))?;

            columns.push(EnhancedColumnInfo {
                column_name: column_name.clone(),
                data_type: col_row
                    .try_get("data_type")
                    .map_err(|e| format!("Failed to get data type: {}", e))?,
                is_nullable: col_row
                    .try_get("is_nullable")
                    .map_err(|e| format!("Failed to get is_nullable: {}", e))?,
                is_primary_key: pk_columns.contains(&column_name),
                column_default: col_row.try_get("column_default").ok(),
                character_maximum_length: col_row.try_get("character_maximum_length").ok(),
                numeric_precision: col_row.try_get("numeric_precision").ok(),
                numeric_scale: col_row.try_get("numeric_scale").ok(),
                ordinal_position: col_row
                    .try_get("ordinal_position")
                    .map_err(|e| format!("Failed to get ordinal_position: {}", e))?,
            });
        }

        // Get foreign keys for this table
        let fk_rows = sqlx::query(
            "SELECT
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
             FROM information_schema.table_constraints AS tc
             JOIN information_schema.key_column_usage AS kcu
               ON tc.constraint_name = kcu.constraint_name
               AND tc.table_schema = kcu.table_schema
             JOIN information_schema.constraint_column_usage AS ccu
               ON ccu.constraint_name = tc.constraint_name
               AND ccu.table_schema = tc.table_schema
             WHERE tc.constraint_type = 'FOREIGN KEY'
               AND tc.table_schema = $1
               AND tc.table_name = $2",
        )
        .bind(&schema_name)
        .bind(&table_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Failed to fetch foreign keys: {}", e))?;

        let mut foreign_keys = Vec::new();
        for fk_row in fk_rows {
            foreign_keys.push(ForeignKeyInfo {
                constraint_name: fk_row
                    .try_get("constraint_name")
                    .map_err(|e| format!("Failed to get constraint name: {}", e))?,
                table_name: table_name.clone(),
                column_name: fk_row
                    .try_get("column_name")
                    .map_err(|e| format!("Failed to get column name: {}", e))?,
                foreign_table_name: fk_row
                    .try_get("foreign_table_name")
                    .map_err(|e| format!("Failed to get foreign table name: {}", e))?,
                foreign_column_name: fk_row
                    .try_get("foreign_column_name")
                    .map_err(|e| format!("Failed to get foreign column name: {}", e))?,
            });
        }

        // Fetch indexes for this table
        let index_rows = sqlx::query(
            "SELECT
                i.indexname AS index_name,
                i.tablename AS table_name,
                idx.indisunique AS is_unique,
                idx.indisprimary AS is_primary,
                pg_get_indexdef(idx.indexrelid) AS definition
             FROM pg_indexes i
             JOIN pg_class c ON c.relname = i.indexname
             JOIN pg_index idx ON idx.indexrelid = c.oid
             WHERE i.schemaname = $1
               AND i.tablename = $2
             ORDER BY i.indexname",
        )
        .bind(&schema_name)
        .bind(&table_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Failed to fetch indexes: {}", e))?;

        let mut indexes = Vec::new();
        for idx_row in index_rows {
            let index_name: String = idx_row
                .try_get("index_name")
                .map_err(|e| format!("Failed to get index name: {}", e))?;
            let definition: String = idx_row
                .try_get("definition")
                .map_err(|e| format!("Failed to get index definition: {}", e))?;

            // Extract columns from index definition (simplified approach)
            let columns = extract_index_columns(&definition);

            indexes.push(IndexInfo {
                index_name,
                table_name: table_name.clone(),
                columns,
                is_unique: idx_row
                    .try_get("is_unique")
                    .map_err(|e| format!("Failed to get is_unique: {}", e))?,
                is_primary: idx_row
                    .try_get("is_primary")
                    .map_err(|e| format!("Failed to get is_primary: {}", e))?,
                definition,
            });
        }

        tables.push(EnhancedTableInfo {
            table_name,
            columns,
            foreign_keys,
            indexes,
        });
    }

    // Fetch views
    let view_rows = sqlx::query(
        "SELECT
            table_name AS view_name,
            view_definition AS definition
         FROM information_schema.views
         WHERE table_schema = $1
         ORDER BY table_name",
    )
    .bind(&schema_name)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Failed to fetch views: {}", e))?;

    let mut views = Vec::new();
    for view_row in view_rows {
        views.push(ViewInfo {
            view_name: view_row
                .try_get("view_name")
                .map_err(|e| format!("Failed to get view name: {}", e))?,
            definition: view_row
                .try_get("definition")
                .map_err(|e| format!("Failed to get view definition: {}", e))?,
        });
    }

    // Fetch routines (functions and procedures)
    let routine_rows = sqlx::query(
        "SELECT
            routine_name,
            routine_type,
            routine_definition AS definition,
            data_type AS return_type
         FROM information_schema.routines
         WHERE routine_schema = $1
         ORDER BY routine_name",
    )
    .bind(&schema_name)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Failed to fetch routines: {}", e))?;

    let mut routines = Vec::new();
    for routine_row in routine_rows {
        routines.push(RoutineInfo {
            routine_name: routine_row
                .try_get("routine_name")
                .map_err(|e| format!("Failed to get routine name: {}", e))?,
            routine_type: routine_row
                .try_get("routine_type")
                .map_err(|e| format!("Failed to get routine type: {}", e))?,
            definition: routine_row.try_get("definition").ok(),
            return_type: routine_row.try_get("return_type").ok(),
        });
    }

    pool.close().await;

    Ok(EnhancedDatabaseSchema {
        tables,
        views,
        routines,
    })
}

// Helper function to extract column names from index definition
fn extract_index_columns(definition: &str) -> Vec<String> {
    // Simple extraction - looks for content between parentheses
    // Example: "CREATE INDEX idx_name ON table (col1, col2)" -> ["col1", "col2"]
    if let Some(start) = definition.find('(') {
        if let Some(end) = definition.find(')') {
            let cols_str = &definition[start + 1..end];
            return cols_str
                .split(',')
                .map(|s| s.trim().to_string())
                .collect();
        }
    }
    vec![]
}
