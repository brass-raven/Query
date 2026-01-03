import { useMemo, useState, memo, useRef, useEffect, useCallback } from "react";
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
  CellContext,
  Row,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { EyeOff, Search, X, Copy, CheckSquare, Edit3, Save } from "lucide-react";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { IndeterminateCheckbox } from "../ui/indeterminate-checkbox";
import { cn } from "@/lib/utils";
import type { QueryResult, ConnectionConfig, DatabaseSchema } from '../../types';
import { EditableCell } from './EditableCell';
import { executeQuery } from "../../utils/tauri";

// Type for row data (dynamic column names)
type RowData = Record<string, unknown>;

interface ResultsTableEnhancedProps {
  result: QueryResult | null;
  compact?: boolean;
  config?: ConnectionConfig;
  schema?: DatabaseSchema | null;
  originalQuery?: string;
  onRefresh?: () => void;
}

export const ResultsTableEnhanced = memo(function ResultsTableEnhanced({
  result,
  compact = false,
  config,
  schema,
  originalQuery,
  onRefresh,
}: ResultsTableEnhancedProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [editMode, setEditMode] = useState(false);
  const [dirtyData, setDirtyData] = useState<Map<number, Map<string, any>>>(new Map());
  const [savingChanges, setSavingChanges] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Handle cell update
  const handleCellUpdate = (rowIndex: number, columnId: string, value: any) => {
    setDirtyData((prev) => {
      const newMap = new Map(prev);
      if (!newMap.has(rowIndex)) {
        newMap.set(rowIndex, new Map());
      }
      newMap.get(rowIndex)!.set(columnId, value);
      return newMap;
    });
  };

  // Check if a cell is dirty
  const isCellDirty = (rowIndex: number, columnId: string): boolean => {
    return dirtyData.has(rowIndex) && dirtyData.get(rowIndex)!.has(columnId);
  };

  // Extract table name from query (simple heuristic)
  const getTableNameFromQuery = useCallback((query: string): string | null => {
    if (!query) return null;
    const match = query.match(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    return match ? match[1] : null;
  }, []);

  // Get primary key columns for the table
  const getPrimaryKeyColumns = useCallback((tableName: string): string[] => {
    if (!schema) return [];
    const table = schema.tables.find((t) => t.table_name === tableName);
    if (!table) return [];
    return table.columns.filter((col) => col.is_primary_key).map((col) => col.column_name);
  }, [schema]);

  // Check if editing is allowed
  const isEditingAllowed = useMemo(() => {
    if (!originalQuery || !schema || !config) return false;
    if (config.readOnly) return false;

    const tableName = getTableNameFromQuery(originalQuery);
    if (!tableName) return false;

    const pkColumns = getPrimaryKeyColumns(tableName);
    return pkColumns.length > 0;
  }, [originalQuery, schema, config, getTableNameFromQuery, getPrimaryKeyColumns]);

  // Generate UPDATE SQL for a row
  const generateUpdateSQL = (rowIndex: number, tableName: string, pkColumns: string[]): string => {
    if (!result || !dirtyData.has(rowIndex)) return '';

    const changedColumns = dirtyData.get(rowIndex)!;
    const rowData = data[rowIndex];

    // Build SET clause
    const setClause = Array.from(changedColumns.entries())
      .map(([col, val]) => {
        if (val === null) return `${col} = NULL`;
        if (typeof val === 'string') return `${col} = '${val.replace(/'/g, "''")}'`;
        if (typeof val === 'boolean') return `${col} = ${val}`;
        return `${col} = ${val}`;
      })
      .join(', ');

    // Build WHERE clause using primary keys
    const whereClause = pkColumns
      .map((pkCol) => {
        const val = rowData[pkCol];
        if (val === null) return `${pkCol} IS NULL`;
        if (typeof val === 'string') return `${pkCol} = '${val.replace(/'/g, "''")}'`;
        if (typeof val === 'boolean') return `${pkCol} = ${val}`;
        return `${pkCol} = ${val}`;
      })
      .join(' AND ');

    return `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause};`;
  };

  // Save all changes
  const saveChanges = async () => {
    if (!config || !originalQuery || !result || dirtyData.size === 0) return;

    const tableName = getTableNameFromQuery(originalQuery);
    if (!tableName) {
      console.error('Unable to determine table name from query');
      return;
    }

    const pkColumns = getPrimaryKeyColumns(tableName);
    if (pkColumns.length === 0) {
      console.error('Table has no primary key - cannot edit');
      return;
    }

    setSavingChanges(true);

    try {
      // Execute each UPDATE query
      let successCount = 0;
      for (const [rowIndex] of dirtyData.entries()) {
        const updateSQL = generateUpdateSQL(rowIndex, tableName, pkColumns);
        await executeQuery(config, updateSQL);
        successCount++;
      }

      // Clear dirty data
      setDirtyData(new Map());

      // Re-fetch results
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Error saving changes:', error);
    } finally {
      setSavingChanges(false);
    }
  };

  // Transform data for TanStack Table
  const data = useMemo<RowData[]>(() => {
    if (!result) return [];
    return result.rows.map((row) => {
      const obj: RowData = {};
      result.columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  }, [result]);

  const columns = useMemo<ColumnDef<RowData>[]>(() => {
    if (!result) return [];

    const selectColumn: ColumnDef<RowData> = {
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
      cell: (info: CellContext<RowData, unknown>) => {
        const originalValue = info.getValue();
        const rowIndex = info.row.index;
        const columnId = info.column.id;

        // Check if we have a dirty value for this cell
        const isDirty = isCellDirty(rowIndex, columnId);
        const value = isDirty ? dirtyData.get(rowIndex)!.get(columnId) : originalValue;

        // Use EditableCell when in edit mode
        if (editMode) {
          return (
            <EditableCell
              value={value}
              rowIndex={rowIndex}
              columnId={columnId}
              onUpdate={handleCellUpdate}
              isDirty={isDirty}
            />
          );
        }

        // Default read-only rendering (show dirty value if exists)
        if (value === null) return <span className="text-muted-foreground italic">null</span>;
        if (typeof value === "boolean") return value ? "true" : "false";
        if (typeof value === "object") return JSON.stringify(value);
        return String(value);
      },
      filterFn: (row: Row<RowData>, columnId: string, filterValue: unknown) => {
        const value = row.getValue(columnId);
        if (value === null || value === undefined) return false;

        // Convert both to strings for comparison (handles numbers, booleans, etc.)
        const stringValue = String(value).toLowerCase();
        const stringFilter = String(filterValue).toLowerCase();

        return stringValue.includes(stringFilter);
      },
    }));

    return [selectColumn, ...dataColumns];
  }, [result, editMode, dirtyData]);

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
      <div className="bg-card rounded-lg border border-border p-8 text-center">
        <p className="text-muted-foreground text-sm">No results yet</p>
        <p className="text-muted-foreground/70 text-xs mt-2">Run a query to see results</p>
      </div>
    );
  }

  if (result.rows.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-8 text-center">
        <p className="text-foreground/80 text-sm">Query executed successfully</p>
        <p className="text-muted-foreground text-xs mt-2">
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
  const copyToClipboard = async (text: string, _format?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // TODO: Add toast notification (use _format parameter)
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
      ...selectedData.map((row: RowData) =>
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
      <div className="px-4 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {rows.length.toLocaleString()} rows • {result.execution_time_ms}ms
            {activeFilterCount > 0 && (
              <span className="ml-2 text-primary">
                ({activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active)
              </span>
            )}
          </div>

          {/* Global search */}
          <div className="relative flex-1 max-w-xs">
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

          {/* Action buttons */}
          <div className="flex items-center gap-2 ml-auto">
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
            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              className="h-7 gap-2"
              onClick={() => setEditMode(!editMode)}
              disabled={!isEditingAllowed}
              title={
                !isEditingAllowed
                  ? config?.readOnly
                    ? "Editing disabled in read-only mode"
                    : "Editing disabled: table has no primary key or query is too complex"
                  : "Toggle edit mode"
              }
            >
              <Edit3 className="h-3 w-3" />
              <span className="text-xs">Edit</span>
            </Button>
            {dirtyData.size > 0 && (
              <Button
                variant="default"
                size="sm"
                className="h-7 gap-2 bg-primary"
                onClick={saveChanges}
                disabled={savingChanges}
                title="Save all changes to database"
              >
                <Save className="h-3 w-3" />
                <span className="text-xs">
                  {savingChanges ? 'Saving...' : `Save Changes (${dirtyData.size})`}
                </span>
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
                    className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground border border-border"
                  >
                    {header.isPlaceholder ? null : (
                      <div>
                        <div
                          className={`flex items-center gap-2 ${
                            header.column.getCanSort()
                              ? "cursor-pointer select-none hover:text-foreground"
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
                            className="mt-1 w-full px-2 py-1 text-xs bg-card rounded border border-border focus:border-primary focus:outline-none"
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
                    "border border-border hover:bg-muted/50 transition-colors",
                    row.getIsSelected() && "bg-primary/10 border-primary/30"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-2 text-foreground/80 font-mono text-xs max-w-md truncate border"
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
