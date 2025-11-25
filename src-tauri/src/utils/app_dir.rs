use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use crate::constants::{APP_DIR_NAME, SETTINGS_FILENAME};

// Global state for current project path
pub static PROJECT_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RecentProject {
    pub path: String,
    pub last_accessed: String, // ISO 8601 timestamp
    pub name: Option<String>,
}

pub fn get_app_dir() -> Result<PathBuf, String> {
    // Check if custom project path is set
    let project_path = PROJECT_PATH.lock().unwrap();

    let app_dir = if let Some(path) = project_path.as_ref() {
        path.clone()
    } else {
        dirs::home_dir()
            .ok_or("Could not find home directory")?
            .join(APP_DIR_NAME)
    };

    fs::create_dir_all(&app_dir).map_err(|e| format!("Could not create app directory: {}", e))?;

    Ok(app_dir)
}

pub fn set_project_path_internal(path: String) -> Result<(), String> {
    let project_path = PathBuf::from(&path);

    // Verify directory exists or can be created
    fs::create_dir_all(&project_path)
        .map_err(|e| format!("Could not create project directory: {}", e))?;

    // Set the global project path
    let mut current_path = PROJECT_PATH.lock().unwrap();
    *current_path = Some(project_path.clone());

    // Load existing settings and update project_path
    let default_dir = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(APP_DIR_NAME);
    fs::create_dir_all(&default_dir)
        .map_err(|e| format!("Could not create default directory: {}", e))?;

    let settings_file = default_dir.join(SETTINGS_FILENAME);
    let mut settings = load_settings_json(&settings_file)?;
    settings["project_path"] = serde_json::json!(project_path.to_string_lossy().to_string());

    fs::write(
        settings_file,
        serde_json::to_string_pretty(&settings).unwrap(),
    )
    .map_err(|e| format!("Could not write settings: {}", e))?;

    // Add to recent projects
    add_recent_project_internal(path)?;

    Ok(())
}

pub fn get_current_project_path_internal() -> Result<Option<String>, String> {
    let project_path = PROJECT_PATH.lock().unwrap();
    Ok(project_path
        .as_ref()
        .map(|p| p.to_string_lossy().to_string()))
}

pub fn load_project_settings_internal() -> Result<(), String> {
    let default_dir = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(APP_DIR_NAME);

    let settings_file = default_dir.join(SETTINGS_FILENAME);

    if settings_file.exists() {
        let data = fs::read_to_string(&settings_file)
            .map_err(|e| format!("Failed to read settings: {}", e))?;

        let settings: serde_json::Value =
            serde_json::from_str(&data).map_err(|e| format!("Failed to parse settings: {}", e))?;

        if let Some(path_str) = settings.get("project_path").and_then(|v| v.as_str()) {
            let mut current_path = PROJECT_PATH.lock().unwrap();
            *current_path = Some(PathBuf::from(path_str));
        }
    }

    Ok(())
}

// Helper function to load settings JSON
fn load_settings_json(settings_file: &PathBuf) -> Result<serde_json::Value, String> {
    if settings_file.exists() {
        let data = fs::read_to_string(settings_file)
            .map_err(|e| format!("Failed to read settings: {}", e))?;
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse settings: {}", e))
    } else {
        Ok(serde_json::json!({}))
    }
}

// Helper function to get settings file path
fn get_settings_file() -> Result<PathBuf, String> {
    let default_dir = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(APP_DIR_NAME);
    fs::create_dir_all(&default_dir)
        .map_err(|e| format!("Could not create default directory: {}", e))?;
    Ok(default_dir.join(SETTINGS_FILENAME))
}

pub fn set_last_connection_internal(connection_name: String) -> Result<(), String> {
    let settings_file = get_settings_file()?;
    let mut settings = load_settings_json(&settings_file)?;
    settings["last_connection"] = serde_json::json!(connection_name);

    fs::write(
        settings_file,
        serde_json::to_string_pretty(&settings).unwrap(),
    )
    .map_err(|e| format!("Could not write settings: {}", e))?;

    Ok(())
}

pub fn get_last_connection_internal() -> Result<Option<String>, String> {
    let settings_file = get_settings_file()?;
    let settings = load_settings_json(&settings_file)?;
    Ok(settings.get("last_connection").and_then(|v| v.as_str()).map(|s| s.to_string()))
}

