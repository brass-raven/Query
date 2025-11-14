interface QueryHistoryEntry {
  id: number;
  query: string;
  connection_name: string;
  execution_time_ms: number;
  row_count: number;
  executed_at: string;
}

interface QueryHistoryProps {
  history: QueryHistoryEntry[];
  onSelectQuery: (query: string) => void;
  onClearHistory: () => void;
}

export function QueryHistory({ history, onSelectQuery, onClearHistory }: QueryHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h2 className="font-semibold text-sm mb-3">Query History</h2>
        <p className="text-xs text-gray-500 text-center py-4">
          No queries yet
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm">Query History</h2>
        <button
          onClick={onClearHistory}
          className="text-xs text-red-400 hover:text-red-300"
        >
          Clear
        </button>
      </div>
      
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {history.map((entry) => (
          <div
            key={entry.id}
            onClick={() => onSelectQuery(entry.query)}
            className="p-2 bg-gray-900 rounded hover:bg-gray-700 transition cursor-pointer"
          >
            <p className="text-xs font-mono text-gray-300 truncate mb-1">
              {entry.query}
            </p>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{entry.connection_name}</span>
              <span>{entry.execution_time_ms}ms • {entry.row_count} rows</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
