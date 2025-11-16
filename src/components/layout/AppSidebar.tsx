import { memo, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarGroup,
  SidebarGroupContent,
  SidebarRail,
} from "../ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ScrollArea } from "../ui/scroll-area";
import {
  GitBranch,
  Plus,
  Minus,
  ChevronRight,
  Database,
  History as HistoryIcon,
  BookmarkIcon,
} from "lucide-react";
import { Kbd } from "../ui/kbd";
import type {
  DatabaseSchema,
  QueryHistoryEntry,
  SavedQuery,
  ConnectionConfig,
} from "../../types";

interface AppSidebarProps {
  schema: DatabaseSchema | null;
  availableSchemas: string[];
  selectedSchema: string;
  onSchemaChange: (schema: string) => void;
  history: QueryHistoryEntry[];
  savedQueries: SavedQuery[];
  connections: ConnectionConfig[];
  currentConnection: ConnectionConfig;
  onConnectionChange: (name: string) => void;
  onTableClick: (tableName: string) => void;
  onColumnClick: (tableName: string, columnName: string) => void;
  onSelectQuery: (query: string) => void;
  onDeleteQuery: (id: number) => void;
  onTogglePin: (id: number) => void;
  onClearHistory: () => void;
  onNewConnection: () => void;
  onTableInsert?: (tableName: string) => void;
  onTableUpdate?: (tableName: string) => void;
  onTableDelete?: (tableName: string) => void;
}

