import { memo, useEffect, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ColumnInfo } from '../../types';

interface TableNodeProps {
  data: {
    label: string;
    columns: ColumnInfo[];
    expanded?: boolean;
    onToggleExpand?: (tableName: string) => void;
  };
}

export const TableNode = memo(({ data }: TableNodeProps) => {
  const { label, columns, expanded = false, onToggleExpand } = data;
  const [isExpanded, setIsExpanded] = useState(expanded);

  // Sync internal state with prop when it changes
  useEffect(() => {
    setIsExpanded(expanded);
  }, [expanded]);

  const handleToggle = () => {
    if (onToggleExpand) {
      onToggleExpand(label);
    }
  };

  const visibleColumns = isExpanded ? columns : columns.slice(0, 10);
  const hasMore = columns.length > 10;

  return (
    <div className="bg-[#18181b] border border-[#3f3f46] rounded-lg overflow-hidden min-w-[250px]">
      {/* Table Header */}
      <div className="px-3 py-2 bg-primary/20 border-b border-[#3f3f46]">
        <div className="text-sm font-semibold text-foreground">{label}</div>
      </div>

      {/* Columns List */}
      <div className="py-1 max-h-[400px] overflow-y-auto">
        {visibleColumns.map((col) => (
          <div
            key={col.column_name}
            className="px-3 py-1 text-xs flex items-center gap-2 hover:bg-muted/10 transition-colors"
          >
            <span className="text-foreground font-medium">{col.column_name}</span>
            <span className="text-muted-foreground text-[10px]">{col.data_type}</span>
          </div>
        ))}
        {hasMore && (
          <button
            onClick={handleToggle}
            className="w-full px-3 py-1.5 text-xs text-primary hover:bg-primary/10 transition-colors flex items-center gap-1.5 border-t border-[#3f3f46]"
          >
            {isExpanded ? (
              <>
                <ChevronDown className="w-3 h-3" />
                <span>Show less</span>
              </>
            ) : (
              <>
                <ChevronRight className="w-3 h-3" />
                <span>Show {columns.length - 10} more columns</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-primary !w-2 !h-2 !border-2 !border-background"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary !w-2 !h-2 !border-2 !border-background"
      />
    </div>
  );
});

TableNode.displayName = 'TableNode';
