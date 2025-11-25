import { memo, useState, useMemo, useEffect } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../ui/command";
import { Database, History as HistoryIcon, Search, BookmarkIcon, Pin, Code } from "lucide-react";
import type { DatabaseSchema, QueryHistoryEntry, SavedQuery } from "../../types";
import { DEFAULTS, UI_LAYOUT } from "../../constants";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  schema: DatabaseSchema | null;
  history: QueryHistoryEntry[];
  savedQueries: SavedQuery[];
  onExecuteQuery: (query: string) => void;
}

interface Command {
  id: string;
  label: string;
  description: string;
  query: string;
  category: "table" | "history" | "saved" | "contextual";
  icon?: React.ReactNode;
  isPinned?: boolean;
}

// SQL context detection utilities
function detectSQLContext(input: string): {
  type: "select" | "update" | "delete" | "insert" | "join" | "where" | "unknown";
  tableName?: string;
  partial: string;
} {
  const normalized = input.toLowerCase().trim();

  // Detect SELECT context
  if (normalized.match(/^select\s+/)) {
    const fromMatch = normalized.match(/from\s+(\w+)/);
    const whereMatch = normalized.match(/where\s+(.*)$/);

    // Try to extract table name from "select tablename where" pattern
    const selectTableMatch = normalized.match(/^select\s+(?:\*\s+from\s+)?(\w+)\s+where/);

    if (whereMatch) {
      const tableName = fromMatch?.[1] || selectTableMatch?.[1];
      return { type: "where", tableName, partial: whereMatch[1] };
    }
    if (fromMatch) {
      return { type: "select", tableName: fromMatch[1], partial: normalized };
    }
    return { type: "select", partial: normalized };
  }

  // Detect UPDATE context
  if (normalized.match(/^update\s+(\w+)/)) {
    const tableMatch = normalized.match(/^update\s+(\w+)/);
    const whereMatch = normalized.match(/where\s+(.*)$/);
    if (whereMatch) {
      return { type: "where", tableName: tableMatch?.[1], partial: whereMatch[1] };
    }
    return { type: "update", tableName: tableMatch?.[1], partial: normalized };
  }

  // Detect DELETE context
  if (normalized.match(/^delete\s+from\s+(\w+)/)) {
    const tableMatch = normalized.match(/^delete\s+from\s+(\w+)/);
    const whereMatch = normalized.match(/where\s+(.*)$/);
    if (whereMatch) {
      return { type: "where", tableName: tableMatch?.[1], partial: whereMatch[1] };
    }
    return { type: "delete", tableName: tableMatch?.[1], partial: normalized };
  }

  // Detect INSERT context
  if (normalized.match(/^insert\s+into\s+(\w+)/)) {
    const tableMatch = normalized.match(/^insert\s+into\s+(\w+)/);
    return { type: "insert", tableName: tableMatch?.[1], partial: normalized };
  }

  // Detect JOIN context
  if (normalized.match(/join\s*$/)) {
    return { type: "join", partial: normalized };
  }

  return { type: "unknown", partial: normalized };
}

