import { useState, useEffect, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { DEFAULTS, UI_LAYOUT, READ_ONLY_COMMANDS, ERROR_MESSAGES, MACOS_TITLEBAR_LEFT_PADDING } from "./constants";
import {
  saveConnectionPassword,
  getConnectionPassword,
  deleteConnectionPassword,
  testPostgresConnection,
  getDatabaseSchema,
  getDatabaseSchemas,
  executeQuery,
  loadConnections,
  saveConnections,
  getQueryHistory,
  saveQueryToHistory,
  clearQueryHistory,
  getSavedQueries,
  saveQuery,
  deleteSavedQuery,
  togglePinQuery,
  getCurrentProjectPath,
  setProjectPath,
  getAppDir,
  getAutoConnectEnabled,
  getLastConnection,
  setLastConnection,
  getRecentProjects,
  loadProjectSettings,
  getVimModeEnabled,
  setVimModeEnabled,
} from "./utils/tauri";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import {
  Play,
  Save,
  Settings as SettingsIcon,
  Download,
  Lock,
  Unlock,
  LayoutGrid,
  Command,
  Maximize,
  Minimize,
  Plus,
  Database,
  Folder,
  GitCompareArrows,
  Wand2,
} from "lucide-react";
import { SqlEditor } from "./components/editor/SqlEditor";
import { ResultsTableEnhanced } from "./components/results/ResultsTableEnhanced";
import { ErdDiagram } from "./components/erd/ErdDiagram";
import { SaveQueryModal } from "./components/modals/SaveQueryModal";
import { CommandPalette } from "./components/modals/CommandPalette";
import { QueryBuilder } from "./components/modals/QueryBuilder";
import { ProjectSettings } from "./components/modals/ProjectSettings";
import { ConnectionModal } from "./components/modals/ConnectionModal";
import { Settings } from "./components/modals/Settings";
import { SchemaComparisonPage } from "./components/comparison/SchemaComparisonPage";
import type {
  DatabaseSchema,
  ConnectionConfig,
  QueryResult,
  QueryHistoryEntry,
  SavedQuery,
  RecentProject,
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
  const [showQueryBuilder, setShowQueryBuilder] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSchemaComparison, setShowSchemaComparison] = useState(false);
  const [vimMode, setVimMode] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [fullScreenResults, setFullScreenResults] = useState(false);
  const [readOnlyMode, setReadOnlyMode] = useState(false);
  const [showErd, setShowErd] = useState(false);
  const [layoutDirection, setLayoutDirection] = useState<
    "vertical" | "horizontal"
  >("vertical");
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(
    null,
  );
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | null>(null);

  const [config, setConfig] = useState<ConnectionConfig>(DEFAULT_CONNECTION);

  const [connected, setConnected] = useState(false);
  const connectedRef = useRef(false);
  const [query, setQuery] = useState(`SELECT * FROM users LIMIT ${DEFAULTS.QUERY_LIMIT};`);
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
        await loadProjectSettings();
      } catch (error) {
        console.error("Failed to load project settings:", error);
      }

      await loadSavedConnections();
      loadQueryHistory().catch((err) => console.error("Failed to load query history:", err));
      loadSavedQueries().catch((err) => console.error("Failed to load saved queries:", err));
      loadCurrentProjectPath().catch((err) => console.error("Failed to load current project path:", err));
      loadRecentProjects().catch((err) => console.error("Failed to load recent projects:", err));

      // Load vim mode setting
      try {
        const vimEnabled = await getVimModeEnabled();
        setVimMode(vimEnabled);
      } catch (error) {
        console.error("Failed to load vim mode setting:", error);
      }

      // Check if auto-connect is enabled
      try {
        const autoConnectEnabled = await getAutoConnectEnabled();
        const lastConnectionName = await getLastConnection();

        if (autoConnectEnabled && lastConnectionName) {
          // Try to auto-connect
          const savedConns = await loadConnections();
          const lastConn = savedConns.find((c) => c.name === lastConnectionName);

          if (lastConn) {
            // Load password from keychain (or use empty string if no password)
            const password = await getConnectionPassword(lastConnectionName);

            // Use password from keychain, or empty string if none stored
            const connWithPassword = { ...lastConn, password: password || "" };
            setConfig(connWithPassword);
            setReadOnlyMode(lastConn.readOnly || false);

            // Auto-connect
            setLoading(true);
            try {
              const result = await testPostgresConnection(connWithPassword);
              setStatus(`Auto-connected: ${result}`);
              setConnected(true);
              connectedRef.current = true;

              // Load available schemas
              const schemas = await getDatabaseSchemas(connWithPassword);
              setAvailableSchemas(schemas);

              // Load schema (default to 'public')
              const dbSchema = await getDatabaseSchema(connWithPassword, "public");
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
      // Cmd+B: Query Builder
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setShowQueryBuilder((prev) => !prev);
      }
      // Cmd+,: Settings
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setShowSettings((prev) => !prev);
      }
      // Cmd+Shift+F: Toggle full-screen results
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setFullScreenResults((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Listen for menu events to reveal project directory
  useEffect(() => {
    const unlisten = listen("reveal-project-directory", async () => {
      try {
        const path = currentProjectPath || `${await getAppDir()}/.query`;
        await revealItemInDir(path);
      } catch (error) {
        console.error("Failed to reveal project directory:", error);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [currentProjectPath]);

  const loadCurrentProjectPath = useCallback(async () => {
    try {
      const path = await getCurrentProjectPath();
      setCurrentProjectPath(path);
    } catch (error) {
      console.error("Failed to load project path:", error);
    }
  }, []);

  const loadRecentProjects = useCallback(async () => {
    try {
      const projects = await getRecentProjects();
      setRecentProjects(projects);
    } catch (error) {
      console.error("Failed to load recent projects:", error);
    }
  }, []);

  const loadSavedConnections = useCallback(async () => {
    try {
      const saved = await loadConnections();
      setConnections(saved);
    } catch (error) {
      console.error("Failed to load connections:", error);
    }
  }, []);

  const loadQueryHistory = useCallback(async () => {
    try {
      const hist = await getQueryHistory(DEFAULTS.HISTORY_LIMIT);
      setHistory(hist);
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  }, []);

  const loadSavedQueries = useCallback(async () => {
    try {
      const queries = await getSavedQueries();
      setSavedQueries(queries);
    } catch (error) {
      console.error("Failed to load saved queries:", error);
    }
  }, []);

  const handleSaveQuery = useCallback(
    async (name: string, description: string) => {
      try {
        await saveQuery(name, query, description || null);
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
        await deleteSavedQuery(id);
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
        await togglePinQuery(id);
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
        if (connection.password) {
          await saveConnectionPassword(connection.name, connection.password);
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

        await saveConnections(updated);
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
        await deleteConnectionPassword(name);

        // Delete from JSON
        await saveConnections(updated);
        setConnections(updated);
        setStatus(`Connection "${name}" deleted`);
      } catch (error) {
        setStatus(`Failed to delete connection: ${error}`);
      }
    },
    [connections],
  );

  const handleEditConnection = useCallback(async (connection: ConnectionConfig) => {
    // Fetch password from keychain
    try {
      const password = await getConnectionPassword(connection.name);
      const connWithPassword = { ...connection, password: password || "" };
      setEditingConnection(connWithPassword);
      setShowConnectionModal(true);
    } catch (err) {
      console.error('Error retrieving password from keychain:', err);
      // Still open modal but without password
      setEditingConnection(connection);
      setShowConnectionModal(true);
    }
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
      const isAllowed = READ_ONLY_COMMANDS.some(cmd => trimmedQuery.startsWith(cmd));

      if (!isAllowed) {
        setStatus(ERROR_MESSAGES.READ_ONLY_MODE);
        return;
      }
    }

    setLoading(true);
    setStatus("");

    try {
      const queryResult = await executeQuery(config, query);

      setResult(queryResult);
      setStatus("Query executed successfully");

      // Save to history
      await saveQueryToHistory(
        query,
        config.name,
        queryResult.execution_time_ms,
        queryResult.row_count
      );

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
    setQuery(`SELECT * FROM ${tableName} LIMIT ${DEFAULTS.QUERY_LIMIT};`);
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
      await clearQueryHistory();
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
      // Fetch password from keychain
      const password = await getConnectionPassword(conn.name);
      const connWithPassword = { ...conn, password: password || "" };

      setConfig(connWithPassword);
      // Set read-only mode based on connection setting
      setReadOnlyMode(conn.readOnly || false);
      // Auto-connect when switching connections
      setLoading(true);
      setStatus("");
      try {
        const result = await testPostgresConnection(connWithPassword);
        setStatus(result);
        setConnected(true);
        connectedRef.current = true;

        // Load available schemas
        const schemas = await getDatabaseSchemas(connWithPassword);
        setAvailableSchemas(schemas);

        // Load schema after successful connection (default to 'public')
        const dbSchema = await getDatabaseSchema(connWithPassword, "public");
        setSchema(dbSchema);
        setSelectedSchema("public");

        // Save as last connection for auto-connect
        await setLastConnection(conn.name);
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

  const handleProjectChange = useCallback(async (path: string) => {
    try {
      // Set the new project path
      await setProjectPath(path);

      // Update current project path
      setCurrentProjectPath(path);

      // Reload all project-specific data
      await loadSavedConnections();
      loadQueryHistory().catch((err) => console.error("Failed to load query history:", err));
      loadSavedQueries().catch((err) => console.error("Failed to load saved queries:", err));
      loadRecentProjects().catch((err) => console.error("Failed to load recent projects:", err));

      // Clear current connection and schema
      setConnected(false);
      connectedRef.current = false;
      setSchema(null);
      setResult(null);
      setStatus(`Switched to project: ${path}`);
    } catch (error) {
      setStatus(`Failed to switch project: ${error}`);
      console.error("Failed to switch project:", error);
    }
  }, [loadSavedConnections, loadQueryHistory, loadSavedQueries, loadRecentProjects]);

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
      const dbSchema = await getDatabaseSchema(config, schemaName);
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
      const obj: Record<string, unknown> = {};
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

  // Render full-page schema comparison if active
  if (showSchemaComparison) {
    return (
      <SchemaComparisonPage
        connections={connections}
        onClose={() => setShowSchemaComparison(false)}
      />
    );
  }

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
          onTableClick={handleTableClick}
          onColumnClick={handleColumnClick}
          onSelectQuery={setQuery}
          onDeleteQuery={handleDeleteSavedQuery}
          onTogglePin={handleTogglePin}
          onClearHistory={handleClearHistory}
          onTableInsert={handleTableInsert}
          onTableUpdate={handleTableUpdate}
          onTableDelete={handleTableDelete}
        />

        <SidebarInset className="flex flex-col">
          {/* Header */}
          <header
            data-tauri-drag-region
            className="flex h-9 items-center gap-2 border-b px-3"
            style={{ paddingLeft: `${MACOS_TITLEBAR_LEFT_PADDING}px` }}
          >
            {/* Left side */}
            <div data-tauri-drag-region="false">
              <SidebarTrigger />
            </div>
            <Separator orientation="vertical" className="h-5" />

            {/* Environment/Connection Dropdown */}
            <div data-tauri-drag-region="false" className="min-w-[180px]">
              <Select value={config.name} onValueChange={handleConnectionChange}>
                <SelectTrigger className="h-7 border-none shadow-none text-sm font-medium hover:bg-accent">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`h-2 w-2 rounded-full p-0 ${
                        connected ? "bg-green-500" : "bg-gray-500"
                      }`}
                    />
                    <SelectValue placeholder="No connection" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {connections.map((conn) => (
                    <SelectItem key={conn.name} value={conn.name}>
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            conn.name === config.name
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

            <Separator orientation="vertical" className="h-5" />

            {/* Project Selector Dropdown */}
            <div data-tauri-drag-region="false" className="min-w-[150px]">
              <Select
                value={currentProjectPath || "default"}
                onValueChange={(value) => {
                  if (value === "__browse__") {
                    // Open file picker for browsing
                    import("@tauri-apps/plugin-dialog")
                      .then(({ open }) => {
                        return open({
                          directory: true,
                          multiple: false,
                          title: "Select Project Directory",
                        }).then((selected) => {
                          if (selected) {
                            handleProjectChange(selected);
                          }
                        });
                      })
                      .catch((err) => {
                        console.error("Failed to open file dialog:", err);
                        setStatus("Failed to open file dialog");
                      });
                  } else if (value !== "default") {
                    handleProjectChange(value);
                  }
                }}
              >
                <SelectTrigger className="h-7 border-none shadow-none text-sm hover:bg-accent">
                  <div className="flex items-center gap-2">
                    <Folder className="h-3 w-3 text-muted-foreground" />
                    <SelectValue placeholder="Project" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {recentProjects.length > 0 ? (
                    recentProjects.map((project) => (
                      <SelectItem key={project.path} value={project.path}>
                        {project.name || project.path.split("/").pop() || "Project"}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="default" disabled>
                      <span className="text-xs text-muted-foreground">No recent projects</span>
                    </SelectItem>
                  )}
                  <SelectItem value="__browse__">
                    <div className="flex items-center gap-2">
                      <Folder className="h-3 w-3" />
                      <span>Browse...</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator orientation="vertical" className="h-5" />

            {/* Read-only mode toggle */}
            <div data-tauri-drag-region="false">
              <Button
                variant={readOnlyMode ? "default" : "ghost"}
                size="sm"
                onClick={() => setReadOnlyMode(!readOnlyMode)}
                title={
                  readOnlyMode ? "Read-only mode active" : "Enable read-only mode"
                }
                className="h-7 gap-1.5"
              >
                {readOnlyMode ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  <Unlock className="h-3 w-3" />
                )}
                <span className="text-xs">Read-only</span>
              </Button>
            </div>

            {/* Right side */}
            <div className="ml-auto flex items-center gap-1.5" data-tauri-drag-region="false">
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setLayoutDirection(
                    layoutDirection === "vertical" ? "horizontal" : "vertical",
                  )
                }
                title={`Switch to ${layoutDirection === "vertical" ? "horizontal" : "vertical"} layout`}
                className="h-7 w-7"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={showErd ? "default" : "ghost"}
                size="icon"
                onClick={() => setShowErd(!showErd)}
                title="Toggle ERD (Entity Relationship Diagram)"
                className="h-7 w-7"
              >
                <Database className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCommandPalette(true)}
                className="h-7 gap-1.5"
              >
                <Command className="h-3 w-3" />
                <span className="text-xs font-mono">K</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQueryBuilder(true)}
                className="h-7 gap-1.5"
                title="Query Builder"
              >
                <Wand2 className="h-3 w-3" />
                <span className="text-xs">Build</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSchemaComparison(true)}
                className="h-7 w-7"
                title="Compare Schemas"
              >
                <GitCompareArrows className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
                className="h-7 w-7"
                title="Settings (⌘,)"
              >
                <SettingsIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
          </header>

          {/* Main Content with Resizable Panels */}
          <div className="flex-1 overflow-hidden">
            <ResizablePanelGroup direction={layoutDirection}>
              {/* SQL Editor Panel - Hidden in full-screen mode */}
              {!fullScreenResults && (
                <>
                  <ResizablePanel defaultSize={UI_LAYOUT.DEFAULT_PANEL_SIZE} minSize={UI_LAYOUT.MIN_PANEL_SIZE}>
                    <div className="flex h-full flex-col min-h-0">
                      <div className="flex items-center justify-between border-b px-4 py-2">
                        <h3 className="text-sm font-medium">Query Editor</h3>
                        <div className="flex items-center gap-2">
                          <Button
                            variant={vimMode ? "default" : "outline"}
                            size="sm"
                            onClick={async () => {
                              const newVimMode = !vimMode;
                              setVimMode(newVimMode);
                              try {
                                await setVimModeEnabled(newVimMode);
                              } catch (error) {
                                console.error("Failed to save vim mode setting:", error);
                              }
                            }}
                            title="Toggle Vim mode"
                          >
                            <span className="text-xs font-mono">VIM</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowSaveModal(true)}
                            title="Save Query"
                          >
                            <Save className="h-3 w-3 mr-1" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={runQuery}
                            disabled={loading}
                            className="gap-2"
                            title="Run Query"
                          >
                            <Play className="h-3 w-3" />
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
                </>
              )}

              {/* Results Panel */}
              <ResizablePanel defaultSize={fullScreenResults ? 100 : UI_LAYOUT.DEFAULT_PANEL_SIZE} minSize={UI_LAYOUT.MIN_PANEL_SIZE}>
                <div className="flex h-full flex-col min-h-0">
                  <div className="flex items-center justify-between border-b px-4 py-2">
                    <h3 className="text-sm font-medium">{showErd ? "ERD" : "Results"}</h3>
                    {result && !showErd && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant={fullScreenResults ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFullScreenResults(!fullScreenResults)}
                          title="Toggle full-screen results (Cmd+Shift+F)"
                        >
                          {fullScreenResults ? (
                            <Minimize className="h-3 w-3" />
                          ) : (
                            <Maximize className="h-3 w-3" />
                          )}
                        </Button>
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
                  {showErd ? (
                    <ErdDiagram schema={schema} />
                  ) : (
                    <ResultsTableEnhanced
                      result={result}
                      compact={compactView}
                      config={config}
                      schema={schema}
                      originalQuery={query}
                      onRefresh={runQuery}
                    />
                  )}
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
        savedQueries={savedQueries}
        onExecuteQuery={handleExecuteFromPalette}
      />

      <QueryBuilder
        isOpen={showQueryBuilder}
        onClose={() => setShowQueryBuilder(false)}
        schema={schema}
        onExecuteQuery={(query) => {
          setQuery(query);
          runQuery();
        }}
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
