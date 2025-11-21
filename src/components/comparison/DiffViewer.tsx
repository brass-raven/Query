import { useState } from "react";
import type { SchemaComparison, TableDifference } from "../../types";
import { DIFF_STATUS, WARNING_SEVERITY } from "../../constants";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

interface DiffViewerProps {
  comparison: SchemaComparison;
  filterMode: "all" | "differences" | "conflicts";
}

export function DiffViewer({ comparison, filterMode }: DiffViewerProps) {
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

  const filteredTables = comparison.table_differences.filter((table) => {
    if (filterMode === "all") return true;
    if (filterMode === "differences") return table.status !== DIFF_STATUS.IDENTICAL;
    // conflicts mode: only tables with high-risk warnings
    const hasHighRiskWarning = (comparison.warnings || []).some(
      (w) => w.severity === WARNING_SEVERITY.HIGH && w.affected_object === table.table_name
    );
    return hasHighRiskWarning;
  });

  console.log("DiffViewer - Total tables:", comparison.table_differences.length);
  console.log("DiffViewer - Filtered tables:", filteredTables.length);
  console.log("DiffViewer - Filter mode:", filterMode);

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-semibold mb-4 flex-shrink-0">Table DDL Comparison</h2>
      <div className="space-y-2 flex-1 overflow-auto min-h-0">

      {filteredTables.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No tables to display with current filter</p>
          <p className="text-xs mt-2">Total tables in comparison: {comparison.table_differences.length}</p>
        </div>
      )}

      {filteredTables.map((table) => (
        <Collapsible
          key={table.table_name}
          open={openTables.has(table.table_name)}
          onOpenChange={() => toggleTable(table.table_name)}
        >
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center gap-2 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
              {openTables.has(table.table_name) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span className="font-mono font-medium">{table.table_name}</span>
              <StatusBadge status={table.status} />
              {table.column_changes.length > 0 && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {table.column_changes.filter((c) => c.status !== DIFF_STATUS.IDENTICAL).length} column changes
                </span>
              )}
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="mt-2 border rounded-lg overflow-hidden">
              {/* Side-by-side DDL view */}
              <div className="grid grid-cols-2 divide-x bg-muted/20">
                <div className="p-3 text-sm font-medium">
                  Source ({comparison.source_connection})
                </div>
                <div className="p-3 text-sm font-medium">
                  Target ({comparison.target_connection})
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x">
                {/* Source DDL */}
                <div className="p-4 font-mono text-sm space-y-1">
                  {table.status === DIFF_STATUS.REMOVED ? (
                    <div className="text-muted-foreground italic">
                      [Will be deleted]
                    </div>
                  ) : (
                    <>
                      <div className="text-muted-foreground">
                        CREATE TABLE {table.table_name} (
                      </div>
                      {renderColumnDiff(table, "source")}
                      <div className="text-muted-foreground">);</div>
                    </>
                  )}
                </div>

                {/* Target DDL */}
                <div className="p-4 font-mono text-sm space-y-1">
                  {table.status === DIFF_STATUS.ADDED ? (
                    <div className="text-muted-foreground italic">
                      [New table - will be created]
                    </div>
                  ) : (
                    <>
                      <div className="text-muted-foreground">
                        CREATE TABLE {table.table_name} (
                      </div>
                      {renderColumnDiff(table, "target")}
                      <div className="text-muted-foreground">);</div>
                    </>
                  )}
                </div>
              </div>

              {/* Column Changes Summary */}
              {table.column_changes.filter((c) => c.status !== DIFF_STATUS.IDENTICAL).length > 0 && (
                <div className="border-t p-4 bg-muted/10">
                  <div className="text-sm font-medium mb-2">Changes Detected:</div>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    {table.column_changes
                      .filter((c) => c.status !== DIFF_STATUS.IDENTICAL)
                      .map((change, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <StatusIcon status={change.status} />
                          <span>
                            <strong className="text-foreground">{change.column_name}</strong>:{" "}
                            {change.changes && change.changes.length > 0
                              ? change.changes.join(", ")
                              : `Status: ${change.status}`}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {/* Index Changes */}
              {table.index_changes && table.index_changes.length > 0 && (
                <div className="border-t p-4 bg-muted/10">
                  <div className="text-sm font-medium mb-2">Index Changes:</div>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    {table.index_changes.map((idx, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <StatusIcon status={idx.status} />
                        <span>
                          <strong className="text-foreground">{idx.index_name}</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
      </div>
    </div>
  );
}

function renderColumnDiff(table: TableDifference, side: "source" | "target") {
  return table.column_changes.map((change) => {
    const definition =
      side === "source" ? change.source_definition : change.target_definition;

    // Determine highlighting based on change status
    let bgClass = "";
    let textClass = "";

    if (change.status === DIFF_STATUS.ADDED) {
      if (side === "target") {
        bgClass = "bg-green-500/20";
        textClass = "text-green-400";
      } else {
        // On source side, show as missing
        return (
          <div
            key={change.column_name}
            className="pl-4 text-muted-foreground italic"
          >
            [Column will be added in target]
          </div>
        );
      }
    } else if (change.status === DIFF_STATUS.REMOVED) {
      if (side === "source") {
        bgClass = "bg-red-500/20";
        textClass = "text-red-400";
      } else {
        return (
          <div
            key={change.column_name}
            className="pl-4 text-muted-foreground italic"
          >
            [Column will be removed from target]
          </div>
        );
      }
    } else if (change.status === DIFF_STATUS.MODIFIED) {
      bgClass = "bg-yellow-500/20";
      textClass = "text-yellow-400";
    }

    if (!definition) {
      return (
        <div key={change.column_name} className="pl-4 text-muted-foreground">
          [Missing]
        </div>
      );
    }

    // Format the column definition
    const definitionString = formatColumnDefinition(definition);

    return (
      <div key={change.column_name} className={cn("pl-4", bgClass, textClass)}>
        {definitionString},
      </div>
    );
  });
}

function formatColumnDefinition(col: import("../../types").EnhancedColumnInfo): string {
  let def = `${col.column_name} ${col.data_type}`;

  if (col.character_maximum_length) {
    def += `(${col.character_maximum_length})`;
  } else if (col.numeric_precision && col.numeric_scale) {
    def += `(${col.numeric_precision},${col.numeric_scale})`;
  }

  if (col.is_nullable === "NO") {
    def += " NOT NULL";
  }

  if (col.column_default) {
    def += ` DEFAULT ${col.column_default}`;
  }

  return def;
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    added: "bg-green-500/20 text-green-400 border-green-500/50",
    removed: "bg-red-500/20 text-red-400 border-red-500/50",
    modified: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
    identical: "bg-gray-500/20 text-gray-400 border-gray-500/50",
  };

  // Capitalize first letter for display
  const displayText = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded text-xs border",
        colors[status as keyof typeof colors]
      )}
    >
      {displayText}
    </span>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === DIFF_STATUS.ADDED) {
    return <span className="text-green-400">+</span>;
  }
  if (status === DIFF_STATUS.REMOVED) {
    return <span className="text-red-400">-</span>;
  }
  if (status === DIFF_STATUS.MODIFIED) {
    return <span className="text-yellow-400">~</span>;
  }
  return <span className="text-gray-400">•</span>;
}
