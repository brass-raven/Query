import { useState } from "react";
import type { SchemaComparison, TableDifference } from "../../types";
import { DIFF_STATUS, WARNING_SEVERITY } from "../../constants";
import { Checkbox } from "../ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { Button } from "../ui/button";
import { ChevronRight, ChevronDown, CheckCircle2, XCircle, MinusCircle } from "lucide-react";

interface ObjectSelectionTreeProps {
  comparison: SchemaComparison;
  selectedChanges: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  filterMode: "all" | "differences" | "conflicts";
}

export function ObjectSelectionTree({
  comparison,
  selectedChanges,
  onSelectionChange,
  filterMode,
}: ObjectSelectionTreeProps) {
  const [openTables, setOpenTables] = useState<Set<string>>(new Set());

  const toggleTable = (tableName: string) => {
    const newOpen = new Set(openTables);
    if (newOpen.has(tableName)) {
      newOpen.delete(tableName);
    } else {
      newOpen.add(tableName);
    }
    setOpenTables(newOpen);
  };

  const toggleSelection = (key: string) => {
    const newSelected = new Set(selectedChanges);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    onSelectionChange(newSelected);
  };

  const selectAll = () => {
    const allChanges = new Set<string>();
    comparison.table_differences.forEach((table) => {
      if (table.status !== DIFF_STATUS.IDENTICAL) {
        allChanges.add(`table:${table.table_name}`);
      }
    });
    comparison.view_differences.forEach((view) => {
      if (view.status !== DIFF_STATUS.IDENTICAL) {
        allChanges.add(`view:${view.view_name}`);
      }
    });
    comparison.routine_differences.forEach((routine) => {
      if (routine.status !== DIFF_STATUS.IDENTICAL) {
        allChanges.add(`routine:${routine.routine_name}`);
      }
    });
    onSelectionChange(allChanges);
  };

  const deselectAll = () => {
    onSelectionChange(new Set());
  };

  const filteredTables = comparison.table_differences.filter((table) => {
    if (filterMode === "all") return true;
    if (filterMode === "differences") return table.status !== DIFF_STATUS.IDENTICAL;
    const hasHighRiskWarning = comparison.warnings.some(
      (w) => w.severity === WARNING_SEVERITY.HIGH && w.affected_object === table.table_name
    );
    return hasHighRiskWarning;
  });

  const filteredViews = comparison.view_differences.filter((view) => {
    if (filterMode === "all") return true;
    if (filterMode === "differences") return view.status !== DIFF_STATUS.IDENTICAL;
    return false;
  });

  const filteredRoutines = comparison.routine_differences.filter((routine) => {
    if (filterMode === "all") return true;
    if (filterMode === "differences") return routine.status !== DIFF_STATUS.IDENTICAL;
    return false;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header Actions */}
      <div className="flex flex-col gap-2 bg-background pb-3 border-b flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Database Objects</h2>
            <p className="text-xs text-muted-foreground">Select which changes to include in the migration script</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll}>
              Deselect All
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto min-h-0 space-y-4 mt-4">
      {/* Tables Section */}
      {filteredTables.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded">
            <span className="text-sm font-medium">📁 Tables</span>
            <span className="text-xs text-muted-foreground">
              ({filteredTables.length})
            </span>
          </div>

          {filteredTables.map((table) => (
            <div key={table.table_name} className="ml-4">
              <Collapsible
                open={openTables.has(table.table_name)}
                onOpenChange={() => toggleTable(table.table_name)}
              >
                <div className="flex items-center gap-2 p-2 hover:bg-accent/50 rounded transition-colors">
                  <Checkbox
                    checked={selectedChanges.has(`table:${table.table_name}`)}
                    onCheckedChange={() =>
                      toggleSelection(`table:${table.table_name}`)
                    }
                    disabled={table.status === DIFF_STATUS.IDENTICAL}
                  />

                  <CollapsibleTrigger className="flex items-center gap-2 flex-1">
                    {openTables.has(table.table_name) ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <span className="font-mono text-sm">{table.table_name}</span>
                    <StatusIndicator status={table.status} />
                  </CollapsibleTrigger>

                  <span className="text-xs text-muted-foreground">
                    {getTableSummary(table)}
                  </span>
                </div>

                <CollapsibleContent className="ml-8 mt-1 space-y-1">
                  {/* Column Changes */}
                  {table.column_changes.filter((c) => c.status !== DIFF_STATUS.IDENTICAL)
                    .length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">
                        Column Changes:
                      </div>
                      {table.column_changes
                        .filter((c) => c.status !== DIFF_STATUS.IDENTICAL)
                        .map((col, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 text-xs pl-2"
                          >
                            <StatusIndicator status={col.status} />
                            <div>
                              <strong>{col.column_name}</strong>
                              {col.changes.length > 0 && (
                                <div className="text-muted-foreground">
                                  {col.changes.join(", ")}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Index Changes */}
                  {table.index_changes &&
                    table.index_changes.filter((i) => i.status !== DIFF_STATUS.IDENTICAL)
                      .length > 0 && (
                      <div className="space-y-1 mt-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          Index Changes:
                        </div>
                        {table.index_changes
                          .filter((i) => i.status !== DIFF_STATUS.IDENTICAL)
                          .map((idx, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-xs pl-2"
                            >
                              <StatusIndicator status={idx.status} />
                              <strong>{idx.index_name}</strong>
                            </div>
                          ))}
                      </div>
                    )}

                  {/* Foreign Key Changes */}
                  {table.fk_changes &&
                    table.fk_changes.filter((f) => f.status !== DIFF_STATUS.IDENTICAL)
                      .length > 0 && (
                      <div className="space-y-1 mt-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          Foreign Key Changes:
                        </div>
                        {table.fk_changes
                          .filter((f) => f.status !== DIFF_STATUS.IDENTICAL)
                          .map((fk, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-xs pl-2"
                            >
                              <StatusIndicator status={fk.status} />
                              <strong>{fk.constraint_name}</strong>
                            </div>
                          ))}
                      </div>
                    )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          ))}
        </div>
      )}

      {/* Views Section */}
      {filteredViews.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded">
            <span className="text-sm font-medium">📁 Views</span>
            <span className="text-xs text-muted-foreground">
              ({filteredViews.length})
            </span>
          </div>

          {filteredViews.map((view) => (
            <div
              key={view.view_name}
              className="ml-4 flex items-center gap-2 p-2 hover:bg-accent/50 rounded transition-colors"
            >
              <Checkbox
                checked={selectedChanges.has(`view:${view.view_name}`)}
                onCheckedChange={() => toggleSelection(`view:${view.view_name}`)}
                disabled={view.status === DIFF_STATUS.IDENTICAL}
              />
              <span className="font-mono text-sm">{view.view_name}</span>
              <StatusIndicator status={view.status} />
            </div>
          ))}
        </div>
      )}

      {/* Stored Procedures Section */}
      {filteredRoutines.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded">
            <span className="text-sm font-medium">📁 Stored Procedures</span>
            <span className="text-xs text-muted-foreground">
              ({filteredRoutines.length})
            </span>
          </div>

          {filteredRoutines.map((routine) => (
            <div
              key={routine.routine_name}
              className="ml-4 flex items-center gap-2 p-2 hover:bg-accent/50 rounded transition-colors"
            >
              <Checkbox
                checked={selectedChanges.has(`routine:${routine.routine_name}`)}
                onCheckedChange={() =>
                  toggleSelection(`routine:${routine.routine_name}`)
                }
                disabled={routine.status === DIFF_STATUS.IDENTICAL}
              />
              <span className="font-mono text-sm">{routine.routine_name}</span>
              <StatusIndicator status={routine.status} />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredTables.length === 0 &&
        filteredViews.length === 0 &&
        filteredRoutines.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No objects to display with current filter
          </div>
        )}
      </div>
    </div>
  );
}

function StatusIndicator({ status }: { status: string }) {
  if (status === DIFF_STATUS.ADDED) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-400">
        <CheckCircle2 className="h-3 w-3" />
        New
      </span>
    );
  }
  if (status === DIFF_STATUS.REMOVED) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-400">
        <XCircle className="h-3 w-3" />
        Deleted
      </span>
    );
  }
  if (status === DIFF_STATUS.MODIFIED) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
        <MinusCircle className="h-3 w-3" />
        Modified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
      Identical
    </span>
  );
}

function getTableSummary(table: TableDifference): string {
  const changes: string[] = [];

  const colChanges = table.column_changes.filter((c) => c.status !== DIFF_STATUS.IDENTICAL).length;
  if (colChanges > 0) changes.push(`${colChanges} column${colChanges > 1 ? "s" : ""}`);

  const idxChanges =
    table.index_changes?.filter((i) => i.status !== DIFF_STATUS.IDENTICAL).length || 0;
  if (idxChanges > 0) changes.push(`${idxChanges} index${idxChanges > 1 ? "es" : ""}`);

  const fkChanges =
    table.fk_changes?.filter((f) => f.status !== DIFF_STATUS.IDENTICAL).length || 0;
  if (fkChanges > 0) changes.push(`${fkChanges} FK${fkChanges > 1 ? "s" : ""}`);

  return changes.length > 0 ? changes.join(", ") : table.status;
}
