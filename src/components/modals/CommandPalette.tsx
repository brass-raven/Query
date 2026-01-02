import { memo } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../ui/command";
import { Database, History as HistoryIcon, Search, BookmarkIcon, Pin } from "lucide-react";
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
  category: "table" | "history" | "saved";
  icon?: React.ReactNode;
  isPinned?: boolean;
}

export const CommandPalette = memo(function CommandPalette({
  isOpen,
  onClose,
  schema,
  history,
  savedQueries,
  onExecuteQuery,
}: CommandPaletteProps) {
  // Build commands list
  const commands: Command[] = [];

  // Add table commands (default templates)
  if (schema?.tables) {
    schema.tables.forEach((table) => {
      const tableName = table.table_name;

      // SELECT command
      commands.push({
        id: `select-${tableName}`,
        label: `SELECT ${tableName}`,
        description: `Select all from ${tableName} (limit ${DEFAULTS.QUERY_LIMIT})`,
        query: `SELECT * FROM ${tableName} LIMIT ${DEFAULTS.QUERY_LIMIT};`,
        category: "table",
        icon: <Database className="h-4 w-4" />,
      });

      // UPDATE command
      commands.push({
        id: `update-${tableName}`,
        label: `UPDATE ${tableName}`,
        description: `Update records in ${tableName}`,
        query: `UPDATE ${tableName} SET column = 'value' WHERE condition;`,
        category: "table",
        icon: <Database className="h-4 w-4" />,
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
        icon: <Search className="h-4 w-4" />,
      });

      // COUNT command
      commands.push({
        id: `count-${tableName}`,
        label: `COUNT ${tableName}`,
        description: `Count rows in ${tableName}`,
        query: `SELECT COUNT(*) FROM ${tableName};`,
        category: "table",
        icon: <Database className="h-4 w-4" />,
      });

      // INSERT command
      commands.push({
        id: `insert-${tableName}`,
        label: `INSERT ${tableName}`,
        description: `Insert new record into ${tableName}`,
        query: `INSERT INTO ${tableName} (column1, column2) VALUES ('value1', 'value2');`,
        category: "table",
        icon: <Database className="h-4 w-4" />,
      });

      // DELETE command
      commands.push({
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
    commands.push({
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
    commands.push({
      id: `saved-${saved.id}`,
      label: saved.name,
      description: saved.description || saved.query.substring(0, 60) + (saved.query.length > 60 ? "..." : ""),
      query: saved.query,
      category: "saved",
      icon: <BookmarkIcon className="h-4 w-4" />,
      isPinned: saved.is_pinned,
    });
  });

  // Group by category
  const tableCommands = commands.filter((c) => c.category === "table");
  const historyCommands = commands.filter((c) => c.category === "history");
  const savedCommands = commands.filter((c) => c.category === "saved");

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
    >
      <CommandInput placeholder="Search for tables, commands, or recent queries..." />
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
