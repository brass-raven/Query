use crate::models::ConnectionConfig;
use crate::utils::SchemaComparison;

#[tauri::command]
pub async fn compare_schemas(
    source_config: ConnectionConfig,
    target_config: ConnectionConfig,
    schema: Option<String>,
) -> Result<SchemaComparison, String> {
    // Fetch source schema
    let source_schema = fetch_enhanced_schema(&source_config, schema.clone()).await?;

    // Fetch target schema
    let target_schema = fetch_enhanced_schema(&target_config, schema).await?;

    // Compare schemas
    let comparison = crate::utils::compare_schemas(
        &source_schema,
        &target_schema,
        source_config.name.clone(),
        target_config.name.clone(),
    );

    Ok(comparison)
}

#[tauri::command]
pub fn generate_migration_sql(comparison: SchemaComparison) -> Result<String, String> {
    let migration_script = crate::utils::generate_migration_script(&comparison);
    Ok(migration_script)
}

// Helper function to fetch enhanced schema
async fn fetch_enhanced_schema(
    config: &ConnectionConfig,
    schema: Option<String>,
) -> Result<crate::models::EnhancedDatabaseSchema, String> {
    // Reuse the existing get_enhanced_database_schema logic
    use crate::commands::get_enhanced_database_schema;
    get_enhanced_database_schema(config.clone(), schema).await
}
