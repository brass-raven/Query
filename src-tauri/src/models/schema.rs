use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ColumnInfo {
    pub column_name: String,
    pub data_type: String,
    pub is_nullable: String,
    pub is_primary_key: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ForeignKeyInfo {
    pub constraint_name: String,
    pub table_name: String,
    pub column_name: String,
    pub foreign_table_name: String,
    pub foreign_column_name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TableInfo {
    pub table_name: String,
    pub columns: Vec<ColumnInfo>,
    pub foreign_keys: Vec<ForeignKeyInfo>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DatabaseSchema {
    pub tables: Vec<TableInfo>,
}

// Enhanced schema types for schema comparison feature

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct IndexInfo {
    pub index_name: String,
    pub table_name: String,
    pub columns: Vec<String>,
    pub is_unique: bool,
    pub is_primary: bool,
    pub definition: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ViewInfo {
    pub view_name: String,
    pub definition: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RoutineInfo {
    pub routine_name: String,
    pub routine_type: String, // 'FUNCTION' or 'PROCEDURE'
    pub definition: Option<String>,
    pub return_type: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EnhancedColumnInfo {
    pub column_name: String,
    pub data_type: String,
    pub is_nullable: String,
    pub is_primary_key: bool,
    pub column_default: Option<String>,
    pub character_maximum_length: Option<i32>,
    pub numeric_precision: Option<i32>,
    pub numeric_scale: Option<i32>,
    pub ordinal_position: i32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EnhancedTableInfo {
    pub table_name: String,
    pub columns: Vec<EnhancedColumnInfo>,
    pub foreign_keys: Vec<ForeignKeyInfo>,
    pub indexes: Vec<IndexInfo>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct EnhancedDatabaseSchema {
    pub tables: Vec<EnhancedTableInfo>,
    pub views: Vec<ViewInfo>,
    pub routines: Vec<RoutineInfo>,
}
