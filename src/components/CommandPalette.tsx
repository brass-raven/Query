import { useState, useEffect, useRef } from "react";

interface TableInfo {
  table_name: string;
  columns: Array<{
    column_name: string;
    data_type: string;
  }>;
}

interface DatabaseSchema {
  tables: TableInfo[];
}

interface QueryHistoryEntry {
  id: number;
  query: string;
  connection_name: string;
  execution_time_ms: number;
  row_count: number;
  executed_at: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  schema: DatabaseSchema | null;
  history: QueryHistoryEntry[];
  onExecuteQuery: (query: string) => void;
}

interface Command {
  id: string;
  label: string;
  description: string;
  query: string;
  category: "table" | "history" | "quick";
}

export function CommandPalette({
  isOpen,
  onClose,
  schema,
  history,
  onExecuteQuery,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Build commands list
  const commands: Command[] = [];

  // Add table commands
  if (schema?.tables) {
    schema.tables.forEach((table) => {
      const tableName = table.table_name;

      // SELECT command
      commands.push({
        id: `select-${tableName}`,
        label: `SELECT ${tableName}`,
        description: `Select all from ${tableName} (limit 100)`,
        query: `SELECT * FROM ${tableName} LIMIT 100;`,
        category: "table",
      });

      // UPDATE command
      commands.push({
        id: `update-${tableName}`,
        label: `UPDATE ${tableName}`,
        description: `Update records in ${tableName}`,
        query: `UPDATE ${tableName} SET  WHERE ;`,
        category: "table",
      });

      // DESCRIBE command
      commands.push({
        id: `describe-${tableName}`,
        label: `DESCRIBE ${tableName}`,
        description: `Show structure of ${tableName}`,
        query: `SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = '${tableName}'
ORDER BY ordinal_position;`,
        category: "table",
      });

      // COUNT command
      commands.push({
        id: `count-${tableName}`,
        label: `COUNT ${tableName}`,
        description: `Count rows in ${tableName}`,
        query: `SELECT COUNT(*) FROM ${tableName};`,
        category: "table",
      });
    });
  }

  // Add recent queries from history
  history.slice(0, 5).forEach((entry, idx) => {
    commands.push({
      id: `history-${entry.id}`,
      label: entry.query.substring(0, 50) + (entry.query.length > 50 ? "..." : ""),
      description: `Recent • ${entry.row_count} rows in ${entry.execution_time_ms}ms`,
      query: entry.query,
      category: "history",
    });
  });

  // Filter commands based on search
  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.description.toLowerCase().includes(search.toLowerCase())
  );

  // Group by category
  const groupedCommands = {
    quick: filteredCommands.filter((c) => c.category === "quick"),
    table: filteredCommands.filter((c) => c.category === "table"),
    history: filteredCommands.filter((c) => c.category === "history"),
  };

  // Flatten for keyboard navigation
  const flatCommands = [
    ...groupedCommands.table,
    ...groupedCommands.history,
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatCommands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && flatCommands[selectedIndex]) {
      e.preventDefault();
      handleSelect(flatCommands[selectedIndex]);
    }
  };

  const handleSelect = (command: Command) => {
    onExecuteQuery(command.query);
    onClose();
    setSearch("");
    setSelectedIndex(0);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-32 z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="p-4 border-b border-gray-700">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search for tables, commands, or recent queries..."
            className="w-full px-4 py-3 bg-gray-900 rounded border border-gray-700 focus:border-blue-500 focus:outline-none text-lg"
          />
        </div>

        {/* Commands List */}
        <div className="max-h-96 overflow-y-auto">
          {flatCommands.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {schema?.tables.length === 0 ? (
                <>
                  <p className="text-sm">No tables available</p>
                  <p className="text-xs mt-2">Connect to a database first</p>
                </>
              ) : (
                <p className="text-sm">No results found</p>
              )}
            </div>
          ) : (
            <>
              {groupedCommands.table.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-900">
                    TABLE COMMANDS
                  </div>
                  {groupedCommands.table.map((cmd, idx) => {
                    const globalIdx = flatCommands.indexOf(cmd);
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => handleSelect(cmd)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-700 transition border-b border-gray-700 last:border-b-0 ${
                          globalIdx === selectedIndex ? "bg-gray-700" : ""
                        }`}
                      >
                        <p className="text-sm font-medium">{cmd.label}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {cmd.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              {groupedCommands.history.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-900">
                    RECENT QUERIES
                  </div>
                  {groupedCommands.history.map((cmd) => {
                    const globalIdx = flatCommands.indexOf(cmd);
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => handleSelect(cmd)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-700 transition border-b border-gray-700 last:border-b-0 ${
                          globalIdx === selectedIndex ? "bg-gray-700" : ""
                        }`}
                      >
                        <p className="text-sm font-mono">{cmd.label}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {cmd.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700 text-xs text-gray-500 flex items-center justify-between">
          <div className="flex gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <span>⌘K to toggle</span>
        </div>
      </div>
    </div>
  );
}
