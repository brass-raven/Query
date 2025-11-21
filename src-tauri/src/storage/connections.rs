use crate::models::ConnectionConfig;
use crate::constants::CONNECTIONS_FILENAME;
use std::fs;
use std::path::PathBuf;

pub fn save_connections(
    connections: Vec<ConnectionConfig>,
    app_dir: PathBuf,
) -> Result<(), String> {
    let connections_file = app_dir.join(CONNECTIONS_FILENAME);

    let json = serde_json::to_string(&connections)
        .map_err(|e| format!("Could not serialize connections: {}", e))?;

    fs::write(connections_file, json)
        .map_err(|e| format!("Could not write connections file: {}", e))?;

    Ok(())
}

pub fn load_connections(app_dir: PathBuf) -> Result<Vec<ConnectionConfig>, String> {
    let connections_file = app_dir.join(CONNECTIONS_FILENAME);

    if !connections_file.exists() {
        return Ok(Vec::new());
    }

    let data =
        fs::read_to_string(&connections_file).map_err(|e| format!("Failed to read file: {}", e))?;

    let connections: Vec<ConnectionConfig> =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse: {}", e))?;

    Ok(connections)
}
