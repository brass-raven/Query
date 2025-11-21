use sqlx::sqlite::{SqliteConnectOptions, SqlitePool};
use std::str::FromStr;
use crate::constants::HISTORY_DB_FILENAME;

pub async fn get_history_db(app_dir: std::path::PathBuf) -> Result<SqlitePool, String> {
    let db_path = app_dir.join(HISTORY_DB_FILENAME);

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