export const CommandPalette = memo(function CommandPalette({
  isOpen,
  onClose,
  schema,
  history,
  savedQueries,
  onExecuteQuery,
}: CommandPaletteProps) {
  const [searchInput, setSearchInput] = useState("");

  // Reset search input when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchInput("");
    }
  }, [isOpen]);

  // Detect SQL context from search input
  const sqlContext = useMemo(() => detectSQLContext(searchInput), [searchInput]);

  // Build commands list
  const commands: Command[] = useMemo(() => {
    const cmds: Command[] = [];

    // Simple autocomplete: if user types "select", show table suggestions
    const lowerInput = searchInput.toLowerCase().trim();
    if (lowerInput.startsWith("select") && schema?.tables) {
      schema.tables.forEach((table) => {
        cmds.push({
          id: `select-${table.table_name}`,
          label: `SELECT * FROM ${table.table_name}`,
          description: `Query ${table.table_name} table`,
          query: `SELECT * FROM ${table.table_name} LIMIT 100;`,
          category: "contextual",
          icon: <Code className="h-4 w-4" />,
        });
      });
    }

  // Add table commands (default templates)
  if (schema?.tables) {
    schema.tables.forEach((table) => {
      const tableName = table.table_name;

      // SELECT command
      cmds.push({
        id: `select-${tableName}`,
        label: `SELECT ${tableName}`,
        description: `Select all from ${tableName} (limit ${DEFAULTS.QUERY_LIMIT})`,
        query: `SELECT * FROM ${tableName} LIMIT ${DEFAULTS.QUERY_LIMIT};`,
        category: "table",
        icon: <Database className="h-4 w-4" />,
      });

      // UPDATE command
      cmds.push({
        id: `update-${tableName}`,
        label: `UPDATE ${tableName}`,
        description: `Update records in ${tableName}`,
        query: `UPDATE ${tableName} SET column = 'value' WHERE condition;`,
        category: "table",
        icon: <Database className="h-4 w-4" />,
      });

      // DESCRIBE command
      cmds.push({
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
        icon: <Search className="h-4 w-4" />,
      });

      // COUNT command
      cmds.push({
        id: `count-${tableName}`,
        label: `COUNT ${tableName}`,
        description: `Count rows in ${tableName}`,
        query: `SELECT COUNT(*) FROM ${tableName};`,
        category: "table",
        icon: <Database className="h-4 w-4" />,
      });

      // INSERT command
      cmds.push({
        id: `insert-${tableName}`,
        label: `INSERT ${tableName}`,
        description: `Insert new record into ${tableName}`,
        query: `INSERT INTO ${tableName} (column1, column2) VALUES ('value1', 'value2');`,
        category: "table",
        icon: <Database className="h-4 w-4" />,
      });

      // DELETE command
      cmds.push({
        id: `delete-${tableName}`,
        label: `DELETE ${tableName}`,
        description: `Delete records from ${tableName}`,
        query: `DELETE FROM ${tableName} WHERE condition;`,
        category: "table",
        icon: <Database className="h-4 w-4" />,
      });
    });
  }

  // Add recent queries from history
  history.slice(0, DEFAULTS.RECENT_HISTORY_LIMIT).forEach((entry) => {
    cmds.push({
      id: `history-${entry.id}`,
      label:
        entry.query.substring(0, UI_LAYOUT.QUERY_PREVIEW_LENGTH) + (entry.query.length > UI_LAYOUT.QUERY_PREVIEW_LENGTH ? "..." : ""),
      description: `${entry.row_count} rows in ${entry.execution_time_ms}ms`,
      query: entry.query,
      category: "history",
      icon: <HistoryIcon className="h-4 w-4" />,
    });
  });

  // Add saved queries
  savedQueries.forEach((saved) => {
    cmds.push({
      id: `saved-${saved.id}`,
      label: saved.name,
      description: saved.description || saved.query.substring(0, 60) + (saved.query.length > 60 ? "..." : ""),
      query: saved.query,
      category: "saved",
      icon: <BookmarkIcon className="h-4 w-4" />,
      isPinned: saved.is_pinned,
    });
  });

    return cmds;
  }, [schema, history, savedQueries, searchInput, sqlContext]);

  // Filter commands based on search input
  const filteredCommands = useMemo(() => {
    if (!searchInput) return commands;

    const lowerSearch = searchInput.toLowerCase();

    // If user types "select", only show contextual SELECT suggestions
    if (lowerSearch.startsWith("select")) {
      return commands.filter((c) => c.category === "contextual");
    }

    // Otherwise, normal fuzzy filtering
    return commands.filter((c) => {
      return (
        c.label.toLowerCase().includes(lowerSearch) ||
        c.description.toLowerCase().includes(lowerSearch)
      );
    });
  }, [commands, searchInput]);

  // Group by category
  const tableCommands = filteredCommands.filter((c) => c.category === "table");
  const historyCommands = filteredCommands.filter((c) => c.category === "history");
  const savedCommands = filteredCommands.filter((c) => c.category === "saved");
  const contextualCommands = filteredCommands.filter((c) => c.category === "contextual");

  const handleSelect = (command: Command) => {
    onExecuteQuery(command.query);
    onClose();
  };

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={onClose}
      title="Command Palette"
      description="Search for tables, commands, or recent queries"
      shouldFilter={false}
    >
      <CommandInput
        placeholder="Search tables or type 'select' to start a query..."
        value={searchInput}
        onValueChange={setSearchInput}
      />
      <CommandList>
        <CommandEmpty>
          {schema?.tables.length === 0 ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm">No tables available</p>
              <p className="text-xs text-muted-foreground">
                Connect to a database first
              </p>
            </div>
          ) : (
            <p className="text-sm">No results found</p>
          )}
        </CommandEmpty>

        {contextualCommands.length > 0 && (
          <CommandGroup heading="Tables">
            {contextualCommands.map((cmd) => (
              <CommandItem
                key={cmd.id}
                value={`${cmd.label} ${cmd.description}`}
                onSelect={() => handleSelect(cmd)}
              >
                {cmd.icon}
                <div className="flex flex-col">
                  <span className="font-medium">{cmd.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {cmd.description}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {contextualCommands.length > 0 && tableCommands.length > 0 && (
          <CommandSeparator />
        )}

        {tableCommands.length > 0 && (
          <CommandGroup heading="Table Commands">
            {tableCommands.map((cmd) => (
              <CommandItem
                key={cmd.id}
                value={`${cmd.label} ${cmd.description}`}
                onSelect={() => handleSelect(cmd)}
              >
                {cmd.icon}
                <div className="flex flex-col">
                  <span className="font-medium">{cmd.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {cmd.description}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {tableCommands.length > 0 && historyCommands.length > 0 && (
          <CommandSeparator />
        )}

        {savedCommands.length > 0 && (
          <CommandGroup heading="Saved Queries">
            {savedCommands.map((cmd) => (
              <CommandItem
                key={cmd.id}
                value={`${cmd.label} ${cmd.description}`}
                onSelect={() => handleSelect(cmd)}
              >
                {cmd.icon}
                {cmd.isPinned && <Pin className="h-3 w-3 text-yellow-500" />}
                <div className="flex flex-col">
                  <span className="font-medium">{cmd.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {cmd.description}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {savedCommands.length > 0 && historyCommands.length > 0 && (
          <CommandSeparator />
        )}

        {historyCommands.length > 0 && (
          <CommandGroup heading="Recent Queries">
            {historyCommands.map((cmd) => (
              <CommandItem
                key={cmd.id}
                value={`${cmd.label} ${cmd.description}`}
                onSelect={() => handleSelect(cmd)}
              >
                {cmd.icon}
                <div className="flex flex-col">
                  <span className="font-mono text-xs">{cmd.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {cmd.description}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
});
