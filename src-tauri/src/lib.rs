// Module declarations
mod commands;
mod models;
mod storage;
mod utils;

// Re-export commands for Tauri
use commands::*;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            // Connection commands
            test_postgres_connection,
            execute_query,
            get_database_schema,
            get_database_schemas,
            // History commands
            save_query_to_history,
            get_query_history,
            clear_query_history,
            // Saved queries commands
            save_query,
            get_saved_queries,
            delete_saved_query,
            toggle_pin_query,
            // Settings commands
            set_project_path,
            get_current_project_path,
            load_project_settings,
            get_app_dir,
            set_last_connection,
            get_last_connection,
            set_auto_connect_enabled,
            get_auto_connect_enabled,
            // Connection storage commands
            save_connections,
            load_connections,
            save_connection_password,
            get_connection_password,
            delete_connection_password,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
