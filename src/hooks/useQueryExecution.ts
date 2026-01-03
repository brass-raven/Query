import { useState, useCallback } from "react";
import { executeQuery } from "../utils/tauri";
import { DEFAULTS, READ_ONLY_COMMANDS, ERROR_MESSAGES } from "../constants";
import type { ConnectionConfig, QueryResult } from "../types";

interface UseQueryExecutionReturn {
  // State
  query: string;
  setQuery: (query: string) => void;
  result: QueryResult | null;
  setResult: (result: QueryResult | null) => void;
  loading: boolean;

  // Editor callbacks
  insertAtCursor: ((text: string) => void) | null;
  setInsertAtCursor: (fn: ((text: string) => void) | null) => void;
  insertSnippet: ((snippet: string) => void) | null;
  setInsertSnippet: (fn: ((snippet: string) => void) | null) => void;

  // Operations
  runQuery: (
    config: ConnectionConfig,
    connectedRef: React.MutableRefObject<boolean>,
    readOnlyMode: boolean,
    onSuccess?: (result: QueryResult) => void
  ) => Promise<{ success: boolean; status: string }>;

  exportToCSV: () => void;
  exportToJSON: () => void;

  // Table helpers
  handleTableClick: (tableName: string) => void;
  handleTableInsert: (tableName: string) => void;
  handleTableUpdate: (tableName: string) => void;
  handleTableDelete: (tableName: string) => void;
  handleColumnClick: (tableName: string, columnName: string) => void;
}

export function useQueryExecution(): UseQueryExecutionReturn {
  const [query, setQuery] = useState(`SELECT * FROM users LIMIT ${DEFAULTS.QUERY_LIMIT};`);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [insertAtCursor, setInsertAtCursor] = useState<((text: string) => void) | null>(null);
  const [insertSnippet, setInsertSnippet] = useState<((snippet: string) => void) | null>(null);

  const runQuery = useCallback(async (
    config: ConnectionConfig,
    connectedRef: React.MutableRefObject<boolean>,
    readOnlyMode: boolean,
    onSuccess?: (result: QueryResult) => void
  ): Promise<{ success: boolean; status: string }> => {
    if (!connectedRef.current) {
      return { success: false, status: "Please connect to a database first" };
    }

    if (!query.trim()) {
      return { success: false, status: "Please enter a query" };
    }

    // Read-only mode validation
    if (readOnlyMode) {
      const trimmedQuery = query.trim().toUpperCase();
      const isAllowed = READ_ONLY_COMMANDS.some((cmd) => trimmedQuery.startsWith(cmd));

      if (!isAllowed) {
        return { success: false, status: ERROR_MESSAGES.READ_ONLY_MODE };
      }
    }

    setLoading(true);

    try {
      const queryResult = await executeQuery(config, query);
      setResult(queryResult);

      if (onSuccess) {
        onSuccess(queryResult);
      }

      return { success: true, status: "Query executed successfully" };
    } catch (error) {
      return { success: false, status: `Error executing query: ${error}` };
    } finally {
      setLoading(false);
    }
  }, [query]);

  const exportToCSV = useCallback(() => {
    if (!result) return;

    const csv = [
      result.columns.join(","),
      ...result.rows.map((row) =>
        row
          .map((cell) => {
            if (cell === null) return "";
            const str = String(cell);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `query_results_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [result]);

  const exportToJSON = useCallback(() => {
    if (!result) return;

    const data = result.rows.map((row) => {
      const obj: Record<string, unknown> = {};
      result.columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `query_results_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [result]);

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

  const handleColumnClick = useCallback((tableName: string, columnName: string) => {
    if (insertAtCursor) {
      insertAtCursor(`${tableName}.${columnName}`);
    }
  }, [insertAtCursor]);

  return {
    query,
    setQuery,
    result,
    setResult,
    loading,
    insertAtCursor,
    setInsertAtCursor: (fn) => setInsertAtCursor(() => fn),
    insertSnippet,
    setInsertSnippet: (fn) => setInsertSnippet(() => fn),
    runQuery,
    exportToCSV,
    exportToJSON,
    handleTableClick,
    handleTableInsert,
    handleTableUpdate,
    handleTableDelete,
    handleColumnClick,
  };
}
