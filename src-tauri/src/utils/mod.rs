mod app_dir;
pub mod schema_diff;

pub use app_dir::{
    get_app_dir, get_auto_connect_enabled_internal, get_current_project_path_internal,
    get_last_connection_internal, load_project_settings_internal, set_auto_connect_enabled_internal,
    set_last_connection_internal, set_project_path_internal, get_recent_projects_internal,
    remove_recent_project_internal, RecentProject, get_vim_mode_enabled_internal,
    set_vim_mode_enabled_internal,
};

pub use schema_diff::{
    compare_schemas, generate_migration_script,
    SchemaComparison,
};
