import { useState, useEffect, useRef } from "react";
import { SqlEditor } from "./components/SqlEditor";
import { invoke } from "@tauri-apps/api/core";
import { ResultsTable } from "./components/ResultsTable";
import { QueryHistory } from "./components/QueryHistory";
import { SchemaExplorer } from "./components/SchemaExplorer";
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

interface ConnectionConfig {
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

interface QueryResult {
  columns: string[];
  rows: any[][];
  row_count: number;
  execution_time_ms: number;
}

interface QueryHistoryEntry {
  id: number;
  query: string;
  connection_name: string;
  execution_time_ms: number;
  row_count: number;
  executed_at: string;
}

function App() {
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [selectedConnection, setSelectedConnection] =
    useState<ConnectionConfig | null>(null);
  const [history, setHistory] = useState<QueryHistoryEntry[]>([]);

  const [config, setConfig] = useState<ConnectionConfig>({
    name: "New Connection",
    host: "localhost",
    port: 5432,
    database: "querytest",
    username: "postgres",
    password: "",
  });

  const [connected, setConnected] = useState(false);
  const connectedRef = useRef(false);
  const [query, setQuery] = useState("SELECT * FROM users;");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showNewConnection, setShowNewConnection] = useState(false);
  const [insertAtCursor, setInsertAtCursor] = useState<((text: string) => void) | null>(null);

  useEffect(() => {
    loadSavedConnections();
    loadQueryHistory();
  }, []);

  async function loadSavedConnections() {
    try {
      const saved = await invoke<ConnectionConfig[]>("load_connections");
      setConnections(saved);
    } catch (error) {
      console.error("Failed to load connections:", error);
    }
  }

