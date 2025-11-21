// Application constants

// File names for data storage
pub const HISTORY_DB_FILENAME: &str = "history.db";
pub const SAVED_QUERIES_DB_FILENAME: &str = "saved_queries.db";
pub const CONNECTIONS_FILENAME: &str = "connections.json";
pub const SETTINGS_FILENAME: &str = "settings.json";

// Directory names
pub const APP_DIR_NAME: &str = ".query";

// Keychain configuration
pub const KEYCHAIN_SERVICE_NAME: &str = "Query";

// Query limits
pub const MAX_RECENT_PROJECTS: usize = 10;

// SQL constants
pub const SQL_NULLABLE_YES: &str = "YES";

// Warning types for schema comparison
pub const WARNING_TYPE_DATA_LOSS: &str = "data_loss";
pub const WARNING_TYPE_BREAKING_CHANGE: &str = "breaking_change";
pub const WARNING_TYPE_LOCKING: &str = "locking";
pub const WARNING_TYPE_INFO: &str = "info";
