import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "./components/ui/sidebar";
import { AppSidebar } from "./components/layout/AppSidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./components/ui/resizable";
import { Button } from "./components/ui/button";
import { Separator } from "./components/ui/separator";
import { Badge } from "./components/ui/badge";
import { ScrollArea, ScrollBar } from "./components/ui/scroll-area";
import {
  Play,
  Save,
  Settings as SettingsIcon,
  Download,
  Lock,
  Unlock,
  LayoutGrid,
  Command,
} from "lucide-react";
import { SqlEditor } from "./components/editor/SqlEditor";
import { ResultsTableEnhanced } from "./components/results/ResultsTableEnhanced";
import { SaveQueryModal } from "./components/modals/SaveQueryModal";
import { CommandPalette } from "./components/modals/CommandPalette";
import { ProjectSettings } from "./components/modals/ProjectSettings";
import { ConnectionModal } from "./components/modals/ConnectionModal";
import { Settings } from "./components/modals/Settings";
import type {
  DatabaseSchema,
  ConnectionConfig,
  QueryResult,
  QueryHistoryEntry,
  SavedQuery,
} from "./types";
import { DEFAULT_CONNECTION } from "./constants";

export default function AppNew() {
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [availableSchemas, setAvailableSchemas] = useState<string[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<string>("public");
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [history, setHistory] = useState<QueryHistoryEntry[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [vimMode, setVimMode] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [readOnlyMode, setReadOnlyMode] = useState(false);
  const [layoutDirection, setLayoutDirection] = useState<
    "vertical" | "horizontal"
  >("vertical");
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(
    null,
  );
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | null>(null);

  const [config, setConfig] = useState<ConnectionConfig>(DEFAULT_CONNECTION);

  const [connected, setConnected] = useState(false);
  const connectedRef = useRef(false);
  const [query, setQuery] = useState("SELECT * FROM users LIMIT 100;");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [insertAtCursor, setInsertAtCursor] = useState<
    ((text: string) => void) | null
  >(null);
  const [insertSnippet, setInsertSnippet] = useState<
    ((snippet: string) => void) | null
  >(null);

  useEffect(() => {
    async function initialize() {
      try {
        await invoke("load_project_settings");
      } catch (error) {
        console.error("Failed to load project settings:", error);
      }

      await loadSavedConnections();
      loadQueryHistory();
      loadSavedQueries();
      loadCurrentProjectPath();

      // Check if auto-connect is enabled
      try {
        const autoConnectEnabled = await invoke<boolean>("get_auto_connect_enabled");
        const lastConnectionName = await invoke<string | null>("get_last_connection");

        console.log("Auto-connect check:", { autoConnectEnabled, lastConnectionName });

        if (autoConnectEnabled && lastConnectionName) {
          // Try to auto-connect
          const savedConns = await invoke<ConnectionConfig[]>("load_connections");
          const lastConn = savedConns.find((c) => c.name === lastConnectionName);

          console.log("Found connection:", lastConn);

          if (lastConn) {
            // Load password from keychain (or use empty string if no password)
            const password = await invoke<string | null>("get_connection_password", {
              name: lastConnectionName,
            });

            console.log("Password retrieved:", password ? "yes" : "no (using empty string)");

            // Use password from keychain, or empty string if none stored
            const connWithPassword = { ...lastConn, password: password || "" };
            setConfig(connWithPassword);
            setReadOnlyMode(lastConn.readOnly || false);

            // Auto-connect
            setLoading(true);
            try {
              const result = await invoke<string>("test_postgres_connection", {
                config: connWithPassword,
              });
              setStatus(`Auto-connected: ${result}`);
              setConnected(true);
              connectedRef.current = true;

              // Load available schemas
              const schemas = await invoke<string[]>("get_database_schemas", {
                config: connWithPassword,
              });
              setAvailableSchemas(schemas);

              // Load schema (default to 'public')
              const dbSchema = await invoke<DatabaseSchema>("get_database_schema", {
                config: connWithPassword,
                schema: "public",
              });
              setSchema(dbSchema);
              setSelectedSchema("public");
            } catch (error) {
              setStatus(`Auto-connect failed: ${error}`);
              setConnected(false);
              connectedRef.current = false;
              setSchema(null);
            } finally {
              setLoading(false);
            }
          } else {
            console.warn("Connection not found:", lastConnectionName);
          }
        }
      } catch (error) {
        console.error("Auto-connect failed:", error);
      }
    }
    initialize();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K: Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
      // Cmd+,: Settings
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setShowSettings((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const loadCurrentProjectPath = useCallback(async () => {
    try {
      const path = await invoke<string | null>("get_current_project_path");
      setCurrentProjectPath(path);
    } catch (error) {
      console.error("Failed to load project path:", error);
    }
  }, []);

  const loadSavedConnections = useCallback(async () => {
    try {
      const saved = await invoke<ConnectionConfig[]>("load_connections");
      setConnections(saved);
    } catch (error) {
      console.error("Failed to load connections:", error);
    }
  }, []);

  const loadQueryHistory = useCallback(async () => {
    try {
      const hist = await invoke<QueryHistoryEntry[]>("get_query_history", {
        limit: 20,
      });
      setHistory(hist);
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  }, []);

  const loadSavedQueries = useCallback(async () => {
    try {
      const queries = await invoke<SavedQuery[]>("get_saved_queries");
      setSavedQueries(queries);
    } catch (error) {
      console.error("Failed to load saved queries:", error);
    }
  }, []);

  const handleSaveQuery = useCallback(
    async (name: string, description: string) => {
      try {
        await invoke("save_query", {
          name,
          query,
          description: description || null,
        });
        await loadSavedQueries();
        setStatus(`Query "${name}" saved successfully`);
        setShowSaveModal(false);
      } catch (error) {
        setStatus(`Failed to save query: ${error}`);
      }
    },
    [query, loadSavedQueries],
  );

  const handleDeleteSavedQuery = useCallback(
    async (id: number) => {
      try {
        await invoke("delete_saved_query", { id });
        await loadSavedQueries();
        setStatus("Query deleted");
      } catch (error) {
        setStatus(`Failed to delete query: ${error}`);
      }
    },
    [loadSavedQueries],
  );

  const handleTogglePin = useCallback(
    async (id: number) => {
      try {
        await invoke("toggle_pin_query", { id });
        await loadSavedQueries();
      } catch (error) {
        setStatus(`Failed to toggle pin: ${error}`);
      }
    },
    [loadSavedQueries],
  );

  const handleSaveConnection = useCallback(
    async (connection: ConnectionConfig) => {
      try {
        // Save password to keychain if provided
        console.log('connection password is:', connection.password);
        if (connection.password) {
          await invoke("save_connection_password", {
            name: connection.name,
            password: connection.password,
          });
        }

        // Add or update connection in list
        const existing = connections.find((c) => c.name === connection.name);
        let updated: ConnectionConfig[];

        if (existing) {
          updated = connections.map((c) =>
            c.name === connection.name ? { ...connection, password: "" } : c,
          );
        } else {
          updated = [...connections, { ...connection, password: "" }];
        }

        await invoke("save_connections", { connections: updated });
        setConnections(updated);
        setConfig(connection);
        setStatus(`Connection "${connection.name}" saved successfully`);
        setShowConnectionModal(false);
        setEditingConnection(null);
      } catch (error) {
        setStatus(`Failed to save connection: ${error}`);
      }
    },
    [connections],
  );

  const handleDeleteConnection = useCallback(
    async (name: string) => {
      try {
        const updated = connections.filter((c) => c.name !== name);

        // Delete from keychain
        await invoke("delete_connection_password", { name });

        // Delete from JSON
        await invoke("save_connections", { connections: updated });
        setConnections(updated);
        setStatus(`Connection "${name}" deleted`);
      } catch (error) {
        setStatus(`Failed to delete connection: ${error}`);
      }
    },
    [connections],
  );

  const handleEditConnection = useCallback((connection: ConnectionConfig) => {
    setEditingConnection(connection);
    setShowConnectionModal(true);
  }, []);

  const runQuery = useCallback(async () => {
    if (!connectedRef.current) {
      setStatus("Please connect to a database first");
      return;
    }

    if (!query.trim()) {
      setStatus("Please enter a query");
      return;
    }

    // Read-only mode validation
    if (readOnlyMode) {
      const trimmedQuery = query.trim().toUpperCase();
      const allowedCommands = ['SELECT', 'DESCRIBE', 'DESC', 'SHOW', 'EXPLAIN'];
      const isAllowed = allowedCommands.some(cmd => trimmedQuery.startsWith(cmd));

      if (!isAllowed) {
        setStatus("❌ Read-only mode: Only SELECT, DESCRIBE, and SHOW queries are allowed");
        return;
      }
    }

    setLoading(true);
    setStatus("");

    try {
      const queryResult = await invoke<QueryResult>("execute_query", {
        config,
        query,
      });

      setResult(queryResult);
      setStatus(
        `Query executed successfully - ${queryResult.row_count} rows in ${queryResult.execution_time_ms}ms`,
      );

      // Save to history
      await invoke("save_query_to_history", {
        query,
        connectionName: config.name,
        executionTimeMs: queryResult.execution_time_ms,
        rowCount: queryResult.row_count,
      });

      await loadQueryHistory();
    } catch (error) {
      setStatus(`Error executing query: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [config, query, loadQueryHistory, readOnlyMode]);

  const handleProjectPathChanged = useCallback(async () => {
    await loadCurrentProjectPath();
    await loadSavedConnections();
    await loadQueryHistory();
    await loadSavedQueries();
    setStatus("Project location changed - data reloaded");
  }, [
    loadCurrentProjectPath,
    loadSavedConnections,
    loadQueryHistory,
    loadSavedQueries,
  ]);

  const handleTableClick = useCallback((tableName: string) => {
    setQuery(`SELECT * FROM ${tableName} LIMIT 100;`);
  }, []);

  const handleTableInsert = useCallback((tableName: string) => {
    if (insertSnippet) {
      const snippet = `INSERT INTO ${tableName} (\${1:column1}, \${2:column2}) VALUES (\${3:value1}, \${4:value2});`;
      insertSnippet(snippet);
    } else {
      setQuery(`INSERT INTO ${tableName} (column1, column2) VALUES (value1, value2);`);
    }
  }, [insertSnippet]);

  const handleTableUpdate = useCallback((tableName: string) => {
    if (insertSnippet) {
      const snippet = `UPDATE ${tableName} SET \${1:column1} = \${2:value1} WHERE \${3:condition};`;
      insertSnippet(snippet);
    } else {
      setQuery(`UPDATE ${tableName} SET column1 = value1 WHERE condition;`);
    }
  }, [insertSnippet]);

  const handleTableDelete = useCallback((tableName: string) => {
    if (insertSnippet) {
      const snippet = `DELETE FROM ${tableName} WHERE \${1:condition};`;
      insertSnippet(snippet);
    } else {
      setQuery(`DELETE FROM ${tableName} WHERE condition;`);
    }
  }, [insertSnippet]);

  const handleColumnClick = useCallback(
    (tableName: string, columnName: string) => {
      if (insertAtCursor) {
        insertAtCursor(`${tableName}.${columnName}`);
      }
    },
    [insertAtCursor],
  );

  const handleClearHistory = useCallback(async () => {
    try {
      await invoke("clear_query_history");
      await loadQueryHistory();
      setStatus("History cleared");
    } catch (error) {
      setStatus(`Failed to clear history: ${error}`);
    }
  }, [loadQueryHistory]);

  const handleConnectionChange = useCallback(async (value: string) => {
    // Handle "New Connection" option
    if (value === "__new__") {
      setShowConnectionModal(true);
      return;
    }

    const conn = connections.find((c) => c.name === value);
    if (conn) {
      setConfig(conn);
      // Set read-only mode based on connection setting
      setReadOnlyMode(conn.readOnly || false);
      // Auto-connect when switching connections
      setLoading(true);
      setStatus("");
      try {
        const result = await invoke<string>("test_postgres_connection", {
          config: conn,
        });
        setStatus(result);
        setConnected(true);
        connectedRef.current = true;

        // Load available schemas
        const schemas = await invoke<string[]>("get_database_schemas", {
          config: conn,
        });
        setAvailableSchemas(schemas);

        // Load schema after successful connection (default to 'public')
        const dbSchema = await invoke<DatabaseSchema>("get_database_schema", {
          config: conn,
          schema: "public",
        });
        setSchema(dbSchema);
        setSelectedSchema("public");

        // Save as last connection for auto-connect
        await invoke("set_last_connection", { connectionName: conn.name });
      } catch (error) {
        setStatus(`Connection failed: ${error}`);
        setConnected(false);
        connectedRef.current = false;
        setSchema(null);
      } finally {
        setLoading(false);
      }
    }
  }, [connections]);

  const handleExecuteFromPalette = useCallback(
    (q: string) => {
      setQuery(q);
      setShowCommandPalette(false);
      runQuery();
    },
    [runQuery],
  );

  const handleSchemaChange = useCallback(async (schemaName: string) => {
    if (!connected || !config) return;

    setSelectedSchema(schemaName);
    setLoading(true);

    try {
      const dbSchema = await invoke<DatabaseSchema>("get_database_schema", {
        config,
        schema: schemaName,
      });
      setSchema(dbSchema);
      setStatus(`Loaded schema: ${schemaName}`);
    } catch (error) {
      setStatus(`Failed to load schema ${schemaName}: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [connected, config]);

  const exportToCSV = useCallback(() => {
    if (!result) return;

    // Create CSV header
    const csv = [
      result.columns.join(","),
      ...result.rows.map((row) =>
        row
          .map((cell) => {
            // Handle null, quotes, and commas
            if (cell === null) return "";
            const str = String(cell);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(","),
      ),
    ].join("\n");

    // Create download link
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `query_results_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [result]);

  const exportToJSON = useCallback(() => {
    if (!result) return;

    // Convert rows to objects with column names as keys
    const data = result.rows.map((row) => {
      const obj: any = {};
      result.columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });

    const json = JSON.stringify(data, null, 2);

    // Create download link
    const blob = new Blob([json], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `query_results_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [result]);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar
          schema={schema}
          availableSchemas={availableSchemas}
          selectedSchema={selectedSchema}
          onSchemaChange={handleSchemaChange}
          history={history}
          savedQueries={savedQueries}
          connections={connections}
          currentConnection={config}
          onConnectionChange={handleConnectionChange}
          onTableClick={handleTableClick}
          onColumnClick={handleColumnClick}
          onSelectQuery={setQuery}
          onDeleteQuery={handleDeleteSavedQuery}
          onTogglePin={handleTogglePin}
          onClearHistory={handleClearHistory}
          onNewConnection={() => setShowConnectionModal(true)}
          onTableInsert={handleTableInsert}
          onTableUpdate={handleTableUpdate}
          onTableDelete={handleTableDelete}
        />

        <SidebarInset className="flex flex-col">
          {/* Header */}
          <header className="flex h-14 items-center gap-3 border-b px-4">
            {/* Left side */}
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-6" />

            {/* Connection status */}
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`h-2 w-2 rounded-full p-0 ${
                  connected ? "bg-green-500" : "bg-gray-500"
                }`}
              />
              <span className="text-sm font-medium">
                {config.name || "No connection"}
              </span>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Read-only mode toggle */}
            <Button
              variant={readOnlyMode ? "default" : "ghost"}
              size="sm"
              onClick={() => setReadOnlyMode(!readOnlyMode)}
              title={
                readOnlyMode ? "Read-only mode active" : "Enable read-only mode"
              }
              className="h-8 gap-2"
            >
              {readOnlyMode ? (
                <Lock className="h-3 w-3" />
              ) : (
                <Unlock className="h-3 w-3" />
              )}
              <span className="text-xs">Read-only</span>
            </Button>

            {/* Right side */}
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setLayoutDirection(
                    layoutDirection === "vertical" ? "horizontal" : "vertical",
                  )
                }
                title={`Switch to ${layoutDirection === "vertical" ? "horizontal" : "vertical"} layout`}
                className="h-8 w-8"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCommandPalette(true)}
                className="h-8 gap-1.5"
              >
                <Command className="h-3 w-3" />
                <span className="text-xs font-mono">K</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
                className="h-8 w-8"
                title="Settings (⌘,)"
              >
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* Main Content with Resizable Panels */}
          <div className="flex-1 overflow-hidden">
            <ResizablePanelGroup direction={layoutDirection}>
              {/* SQL Editor Panel */}
              <ResizablePanel defaultSize={50} minSize={30}>
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b px-4 py-2">
                    <h3 className="text-sm font-medium">Query Editor</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={vimMode ? "default" : "outline"}
                        size="sm"
                        onClick={() => setVimMode(!vimMode)}
                        title="Toggle Vim mode"
                      >
                        <span className="text-xs font-mono">VIM</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSaveModal(true)}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        onClick={runQuery}
                        disabled={loading}
                        className="gap-2"
                      >
                        <Play className="h-3 w-3" />
                        Run Query
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1">
                    <SqlEditor
                      value={query}
                      onChange={setQuery}
                      onRunQuery={runQuery}
                      schema={schema}
                      onEditorReady={(insertAt, insertSnip) => {
                        setInsertAtCursor(() => insertAt);
                        setInsertSnippet(() => insertSnip);
                      }}
                      vimMode={vimMode}
                    />
                  </div>
                  {status && (
                    <div className="border-t px-4 py-2 text-xs text-muted-foreground">
                      {status}
                    </div>
                  )}
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Results Panel */}
              <ResizablePanel defaultSize={50} minSize={30}>
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b px-4 py-2">
                    <h3 className="text-sm font-medium">Results</h3>
                    {result && (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {result.row_count} rows
                        </Badge>
                        <Badge variant="secondary">
                          {result.execution_time_ms}ms
                        </Badge>
                        <Button
                          variant={compactView ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCompactView(!compactView)}
                          title="Toggle compact view"
                        >
                          <span className="text-xs">Compact</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={exportToCSV}
                          title="Export as CSV"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          CSV
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={exportToJSON}
                          title="Export as JSON"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          JSON
                        </Button>
                      </div>
                    )}
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-4">
                      <ResultsTableEnhanced
                        result={result}
                        compact={compactView}
                      />
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </SidebarInset>
      </div>

      {/* Modals */}
      <SaveQueryModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveQuery}
        currentQuery={query}
      />

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        schema={schema}
        history={history}
        onExecuteQuery={handleExecuteFromPalette}
      />

      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentProjectPath={currentProjectPath}
        onProjectPathChange={handleProjectPathChanged}
        vimMode={vimMode}
        onVimModeChange={setVimMode}
        compactView={compactView}
        onCompactViewChange={setCompactView}
        layoutDirection={layoutDirection}
        onLayoutDirectionChange={setLayoutDirection}
        connections={connections}
        onDeleteConnection={handleDeleteConnection}
        onEditConnection={handleEditConnection}
        onNewConnection={() => {
          setEditingConnection(null);
          setShowConnectionModal(true);
        }}
      />

      <ProjectSettings
        isOpen={showProjectPicker}
        onClose={() => setShowProjectPicker(false)}
        onPathChanged={handleProjectPathChanged}
        currentPath={currentProjectPath}
      />

      <ConnectionModal
        isOpen={showConnectionModal}
        onClose={() => {
          setShowConnectionModal(false);
          setEditingConnection(null);
        }}
        onSave={handleSaveConnection}
        initialConnection={editingConnection}
      />
    </SidebarProvider>
  );
}