  async function loadQueryHistory() {
    try {
      const hist = await invoke<QueryHistoryEntry[]>("get_query_history", {
        limit: 20,
      });
      setHistory(hist);
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  }

  async function saveConnection() {
    // Never save passwords - strip it out for security
    const { password, ...configWithoutPassword } = config;
    const updated = [...connections, configWithoutPassword as ConnectionConfig];
    setConnections(updated);

    try {
      await invoke("save_connections", { connections: updated });
      setStatus(`Saved connection "${config.name}"`);
      setShowNewConnection(false);
    } catch (error) {
      setStatus(`Failed to save: ${error}`);
    }
  }

  async function deleteConnection(name: string) {
    const updated = connections.filter((c) => c.name !== name);
    setConnections(updated);

    try {
      await invoke("save_connections", { connections: updated });
      setStatus(`Deleted connection "${name}"`);
    } catch (error) {
      setStatus(`Failed to delete: ${error}`);
    }
  }

  function selectConnection(conn: ConnectionConfig) {
    setConfig({ ...conn, password: "" });
    setSelectedConnection(conn);
    setShowNewConnection(false);
    setConnected(false);
    connectedRef.current = false;
  }

  async function testConnection() {
    setLoading(true);
    setStatus("");

    try {
      const result = await invoke<string>("test_postgres_connection", {
        config,
      });
      setStatus(result);
      setConnected(true);
      connectedRef.current = true;

      // Load schema after successful connection
      const schemaData = await invoke<DatabaseSchema>("get_database_schema", {
        config,
      });
      setSchema(schemaData);
    } catch (error) {
      setStatus(`${error}`);
      setConnected(false);
      connectedRef.current = false;
      setSchema(null);
    } finally {
      setLoading(false);
    }
  }

  function handleTableClick(tableName: string) {
    setQuery(`SELECT * FROM ${tableName} LIMIT 100;`);
  }

  function handleColumnClick(tableName: string, columnName: string) {
    // Insert column at cursor position in query
    const textToInsert = `${tableName}.${columnName}`;
    if (insertAtCursor) {
      insertAtCursor(textToInsert);
    } else {
      // Fallback to append if editor not ready
      setQuery((prev) => `${prev}${textToInsert}`);
    }
  }
  async function executeQuery() {
    if (!connectedRef.current) {
      // ← Change from connected to connectedRef.current
      setStatus("Please connect to a database first");
      return;
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

      // Reload history
      await loadQueryHistory();
    } catch (error) {
      setStatus(`${error}`);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function clearHistory() {
    try {
      await invoke("clear_query_history");
      setHistory([]);
      setStatus("History cleared");
    } catch (error) {
      setStatus(`Failed to clear history: ${error}`);
    }
  }

  function selectQueryFromHistory(selectedQuery: string) {
    setQuery(selectedQuery);
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Query</h1>
          <p className="text-gray-400 text-sm">Fast PostgreSQL client</p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="col-span-3 space-y-4">
            {/* Connections */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm">Connections</h2>
                <button
                  onClick={() => setShowNewConnection(!showNewConnection)}
                  className="text-blue-400 hover:text-blue-300 text-xl"
                >
                  +
                </button>
              </div>

              <div className="space-y-2">
                {connections.map((conn) => (
                  <div
                    key={conn.name}
                    className="flex items-center justify-between p-2 bg-gray-900 rounded hover:bg-gray-700 transition cursor-pointer"
                    onClick={() => selectConnection(conn)}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{conn.name}</p>
                      <p className="text-xs text-gray-400">
                        {conn.host}:{conn.port}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConnection(conn.name);
                      }}
                      className="text-red-400 hover:text-red-300 text-xs px-2"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {connections.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-4">
                    No saved connections
                  </p>
                )}
              </div>
            </div>

            {/* Connection Form */}
            {(showNewConnection ||
              selectedConnection ||
              connections.length === 0) && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-sm">
                    {showNewConnection
                      ? "New Connection"
                      : "Connection Details"}
                  </h2>
                  {connected && (
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={config.name}
                      onChange={(e) =>
                        setConfig({ ...config, name: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-sm bg-gray-900 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Host
                    </label>
                    <input
                      type="text"
                      value={config.host}
                      onChange={(e) =>
                        setConfig({ ...config, host: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-sm bg-gray-900 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Port
                    </label>
                    <input
                      type="number"
                      value={config.port}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          port: parseInt(e.target.value) || 5432,
                        })
                      }
                      className="w-full px-3 py-1.5 text-sm bg-gray-900 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Database
                    </label>
                    <input
                      type="text"
                      value={config.database}
                      onChange={(e) =>
                        setConfig({ ...config, database: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-sm bg-gray-900 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={config.username}
                      onChange={(e) =>
                        setConfig({ ...config, username: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-sm bg-gray-900 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={config.password}
                      onChange={(e) =>
                        setConfig({ ...config, password: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-sm bg-gray-900 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                      placeholder="Enter password"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={testConnection}
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium disabled:opacity-50 transition"
                    >
                      {loading ? "Connecting..." : "Connect"}
                    </button>

                    {showNewConnection && (
                      <button
                        onClick={saveConnection}
                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium transition"
                      >
                        Save
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Query History */}
            <QueryHistory
              history={history}
              onSelectQuery={selectQueryFromHistory}
              onClearHistory={clearHistory}
            />
            {/* Schema Explorer */}
            <SchemaExplorer
              schema={schema}
              onTableClick={handleTableClick}
              onColumnClick={handleColumnClick}
            />
          </div>

          {/* Main Area */}
          <div className="col-span-9 space-y-4">
            {/* Query Editor */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold">Query Editor</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 bg-gray-900 rounded border border-gray-700">
                    ⌘ Enter
                  </kbd>{" "}
                  to run query
                </p>
              </div>
              <button
                onClick={executeQuery}
                disabled={loading || !connected}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium disabled:opacity-50 transition"
              >
                {loading ? "Running..." : "Run Query"}
              </button>
            </div>
            <div className="border border-gray-700 rounded overflow-hidden">
              <SqlEditor
                value={query}
                onChange={setQuery}
                onRunQuery={executeQuery}
                schema={schema}
                onEditorReady={(insertFn) => setInsertAtCursor(() => insertFn)}
              />
            </div>

            {status && (
              <div
                className={`mt-3 p-3 rounded text-sm ${
                  status.includes("Error") ||
                  status.includes("failed") ||
                  status.includes("Please")
                    ? "bg-red-900/20 border border-red-700 text-red-300"
                    : "bg-blue-900/20 border border-blue-700 text-blue-300"
                }`}
              >
                {status}
              </div>
            )}
          </div>

          {/* Results */}
          <div>
            <h2 className="font-semibold mb-3">Results</h2>
            <ResultsTable result={result} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
