import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";

interface QueryResult {
  columns: string[];
  rows: any[][];
  row_count: number;
  execution_time_ms: number;
}

interface ResultsTableEnhancedProps {
  result: QueryResult | null;
  compact?: boolean;
}

export function ResultsTableEnhanced({ result, compact = false }: ResultsTableEnhancedProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Transform data for TanStack Table
  const data = useMemo(() => {
    if (!result) return [];
    return result.rows.map((row) => {
      const obj: any = {};
      result.columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  }, [result]);

  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (!result) return [];
    return result.columns.map((col) => ({
      accessorKey: col,
      header: col,
      cell: (info) => {
        const value = info.getValue();
        if (value === null) return <span className="text-gray-500 italic">null</span>;
        if (typeof value === "boolean") return value ? "true" : "false";
        if (typeof value === "object") return JSON.stringify(value);
        return String(value);
      },
    }));
  }, [result]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (!result) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
        <p className="text-gray-500 text-sm">No results yet</p>
        <p className="text-gray-600 text-xs mt-2">Run a query to see results</p>
      </div>
    );
  }

  if (result.rows.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
        <p className="text-gray-400 text-sm">Query executed successfully</p>
        <p className="text-gray-500 text-xs mt-2">
          No rows returned • {result.execution_time_ms}ms
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      {/* Header with stats */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="text-sm">
          <span className="font-semibold">{result.row_count.toLocaleString()}</span>
          <span className="text-gray-400 ml-1">
            {result.row_count === 1 ? "row" : "rows"}
          </span>
          <span className="text-gray-600 mx-2">•</span>
          <span className="text-gray-400">{result.execution_time_ms}ms</span>
        </div>
        {!compact && (
          <div className="text-xs text-gray-500">
            {table.getFilteredRowModel().rows.length !== result.row_count && (
              <span>
                Showing {table.getFilteredRowModel().rows.length} of{" "}
                {result.row_count} rows
              </span>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className={`overflow-auto ${compact ? "max-h-64" : "max-h-96"}`}>
        <table className="w-full text-sm">
          <thead className="bg-gray-900 sticky top-0">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2 text-left text-xs font-semibold text-gray-400 border-b border-gray-700"
                  >
                    {header.isPlaceholder ? null : (
                      <div>
                        <div
                          className={`flex items-center gap-2 ${
                            header.column.getCanSort()
                              ? "cursor-pointer select-none hover:text-gray-200"
                              : ""
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {{
                            asc: " ↑",
                            desc: " ↓",
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                        {!compact && header.column.getCanFilter() && (
                          <input
                            type="text"
                            value={
                              (header.column.getFilterValue() as string) ?? ""
                            }
                            onChange={(e) =>
                              header.column.setFilterValue(e.target.value)
                            }
                            placeholder="Filter..."
                            className="mt-1 w-full px-2 py-1 text-xs bg-gray-800 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-gray-700 hover:bg-gray-700/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-4 py-2 text-gray-300 font-mono text-xs max-w-md truncate"
                    title={String(cell.getValue() ?? "")}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
