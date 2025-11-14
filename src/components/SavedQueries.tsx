interface SavedQuery {
  id: number;
  name: string;
  query: string;
  description: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface SavedQueriesProps {
  queries: SavedQuery[];
  onSelectQuery: (query: string) => void;
  onDeleteQuery: (id: number) => void;
  onTogglePin: (id: number) => void;
}

export function SavedQueries({
  queries,
  onSelectQuery,
  onDeleteQuery,
  onTogglePin,
}: SavedQueriesProps) {
  const pinnedQueries = queries.filter((q) => q.is_pinned);
  const unpinnedQueries = queries.filter((q) => !q.is_pinned);

  const renderQuery = (savedQuery: SavedQuery) => (
    <div
      key={savedQuery.id}
      className="group p-3 hover:bg-gray-700 rounded cursor-pointer border-b border-gray-700 last:border-b-0"
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex-1 min-w-0"
          onClick={() => onSelectQuery(savedQuery.query)}
        >
          <div className="flex items-center gap-2">
            {savedQuery.is_pinned && (
              <span className="text-yellow-500 text-xs">📌</span>
            )}
            <p className="text-sm font-medium truncate">{savedQuery.name}</p>
          </div>
          {savedQuery.description && (
            <p className="text-xs text-gray-400 mt-1 truncate">
              {savedQuery.description}
            </p>
          )}
          <p className="text-xs font-mono text-gray-500 mt-1 truncate">
            {savedQuery.query}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(savedQuery.id);
            }}
            className="text-gray-400 hover:text-yellow-500 text-xs px-1"
            title={savedQuery.is_pinned ? "Unpin" : "Pin"}
          >
            {savedQuery.is_pinned ? "📌" : "📍"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteQuery(savedQuery.id);
            }}
            className="text-gray-400 hover:text-red-400 text-xs px-1"
            title="Delete"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm">Saved Queries</h2>
        <span className="text-xs text-gray-500">{queries.length}</span>
      </div>

      {queries.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-4">
          No saved queries yet
        </p>
      ) : (
        <div className="max-h-96 overflow-y-auto space-y-0">
          {pinnedQueries.length > 0 && (
            <div className="mb-2">
              {pinnedQueries.map(renderQuery)}
            </div>
          )}
          {pinnedQueries.length > 0 && unpinnedQueries.length > 0 && (
            <div className="border-t border-gray-700 my-2"></div>
          )}
          {unpinnedQueries.map(renderQuery)}
        </div>
      )}
    </div>
  );
}
