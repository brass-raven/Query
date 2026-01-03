import { useState, useCallback, useRef } from "react";
import {
  testPostgresConnection,
  getDatabaseSchema,
  getDatabaseSchemas,
  getConnectionPassword,
  setLastConnection,
  getAutoConnectEnabled,
  getLastConnection,
  loadConnections,
} from "../utils/tauri";
import { DEFAULT_CONNECTION } from "../constants";
import type { ConnectionConfig, DatabaseSchema } from "../types";

interface UseConnectionReturn {
  // State
  config: ConnectionConfig;
  setConfig: (config: ConnectionConfig) => void;
  connected: boolean;
  connectedRef: React.MutableRefObject<boolean>;
  schema: DatabaseSchema | null;
  availableSchemas: string[];
  selectedSchema: string;
  loading: boolean;
  status: string;
  setStatus: (status: string) => void;

  // Operations
  connect: (connection: ConnectionConfig) => Promise<boolean>;
  disconnect: () => void;
  switchConnection: (connectionName: string, connections: ConnectionConfig[]) => Promise<void>;
  switchSchema: (schemaName: string) => Promise<void>;
  autoConnect: () => Promise<void>;
  clearSchema: () => void;
}

export function useConnection(): UseConnectionReturn {
  const [config, setConfig] = useState<ConnectionConfig>(DEFAULT_CONNECTION);
  const [connected, setConnected] = useState(false);
  const connectedRef = useRef(false);
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [availableSchemas, setAvailableSchemas] = useState<string[]>([]);
  const [selectedSchema, setSelectedSchema] = useState("public");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const connect = useCallback(async (connection: ConnectionConfig): Promise<boolean> => {
    setLoading(true);
    setStatus("");

    try {
      const result = await testPostgresConnection(connection);
      setStatus(result);
      setConnected(true);
      connectedRef.current = true;
      setConfig(connection);

      // Load available schemas
      const schemas = await getDatabaseSchemas(connection);
      setAvailableSchemas(schemas);

      // Load default schema
      const dbSchema = await getDatabaseSchema(connection, "public");
      setSchema(dbSchema);
      setSelectedSchema("public");

      return true;
    } catch (error) {
      setStatus(`Connection failed: ${error}`);
      setConnected(false);
      connectedRef.current = false;
      setSchema(null);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setConnected(false);
    connectedRef.current = false;
    setSchema(null);
    setAvailableSchemas([]);
    setSelectedSchema("public");
  }, []);

  const switchConnection = useCallback(async (
    connectionName: string,
    connections: ConnectionConfig[]
  ) => {
    const conn = connections.find((c) => c.name === connectionName);
    if (!conn) return;

    // Fetch password from keychain
    const password = await getConnectionPassword(conn.name);
    const connWithPassword = { ...conn, password: password || "" };

    const success = await connect(connWithPassword);
    if (success) {
      await setLastConnection(conn.name);
    }
  }, [connect]);

  const switchSchema = useCallback(async (schemaName: string) => {
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

  const autoConnect = useCallback(async () => {
    try {
      const autoConnectEnabled = await getAutoConnectEnabled();
      const lastConnectionName = await getLastConnection();

      if (!autoConnectEnabled || !lastConnectionName) return;

      const savedConns = await loadConnections();
      const lastConn = savedConns.find((c) => c.name === lastConnectionName);

      if (!lastConn) {
        console.warn("Connection not found:", lastConnectionName);
        return;
      }

      const password = await getConnectionPassword(lastConnectionName);
      const connWithPassword = { ...lastConn, password: password || "" };

      setLoading(true);
      try {
        const result = await testPostgresConnection(connWithPassword);
        setStatus(`Auto-connected: ${result}`);
        setConnected(true);
        connectedRef.current = true;
        setConfig(connWithPassword);

        const schemas = await getDatabaseSchemas(connWithPassword);
        setAvailableSchemas(schemas);

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
    } catch (error) {
      console.error("Auto-connect failed:", error);
    }
  }, []);

  const clearSchema = useCallback(() => {
    setSchema(null);
    setAvailableSchemas([]);
  }, []);

  return {
    config,
    setConfig,
    connected,
    connectedRef,
    schema,
    availableSchemas,
    selectedSchema,
    loading,
    status,
    setStatus,
    connect,
    disconnect,
    switchConnection,
    switchSchema,
    autoConnect,
    clearSchema,
  };
}