// Helper to get query type tag
function getQueryTag(query: string): { label: string; className: string } {
  const normalizedQuery = query.trim().toUpperCase();
  if (normalizedQuery.startsWith("SELECT")) {
    return {
      label: "SEL",
      className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    };
  } else if (normalizedQuery.startsWith("INSERT")) {
    return {
      label: "INS",
      className: "bg-green-500/20 text-green-400 border-green-500/30",
    };
  } else if (normalizedQuery.startsWith("UPDATE")) {
    return {
      label: "UPD",
      className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    };
  } else if (normalizedQuery.startsWith("DELETE")) {
    return {
      label: "DEL",
      className: "bg-red-500/20 text-red-400 border-red-500/30",
    };
  }
  return {
    label: "SQL",
    className: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
}

export const AppSidebar = memo(function AppSidebar({
  schema,
  availableSchemas,
  selectedSchema,
  onSchemaChange,
  history,
  savedQueries,
  connections,
  currentConnection,
  onConnectionChange,
  onTableClick,
  onColumnClick,
  onSelectQuery,
  onDeleteQuery,
  onTogglePin,
  onClearHistory,
  onTableInsert,
  onTableUpdate,
  onTableDelete,
}: AppSidebarProps) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const toggleTable = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  const pinnedQueries = savedQueries.filter((q) => q.is_pinned);
  const unpinnedQueries = savedQueries.filter((q) => !q.is_pinned);

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-3 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Database className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Query</h2>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Environment</div>
          <Select value={currentConnection.name} onValueChange={onConnectionChange}>
            <SelectTrigger className="w-full h-8">
              <SelectValue placeholder="Select connection" />
            </SelectTrigger>
            <SelectContent>
              {connections.map((conn) => (
                <SelectItem key={conn.name} value={conn.name}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        conn.name === currentConnection.name
                          ? "bg-green-500"
                          : "bg-gray-500"
                      }`}
                    />
                    {conn.name}
                  </div>
                </SelectItem>
              ))}
              <SelectItem value="__new__">
                <div className="flex items-center gap-2">
                  <Plus className="h-3 w-3" />
                  <span>New Connection</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="h-[calc(100vh-240px)]">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Schema Selector */}
                {availableSchemas.length > 0 && (
                  <SidebarMenuItem className="mb-2">
                    <Select value={selectedSchema} onValueChange={onSchemaChange}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select schema" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSchemas.map((schema) => (
                          <SelectItem key={schema} value={schema} className="text-xs">
                            {schema}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </SidebarMenuItem>
                )}

                {/* Tables Section */}
                <Collapsible defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton>
                        <Database className="h-4 w-4" />
                        <span>Tables</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {schema?.tables.length || 0}
                        </span>
                        <Plus className="ml-2 h-4 w-4 group-data-[state=open]/collapsible:hidden" />
                        <Minus className="ml-2 h-4 w-4 group-data-[state=closed]/collapsible:hidden" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {schema && schema.tables.length > 0 ? (
                          schema.tables.map((table) => (
                            <Collapsible
                              key={table.table_name}
                              open={expandedTables.has(table.table_name)}
                              onOpenChange={() => toggleTable(table.table_name)}
                              className="group/table"
                            >
                              <SidebarMenuSubItem>
                                <CollapsibleTrigger asChild>
                                  <SidebarMenuSubButton>
                                    <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]/table:rotate-90" />
                                    <span className="font-mono text-xs">
                                      {table.table_name}
                                    </span>
                                    <span className="ml-auto text-xs text-muted-foreground">
                                      {table.columns.length}
                                    </span>
                                  </SidebarMenuSubButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="ml-6 mt-1 space-y-1">
                                    {/* Quick Actions */}
                                    <div className="flex gap-1 px-2">
                                      <Kbd
                                        className="cursor-pointer hover:bg-blue-500/30 text-[10px] px-1.5 py-0 h-5 bg-blue-500/20 text-blue-400 border border-blue-500/30 pointer-events-auto"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onTableClick(table.table_name);
                                        }}
                                      >
                                        SEL
                                      </Kbd>
                                      <Kbd
                                        className="cursor-pointer hover:bg-green-500/30 text-[10px] px-1.5 py-0 h-5 bg-green-500/20 text-green-400 border border-green-500/30 pointer-events-auto"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onTableInsert?.(table.table_name);
                                        }}
                                      >
                                        INS
                                      </Kbd>
                                      <Kbd
                                        className="cursor-pointer hover:bg-yellow-500/30 text-[10px] px-1.5 py-0 h-5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 pointer-events-auto"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onTableUpdate?.(table.table_name);
                                        }}
                                      >
                                        UPD
                                      </Kbd>
                                      <Kbd
                                        className="cursor-pointer hover:bg-red-500/30 text-[10px] px-1.5 py-0 h-5 bg-red-500/20 text-red-400 border border-red-500/30 pointer-events-auto"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onTableDelete?.(table.table_name);
                                        }}
                                      >
                                        DEL
                                      </Kbd>
                                    </div>
                                    {/* Columns */}
                                    {table.columns.map((col) => (
                                      <div
                                        key={col.column_name}
                                        className="flex items-center justify-between px-2 py-1 hover:bg-muted rounded cursor-pointer text-xs"
                                        onClick={() =>
                                          onColumnClick(
                                            table.table_name,
                                            col.column_name,
                                          )
                                        }
                                      >
                                        <span className="font-mono text-muted-foreground">
                                          {col.column_name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {col.data_type}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </SidebarMenuSubItem>
                            </Collapsible>
                          ))
                        ) : (
                          <div className="px-4 py-2 text-xs text-muted-foreground text-center">
                            Connect to see tables
                          </div>
                        )}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>

                {/* Saved Queries Section */}
                <Collapsible className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton>
                        <BookmarkIcon className="h-4 w-4" />
                        <span>Saved Queries</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {savedQueries.length}
                        </span>
                        <Plus className="ml-2 h-4 w-4 group-data-[state=open]/collapsible:hidden" />
                        <Minus className="ml-2 h-4 w-4 group-data-[state=closed]/collapsible:hidden" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {savedQueries.length === 0 ? (
                          <div className="px-4 py-2 text-xs text-muted-foreground text-center">
                            No saved queries
                          </div>
                        ) : (
                          <>
                            {pinnedQueries.map((savedQuery) => {
                              const tag = getQueryTag(savedQuery.query);
                              return (
                                <SidebarMenuSubItem key={savedQuery.id}>
                                  <SidebarMenuSubButton
                                    onClick={() => onSelectQuery(savedQuery.query)}
                                  >
                                    <Kbd
                                      className={`text-[10px] px-1.5 py-0 h-4 ${tag.className} border`}
                                    >
                                      {tag.label}
                                    </Kbd>
                                    {savedQuery.is_pinned && (
                                      <span className="text-yellow-500 text-xs">📌</span>
                                    )}
                                    <span className="flex-1 min-w-0 truncate text-xs">
                                      {savedQuery.name}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onTogglePin(savedQuery.id);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 text-xs"
                                    >
                                      📍
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteQuery(savedQuery.id);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 text-xs hover:text-red-400"
                                    >
                                      ×
                                    </button>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                            {unpinnedQueries.map((savedQuery) => {
                              const tag = getQueryTag(savedQuery.query);
                              return (
                                <SidebarMenuSubItem key={savedQuery.id}>
                                  <SidebarMenuSubButton
                                    onClick={() => onSelectQuery(savedQuery.query)}
                                  >
                                    <Kbd
                                      className={`text-[10px] px-1.5 py-0 h-4 ${tag.className} border`}
                                    >
                                      {tag.label}
                                    </Kbd>
                                    <span className="flex-1 min-w-0 truncate text-xs">
                                      {savedQuery.name}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onTogglePin(savedQuery.id);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 text-xs"
                                    >
                                      📍
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteQuery(savedQuery.id);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 text-xs hover:text-red-400"
                                    >
                                      ×
                                    </button>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </>
                        )}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>

                {/* History Section */}
                <Collapsible className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton>
                        <HistoryIcon className="h-4 w-4" />
                        <span>History</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {history.length}
                        </span>
                        <Plus className="ml-2 h-4 w-4 group-data-[state=open]/collapsible:hidden" />
                        <Minus className="ml-2 h-4 w-4 group-data-[state=closed]/collapsible:hidden" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {history.length === 0 ? (
                          <div className="px-4 py-2 text-xs text-muted-foreground text-center">
                            No history yet
                          </div>
                        ) : (
                          <>
                            {history.map((entry) => (
                              <SidebarMenuSubItem key={entry.id}>
                                <SidebarMenuSubButton
                                  onClick={() => onSelectQuery(entry.query)}
                                  className="flex gap-2"
                                >
                                  <span className="flex-1 min-w-0 truncate text-xs font-mono">
                                    {entry.query}
                                  </span>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {entry.execution_time_ms}ms
                                  </span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton
                                onClick={onClearHistory}
                                className="text-xs text-red-400 hover:text-red-300"
                              >
                                Clear History
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          </>
                        )}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="border-t">
        {/* Git Info - TODO: Add interactive git actions later */}
        <div className="px-3 py-3">
          <div className="flex items-center gap-2 text-sm">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <div className="font-medium text-sm">main</div>
              <div className="text-xs text-muted-foreground">No changes</div>
            </div>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
});
