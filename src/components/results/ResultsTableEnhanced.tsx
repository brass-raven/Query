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
  RowSelectionState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { EyeOff, Search, X, Copy, CheckSquare } from "lucide-react";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { IndeterminateCheckbox } from "../ui/indeterminate-checkbox";
import { cn } from "@/lib/utils";
import type { QueryResult } from '../../types';

interface ResultsTableEnhancedProps {
  result: QueryResult | null;
  compact?: boolean;
}

export const ResultsTableEnhanced = memo(function ResultsTableEnhanced({ result, compact = false }: ResultsTableEnhancedProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
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

    const selectColumn: ColumnDef<any> = {
      id: 'select',
      header: ({ table }) => (
        <IndeterminateCheckbox
          checked={table.getIsAllRowsSelected()}
          indeterminate={table.getIsSomeRowsSelected()}
          onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
        />
      ),
      cell: ({ row }) => (
        <div className="px-1">
          <IndeterminateCheckbox
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
          />
        </div>
      ),
      size: 40,
      enableSorting: false,
      enableHiding: false,
    };

    const dataColumns = result.columns.map((col) => ({
      accessorKey: col,
      header: col,
      cell: (info: any) => {
        const value = info.getValue();
        if (value === null) return <span className="text-gray-500 italic">null</span>;
        if (typeof value === "boolean") return value ? "true" : "false";
        if (typeof value === "object") return JSON.stringify(value);
        return String(value);
      },
      filterFn: (row: any, columnId: string, filterValue: any) => {
        const value = row.getValue(columnId);
        if (value === null || value === undefined) return false;

        // Convert both to strings for comparison (handles numbers, booleans, etc.)
        const stringValue = String(value).toLowerCase();
        const stringFilter = String(filterValue).toLowerCase();

        return stringValue.includes(stringFilter);
      },
    }));

    return [selectColumn, ...dataColumns];
  }, [result]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
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
  }, [columnFilters, sorting, globalFilter]);

  // Keyboard shortcuts for selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentSelectedCount = Object.keys(rowSelection).filter(key => rowSelection[key]).length;

      // Cmd+A: Select all visible rows (only when table container is focused or in view)
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && tableContainerRef.current) {
        const isTableInFocus = tableContainerRef.current.contains(document.activeElement);
        if (isTableInFocus) {
          e.preventDefault();
          table.toggleAllRowsSelected(true);
        }
      }
      // Escape: Clear selection
      if (e.key === 'Escape' && currentSelectedCount > 0) {
        setRowSelection({});
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [table, rowSelection]);

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

  const activeFilterCount = columnFilters.length + (globalFilter ? 1 : 0);
  const selectedRowCount = Object.keys(rowSelection).filter(key => rowSelection[key]).length;
  const totalRowCount = rows.length;

  // Helper to get selected row data
  const getSelectedRowsData = () => {
    return rows
      .filter((row) => row.getIsSelected())
      .map((row) => row.original);
  };

  // Copy to clipboard function
  const copyToClipboard = async (text: string, format: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // TODO: Add toast notification
      console.log(`Copied ${selectedRowCount} rows as ${format}`);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  // Copy as CSV
  const copyAsCSV = () => {
    if (!result) return;
    const selectedData = getSelectedRowsData();
    const csv = [
      result.columns.join(','),
      ...selectedData.map((row: any) =>
        result.columns.map((col) => {
          const value = row[col];
          if (value === null) return '';
          if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
          return value;
        }).join(',')
      )
    ].join('\n');
    copyToClipboard(csv, 'CSV');
  };

  // Copy as JSON
  const copyAsJSON = () => {
    const selectedData = getSelectedRowsData();
    const json = JSON.stringify(selectedData, null, 2);
    copyToClipboard(json, 'JSON');
  };

  return (
    <div className="rounded-lg border flex flex-col flex-1 min-h-0">
      {/* Header with stats, search, and controls */}
      <div className="px-4 py-2 border-b bg-muted/50 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {rows.length.toLocaleString()} rows • {result.execution_time_ms}ms
            {activeFilterCount > 0 && (
              <span className="ml-2 text-primary">
                ({activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setGlobalFilter('');
                  setColumnFilters([]);
                }}
              >
                Clear filters
              </Button>
            )}
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
        </div>
        {/* Global search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search all columns..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-7 pl-7 pr-7 text-xs"
          />
          {globalFilter && (
            <button
              onClick={() => setGlobalFilter('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Selection action bar - only shown when rows are selected */}
        {selectedRowCount > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-primary/5 border-t">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-primary/20 text-primary">
                {selectedRowCount} of {totalRowCount} rows selected
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={copyAsCSV}
                title="Copy selected rows as CSV"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy CSV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={copyAsJSON}
                title="Copy selected rows as JSON"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy JSON
              </Button>
              {selectedRowCount < totalRowCount && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => table.toggleAllRowsSelected(true)}
                  title="Select all rows"
                >
                  <CheckSquare className="h-3 w-3 mr-1" />
                  Select All
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setRowSelection({})}
                title="Clear selection"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>
      {/* Table */}
      <div
        ref={tableContainerRef}
        className="overflow-auto flex-1"
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
                  className={cn(
                    "border border-gray-700 hover:bg-gray-700/50 transition-colors",
                    row.getIsSelected() && "bg-primary/10 border-primary/30"
                  )}
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
