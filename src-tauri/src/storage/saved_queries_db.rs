use sqlx::sqlite::{SqliteConnectOptions, SqlitePool};
use std::str::FromStr;
use crate::constants::SAVED_QUERIES_DB_FILENAME;

pub async fn get_saved_queries_db(app_dir: std::path::PathBuf) -> Result<SqlitePool, String> {
    let db_path = app_dir.join(SAVED_QUERIES_DB_FILENAME);

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
