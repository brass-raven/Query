import { useState } from "react";

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface TableInfo {
  table_name: string;
  columns: ColumnInfo[];
}

interface DatabaseSchema {
  tables: TableInfo[];
}

interface SchemaExplorerProps {
  schema: DatabaseSchema | null;
  onTableClick: (tableName: string) => void;
  onTableDoubleClick: (tableName: string) => void;
  onColumnClick: (tableName: string, columnName: string) => void;
}

export function SchemaExplorer({ schema, onTableClick, onTableDoubleClick, onColumnClick }: SchemaExplorerProps) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  function toggleTable(tableName: string) {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  }

  if (!schema || schema.tables.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h2 className="font-semibold text-sm mb-3">Schema</h2>
        <p className="text-xs text-gray-500 text-center py-4">
          Connect to see tables
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <h2 className="font-semibold text-sm mb-3">
        Schema ({schema.tables.length} tables)
      </h2>
      
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {schema.tables.map((table) => (
          <div key={table.table_name}>
            <div
              className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded cursor-pointer"
              onClick={() => toggleTable(table.table_name)}
            >
              <span className="text-xs">
                {expandedTables.has(table.table_name) ? '▼' : '▶'}
              </span>
              <span
                className="text-sm font-mono flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onTableClick(table.table_name);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onTableDoubleClick(table.table_name);
                }}
              >
                {table.table_name}
              </span>
              <span className="text-xs text-gray-500">
                {table.columns.length}
              </span>
            </div>
            
            {expandedTables.has(table.table_name) && (
              <div className="ml-6 space-y-1">
                {table.columns.map((col) => (
                  <div
                    key={col.column_name}
                    className="flex items-center justify-between p-1.5 hover:bg-gray-900 rounded cursor-pointer text-xs"
                    onClick={() => onColumnClick(table.table_name, col.column_name)}
                  >
                    <span className="font-mono text-gray-300">
                      {col.column_name}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {col.data_type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
