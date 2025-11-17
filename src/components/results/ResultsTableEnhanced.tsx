import { useMemo, useState, memo, useRef, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { EyeOff } from "lucide-react";
import type { QueryResult } from '../../types';

interface ResultsTableEnhancedProps {
  result: QueryResult | null;
  compact?: boolean;
}

export const ResultsTableEnhanced = memo(function ResultsTableEnhanced({ result, compact = false }: ResultsTableEnhancedProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const tableContainerRef = useRef<HTMLDivElement>(null);

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
      filterFn: (row, columnId, filterValue) => {
        const value = row.getValue(columnId);
        if (value === null || value === undefined) return false;

        // Convert both to strings for comparison (handles numbers, booleans, etc.)
        const stringValue = String(value).toLowerCase();
        const stringFilter = String(filterValue).toLowerCase();

        return stringValue.includes(stringFilter);
      },
    }));
  }, [result]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // Set up row virtualization
  const { rows } = table.getRowModel();
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 33, // Estimated row height in pixels
    overscan: 10, // Render 10 extra rows above and below viewport
  });

  // Scroll to top when filters or sorting changes
  useEffect(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = 0;
    }
  }, [columnFilters, sorting]);

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

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0)
      : 0;

  return (
    <div className="rounded-lg border flex flex-col flex-1 min-h-0">
      {/* Header with stats and column toggle */}
      <div className="px-4 py-2 border-b flex items-center justify-between bg-muted/50">
        <div className="text-xs text-muted-foreground">
          {rows.length.toLocaleString()} rows • {result.execution_time_ms}ms
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-2">
              <EyeOff className="h-3 w-3" />
              <span className="text-xs">Columns</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize text-xs"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Table */}
      <div
        ref={tableContainerRef}
        className={`overflow-auto ${compact ? "max-h-64" : "max-h-96"} border-b`}
      >
        <table className="w-full text-sm border-collapse">
          <thead className="bg-background sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2 text-left text-xs font-semibold text-gray-400 border border-gray-700"
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
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: `${paddingTop}px` }} />
              </tr>
            )}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <tr
                  key={row.id}
                  className="border border-gray-700 hover:bg-gray-700/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-2 text-gray-300 font-mono text-xs max-w-md truncate border"
                      title={String(cell.getValue() ?? "")}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: `${paddingBottom}px` }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});
