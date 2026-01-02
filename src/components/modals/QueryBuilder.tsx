import { memo, useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "../ui/command";
import { Database, Type, Filter } from "lucide-react";
import type { DatabaseSchema } from "../../types";

interface QueryBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  schema: DatabaseSchema | null;
  onExecuteQuery: (query: string) => void;
}

interface ParsedInput {
  table?: string;
  operation?: string;
  columns?: string;
  where?: string;
  context: "table" | "operation" | "columns" | "where" | "value";
}

function parseInput(input: string, schema: DatabaseSchema | null): ParsedInput {
  const parts = input.trim().split(/\s+/);

  if (parts.length === 0 || !parts[0]) {
    return { context: "table" };
  }

  // Check if first word is a table name
  const possibleTable = parts[0];
  const isTable = schema?.tables.some(t => t.table_name.toLowerCase() === possibleTable.toLowerCase());

  if (!isTable) {
    return { context: "table" };
  }

  const table = possibleTable;

  if (parts.length === 1) {
    return { table, context: "operation" };
  }

  const operation = parts[1].toLowerCase();
  const validOps = ["select", "update", "delete", "insert"];

  if (!validOps.includes(operation)) {
    return { table, context: "operation" };
  }

  if (parts.length === 2) {
    return { table, operation, context: "columns" };
  }

  // Find where "where" keyword starts
  const whereIndex = parts.findIndex((p, i) => i > 1 && p.toLowerCase() === "where");

  if (whereIndex === -1) {
    // No WHERE yet, we're in columns
    const columns = parts.slice(2).join(" ");
    return { table, operation, columns, context: "columns" };
  }

  const columns = parts.slice(2, whereIndex).join(" ");
  const where = parts.slice(whereIndex + 1).join(" ");

  return { table, operation, columns, where, context: "where" };
}

function buildSQL(parsed: ParsedInput): string {
  if (!parsed.table || !parsed.operation) return "";

  const { table, operation, columns, where } = parsed;
  const cols = columns?.trim() || "*";
  const whereClause = where?.trim();

  switch (operation) {
    case "select":
      return `SELECT ${cols} FROM ${table}${whereClause ? ` WHERE ${whereClause}` : ""};`;
    case "update":
      return `UPDATE ${table} SET ${cols}${whereClause ? ` WHERE ${whereClause}` : ""};`;
    case "delete":
      return `DELETE FROM ${table}${whereClause ? ` WHERE ${whereClause}` : ""};`;
    case "insert":
      return `INSERT INTO ${table} (${cols}) VALUES ();`;
    default:
      return "";
  }
}

export const QueryBuilder = memo(function QueryBuilder({
  isOpen,
  onClose,
  schema,
  onExecuteQuery,
}: QueryBuilderProps) {
  const [input, setInput] = useState<string>("");

  // Reset when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setInput("");
    }
  }, [isOpen]);

  const parsed = useMemo(() => parseInput(input, schema), [input, schema]);
  const sqlPreview = useMemo(() => buildSQL(parsed), [parsed]);

  // Generate suggestions based on context
  const suggestions = useMemo(() => {
    if (!schema) return [];

    switch (parsed.context) {
      case "table":
        return schema.tables.map(t => ({
          value: t.table_name,
          label: t.table_name,
          description: `Table with ${t.columns.length} columns`,
          icon: <Database className="h-4 w-4" />,
        }));

      case "operation":
        return [
          { value: "select", label: "select", description: "Query data", icon: <Type className="h-4 w-4" /> },
          { value: "update", label: "update", description: "Update records", icon: <Type className="h-4 w-4" /> },
          { value: "delete", label: "delete", description: "Delete records", icon: <Type className="h-4 w-4" /> },
          { value: "insert", label: "insert", description: "Insert records", icon: <Type className="h-4 w-4" /> },
        ];

      case "columns":
      case "where":
        const table = schema.tables.find(t => t.table_name.toLowerCase() === parsed.table?.toLowerCase());
        if (!table) return [];

        return table.columns.map(col => ({
          value: col.column_name,
          label: col.column_name,
          description: col.data_type,
          icon: <Filter className="h-4 w-4" />,
        }));

      default:
        return [];
    }
  }, [schema, parsed]);

  const handleSelect = (value: string) => {
    const parts = input.trim().split(/\s+/);

    switch (parsed.context) {
      case "table":
        setInput(`${value} `);
        break;
      case "operation":
        setInput(`${parts[0]} ${value} `);
        break;
      case "columns":
      case "where":
        // Append column name
        setInput(`${input}${input.endsWith(" ") ? "" : " "}${value} `);
        break;
    }
  };

  const handleExecute = () => {
    if (sqlPreview && parsed.table) {
      onExecuteQuery(sqlPreview);
      onClose();
      setInput("");
    }
  };

  // Get current search term based on context
  const currentSearchTerm = useMemo(() => {
    const parts = input.trim().split(/\s+/);
    switch (parsed.context) {
      case "table":
        return parts[0] || "";
      case "operation":
        return parts[1] || "";
      case "columns":
      case "where":
        // Get the last word being typed
        return parts[parts.length - 1] || "";
      default:
        return "";
    }
  }, [input, parsed.context]);

  // Filter suggestions based on current search term
  const filteredSuggestions = useMemo(() => {
    if (!currentSearchTerm) return suggestions;
    const term = currentSearchTerm.toLowerCase();
    return suggestions.filter(s => s.label.toLowerCase().includes(term));
  }, [suggestions, currentSearchTerm]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] p-0">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle>Query Builder</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Type: table operation columns where condition
          </p>
        </DialogHeader>

        <Command shouldFilter={false}>
          <CommandInput
            placeholder={
              parsed.context === "table" ? "Type table name..." :
              parsed.context === "operation" ? "Type operation (select/update/delete/insert)..." :
              parsed.context === "columns" ? "Type column names or *..." :
              "Type WHERE clause..."
            }
            value={input}
            onValueChange={setInput}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                // Select first filtered suggestion on Tab
                if (filteredSuggestions.length > 0) {
                  handleSelect(filteredSuggestions[0].value);
                }
              } else if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (filteredSuggestions.length > 0) {
                  // If there are suggestions, don't execute - let user select
                  return;
                }
                handleExecute();
              }
            }}
          />
          <CommandList>
            <CommandEmpty>
              {sqlPreview ? (
                <div className="p-4">
                  <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                  <div className="bg-muted p-3 rounded-md font-mono text-sm">
                    {sqlPreview}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Press Enter to execute
                  </p>
                </div>
              ) : (
                <p className="text-sm">Start typing to build your query...</p>
              )}
            </CommandEmpty>
            {filteredSuggestions.length > 0 && (
              <CommandGroup heading={
                parsed.context === "table" ? "Tables" :
                parsed.context === "operation" ? "Operations" :
                "Columns"
              }>
                {filteredSuggestions.map((suggestion) => (
                  <CommandItem
                    key={suggestion.value}
                    value={suggestion.label}
                    onSelect={() => handleSelect(suggestion.value)}
                  >
                    {suggestion.icon}
                    <div className="flex flex-col">
                      <span className="font-medium">{suggestion.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {suggestion.description}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>

        {sqlPreview && (
          <div className="px-4 pb-4 pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1">SQL Preview:</p>
            <div className="bg-muted p-2 rounded-md font-mono text-xs">
              {sqlPreview}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});