pub fn set_auto_connect_enabled_internal(enabled: bool) -> Result<(), String> {
    let settings_file = get_settings_file()?;
    let mut settings = load_settings_json(&settings_file)?;
    settings["auto_connect_enabled"] = serde_json::json!(enabled);

    fs::write(
        settings_file,
        serde_json::to_string_pretty(&settings).unwrap(),
    )
    .map_err(|e| format!("Could not write settings: {}", e))?;

    Ok(())
}

pub fn get_auto_connect_enabled_internal() -> Result<bool, String> {
    let settings_file = get_settings_file()?;
    let settings = load_settings_json(&settings_file)?;
    Ok(settings.get("auto_connect_enabled").and_then(|v| v.as_bool()).unwrap_or(false))
}

pub fn set_vim_mode_enabled_internal(enabled: bool) -> Result<(), String> {
    let settings_file = get_settings_file()?;
    let mut settings = load_settings_json(&settings_file)?;
    settings["vim_mode_enabled"] = serde_json::json!(enabled);

    fs::write(
        settings_file,
        serde_json::to_string_pretty(&settings).unwrap(),
    )
    .map_err(|e| format!("Could not write settings: {}", e))?;

    Ok(())
}

pub fn get_vim_mode_enabled_internal() -> Result<bool, String> {
    let settings_file = get_settings_file()?;
    let settings = load_settings_json(&settings_file)?;
    Ok(settings.get("vim_mode_enabled").and_then(|v| v.as_bool()).unwrap_or(false))
}

// Recent projects management

const MAX_RECENT_PROJECTS: usize = 10;

pub fn add_recent_project_internal(path: String) -> Result<(), String> {
    let settings_file = get_settings_file()?;
    let mut settings = load_settings_json(&settings_file)?;

    // Get or create recent_projects array
    let mut recent_projects: Vec<RecentProject> = settings
        .get("recent_projects")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_else(Vec::new);

    // Check if project already exists and remove it (we'll re-add it with updated timestamp)
    recent_projects.retain(|p| p.path != path);

    // Get folder name for display
    let path_buf = PathBuf::from(&path);
    let name = path_buf
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_string());

    // Add the project at the beginning with current timestamp
    let now: DateTime<Utc> = Utc::now();
    recent_projects.insert(
        0,
        RecentProject {
            path: path.clone(),
            last_accessed: now.to_rfc3339(),
            name,
        },
    );

    // Limit to MAX_RECENT_PROJECTS
    recent_projects.truncate(MAX_RECENT_PROJECTS);

    // Save back to settings
    settings["recent_projects"] = serde_json::to_value(&recent_projects)
        .map_err(|e| format!("Failed to serialize recent projects: {}", e))?;

    fs::write(
        settings_file,
        serde_json::to_string_pretty(&settings).unwrap(),
    )
    .map_err(|e| format!("Could not write settings: {}", e))?;

    Ok(())
}

pub fn get_recent_projects_internal() -> Result<Vec<RecentProject>, String> {
    let settings_file = get_settings_file()?;
    let settings = load_settings_json(&settings_file)?;

    let mut recent_projects: Vec<RecentProject> = settings
        .get("recent_projects")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_else(Vec::new);

    // Filter out projects that no longer exist
    recent_projects.retain(|p| {
        let path = PathBuf::from(&p.path);
        path.exists()
    });

    // Save the cleaned list if we removed any
    let original_len = settings
        .get("recent_projects")
        .and_then(|v| v.as_array())
        .map(|a| a.len())
        .unwrap_or(0);

    if recent_projects.len() != original_len {
        let mut updated_settings = settings.clone();
        updated_settings["recent_projects"] = serde_json::to_value(&recent_projects)
            .map_err(|e| format!("Failed to serialize recent projects: {}", e))?;

        let _ = fs::write(
            settings_file,
            serde_json::to_string_pretty(&updated_settings).unwrap(),
        );
    }

    Ok(recent_projects)
}

pub fn remove_recent_project_internal(path: String) -> Result<(), String> {
    let settings_file = get_settings_file()?;
    let mut settings = load_settings_json(&settings_file)?;

    let mut recent_projects: Vec<RecentProject> = settings
        .get("recent_projects")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_else(Vec::new);

    // Remove the project
    recent_projects.retain(|p| p.path != path);

    // Save back to settings
    settings["recent_projects"] = serde_json::to_value(&recent_projects)
        .map_err(|e| format!("Failed to serialize recent projects: {}", e))?;

    fs::write(
        settings_file,
        serde_json::to_string_pretty(&settings).unwrap(),
    )
    .map_err(|e| format!("Could not write settings: {}", e))?;

    Ok(())
}
