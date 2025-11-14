use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPool;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool};
use sqlx::{Column, Row};
use std::fs;
use std::path::PathBuf;
use std::str::FromStr;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

#[derive(Serialize, Deserialize, Debug, Clone)]
struct QueryHistoryEntry {
    id: i64,
    query: String,
    connection_name: String,
    execution_time_ms: i64,
    row_count: i64,
    executed_at: String, // ISO timestamp
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct SavedQuery {
    id: i64,
    name: String,
    query: String,
    description: Option<String>,
    is_pinned: bool,
    created_at: String, // ISO timestamp
    updated_at: String, // ISO timestamp
}

// TODO: ask for location to store the data, & somehow encrypt the password?
#[derive(Serialize, Deserialize, Debug, Clone)]
struct ConnectionConfig {
    name: String,
    host: String,
    port: u16,
    database: String,
    username: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    password: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct QueryResult {
    columns: Vec<String>,
    rows: Vec<Vec<serde_json::Value>>,
    row_count: usize,
    execution_time_ms: u128,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct TableInfo {
    table_name: String,
    columns: Vec<ColumnInfo>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct ColumnInfo {
    column_name: String,
    data_type: String,
    is_nullable: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct DatabaseSchema {
    tables: Vec<TableInfo>,
}

#[tauri::command]
async fn get_database_schema(config: ConnectionConfig) -> Result<DatabaseSchema, String> {
    let connection_string = format!(
        "postgres://{}:{}@{}:{}/{}",
        config.username, config.password, config.host, config.port, config.database
    );

    let pool = PgPool::connect(&connection_string)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    // Get all tables in public schema
    let table_rows = sqlx::query(
        "SELECT table_name 
         FROM information_schema.tables 
         WHERE table_schema = 'public' 
         AND table_type = 'BASE TABLE'
         ORDER BY table_name"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Failed to fetch tables: {}", e))?;

    let mut tables = Vec::new();

    for table_row in table_rows {
        let table_name: String = table_row.try_get("table_name")
            .map_err(|e| format!("Failed to get table name: {}", e))?;

        // Get columns for this table
        let column_rows = sqlx::query(
            "SELECT column_name, data_type, is_nullable
             FROM information_schema.columns
             WHERE table_schema = 'public'
             AND table_name = $1
             ORDER BY ordinal_position"
        )
        .bind(&table_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Failed to fetch columns: {}", e))?;

        let mut columns = Vec::new();
        for col_row in column_rows {
            columns.push(ColumnInfo {
                column_name: col_row.try_get("column_name")
                    .map_err(|e| format!("Failed to get column name: {}", e))?,
                data_type: col_row.try_get("data_type")
                    .map_err(|e| format!("Failed to get data type: {}", e))?,
                is_nullable: col_row.try_get("is_nullable")
                    .map_err(|e| format!("Failed to get is_nullable: {}", e))?,
            });
        }

        tables.push(TableInfo {
            table_name,
            columns,
        });
    }

    pool.close().await;

    Ok(DatabaseSchema { tables })
}

async fn get_history_db() -> Result<SqlitePool, String> {
    let app_dir = get_app_dir()?;
    let db_path = app_dir.join("history.db");

    let options = SqliteConnectOptions::from_str(&format!("sqlite:{}", db_path.display()))
        .map_err(|e| format!("Failed to create options: {}", e))?
        .create_if_missing(true);

    let pool = SqlitePool::connect_with(options)
        .await
        .map_err(|e| format!("Failed to connect to history db: {}", e))?;

    // Create table if it doesn't exist
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS query_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query TEXT NOT NULL,
            connection_name TEXT NOT NULL,
            execution_time_ms INTEGER NOT NULL,
            row_count INTEGER NOT NULL,
            executed_at TEXT NOT NULL
        )
        "#,
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create table: {}", e))?;

    Ok(pool)
}

#[tauri::command]
async fn save_query_to_history(
    query: String,
    connection_name: String,
    execution_time_ms: i64,
    row_count: i64,
) -> Result<(), String> {
    let pool = get_history_db().await?;

    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO query_history (query, connection_name, execution_time_ms, row_count, executed_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&query)
    .bind(&connection_name)
    .bind(execution_time_ms)
    .bind(row_count)
    .bind(&now)
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to save query: {}", e))?;

    pool.close().await;

    Ok(())
}

#[tauri::command]
async fn get_query_history(limit: i64) -> Result<Vec<QueryHistoryEntry>, String> {
    let pool = get_history_db().await?;

    let rows = sqlx::query_as::<_, (i64, String, String, i64, i64, String)>(
        "SELECT id, query, connection_name, execution_time_ms, row_count, executed_at 
         FROM query_history 
         ORDER BY executed_at DESC 
         LIMIT ?",
    )
    .bind(limit)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Failed to fetch history: {}", e))?;

    pool.close().await;

    let history = rows
        .into_iter()
        .map(
            |(id, query, connection_name, execution_time_ms, row_count, executed_at)| {
                QueryHistoryEntry {
                    id,
                    query,
                    connection_name,
                    execution_time_ms,
                    row_count,
                    executed_at,
                }
            },
        )
        .collect();

    Ok(history)
}

#[tauri::command]
async fn clear_query_history() -> Result<(), String> {
    let pool = get_history_db().await?;

    sqlx::query("DELETE FROM query_history")
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to clear history: {}", e))?;

    pool.close().await;

    Ok(())
}

async fn get_saved_queries_db() -> Result<SqlitePool, String> {
    let app_dir = get_app_dir()?;
    let db_path = app_dir.join("saved_queries.db");

    let options = SqliteConnectOptions::from_str(&format!("sqlite:{}", db_path.display()))
        .map_err(|e| format!("Failed to create options: {}", e))?
        .create_if_missing(true);

    let pool = SqlitePool::connect_with(options)
        .await
        .map_err(|e| format!("Failed to connect to saved queries db: {}", e))?;

    // Create table if it doesn't exist
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS saved_queries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            query TEXT NOT NULL,
            description TEXT,
            is_pinned BOOLEAN NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        "#,
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create table: {}", e))?;

    Ok(pool)
}

#[tauri::command]
async fn save_query(
    name: String,
    query: String,
    description: Option<String>,
) -> Result<SavedQuery, String> {
    let pool = get_saved_queries_db().await?;

    let now = chrono::Utc::now().to_rfc3339();

    let result = sqlx::query(
        "INSERT INTO saved_queries (name, query, description, is_pinned, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)"
    )
    .bind(&name)
    .bind(&query)
    .bind(&description)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to save query: {}", e))?;

    let id = result.last_insert_rowid();

    pool.close().await;

    Ok(SavedQuery {
        id,
        name,
        query,
        description,
        is_pinned: false,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
async fn get_saved_queries() -> Result<Vec<SavedQuery>, String> {
    let pool = get_saved_queries_db().await?;

    let rows = sqlx::query_as::<_, (i64, String, String, Option<String>, bool, String, String)>(
        "SELECT id, name, query, description, is_pinned, created_at, updated_at
         FROM saved_queries
         ORDER BY is_pinned DESC, name ASC",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Failed to fetch saved queries: {}", e))?;

    pool.close().await;

    let queries = rows
        .into_iter()
        .map(
            |(id, name, query, description, is_pinned, created_at, updated_at)| SavedQuery {
                id,
                name,
                query,
                description,
                is_pinned,
                created_at,
                updated_at,
            },
        )
        .collect();

    Ok(queries)
}

#[tauri::command]
async fn delete_saved_query(id: i64) -> Result<(), String> {
    let pool = get_saved_queries_db().await?;

    sqlx::query("DELETE FROM saved_queries WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to delete query: {}", e))?;

    pool.close().await;

    Ok(())
}

#[tauri::command]
async fn toggle_pin_query(id: i64) -> Result<bool, String> {
    let pool = get_saved_queries_db().await?;

    // Get current pin status
    let row = sqlx::query_as::<_, (bool,)>("SELECT is_pinned FROM saved_queries WHERE id = ?")
        .bind(id)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Failed to fetch query: {}", e))?;

    let new_pin_status = !row.0;

    // Update pin status
    sqlx::query("UPDATE saved_queries SET is_pinned = ? WHERE id = ?")
        .bind(new_pin_status)
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to update pin status: {}", e))?;

    pool.close().await;

    Ok(new_pin_status)
}

#[tauri::command]
async fn test_postgres_connection(config: ConnectionConfig) -> Result<String, String> {
    // build connection string
    let connection_string = format!(
        "postgres://{}:{}@{}:{}/{}",
        config.username, config.password, config.host, config.port, config.database
    );

    // Try to connect
    let pool = PgPool::connect(&connection_string)
        .await
        .map_err(|e| format!("Error connecting to database: {}", e))?;

    // Close the connection
    pool.close().await;

    Ok(format!(
        "Successfully connected to {}:{}/{}",
        config.host, config.port, config.database
    ))
}

#[tauri::command]
async fn execute_query(config: ConnectionConfig, query: String) -> Result<QueryResult, String> {
    let start = std::time::Instant::now();

    // build connection string
    let connection_string = format!(
        "postgres://{}:{}@{}:{}/{}",
        config.username, config.password, config.host, config.port, config.database
    );

    // Try to connect
    let pool = PgPool::connect(&connection_string)
        .await
        .map_err(|e| format!("Error connecting to database: {}", e))?;

    // Execute query
    let rows = sqlx::query(&query)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Error executing query: {}", e))?;

    // Close the connection
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
            // Try to get value as different types
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
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_app_dir() -> Result<PathBuf, String> {
    let app_dir = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(".query");

    fs::create_dir_all(&app_dir).map_err(|e| format!("Could not create app directory: {}", e))?;

    Ok(app_dir)
}

#[tauri::command]
fn save_connections(connections: Vec<ConnectionConfig>) -> Result<(), String> {
    let app_dir = get_app_dir()?;
    let connections_file = app_dir.join("connections.json");

    let json = serde_json::to_string(&connections)
        .map_err(|e| format!("Could not serialize connections: {}", e))?;

    fs::write(connections_file, json)
        .map_err(|e| format!("Could not write connections file: {}", e))?;

    Ok(())
}

#[tauri::command]
fn load_connections() -> Result<Vec<ConnectionConfig>, String> {
    let app_dir = get_app_dir()?;
    let connections_file = app_dir.join("connections.json");

    if !connections_file.exists() {
        return Ok(Vec::new());
    }

    let data =
        fs::read_to_string(&connections_file).map_err(|e| format!("Failed to read file: {}", e))?;

    let connections: Vec<ConnectionConfig> =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse: {}", e))?;

    Ok(connections)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            test_postgres_connection,
            execute_query,
            load_connections,
            save_connections,
            save_query_to_history,
            get_query_history,
            clear_query_history,
            get_database_schema,
            save_query,
            get_saved_queries,
            delete_saved_query,
            toggle_pin_query,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
