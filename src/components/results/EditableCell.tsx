import { useState, useEffect, useRef, memo } from 'react';
import { Input } from '../ui/input';

interface EditableCellProps {
  value: unknown;
  rowIndex: number;
  columnId: string;
  onUpdate: (rowIndex: number, columnId: string, value: unknown) => void;
  isDirty?: boolean;
}

export const EditableCell = memo(function EditableCell({
  value,
  rowIndex,
  columnId,
  onUpdate,
  isDirty = false,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync editValue with prop value when not editing
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    // Only update if value changed
    if (editValue !== value) {
      onUpdate(rowIndex, columnId, editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsEditing(false);
      if (editValue !== value) {
        onUpdate(rowIndex, columnId, editValue);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditValue(value); // Revert to original value
      setIsEditing(false);
    }
  };

  // Render null value
  if (value === null && !isEditing) {
    return (
      <div
        className="text-muted-foreground italic px-2 py-1 cursor-pointer h-full"
        onDoubleClick={handleDoubleClick}
      >
        null
      </div>
    );
  }

  // Render boolean value
  if (typeof value === 'boolean' && !isEditing) {
    return (
      <div
        className="px-2 py-1 cursor-pointer h-full"
        onDoubleClick={handleDoubleClick}
      >
        {value ? 'true' : 'false'}
      </div>
    );
  }

  // Render object/array value (not editable for now)
  if (typeof value === 'object' && value !== null && !isEditing) {
    return (
      <div className="px-2 py-1 text-xs font-mono">
        {JSON.stringify(value)}
      </div>
    );
  }

  // Editing mode
  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="text"
        value={editValue === null ? '' : String(editValue)}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="h-full border-0 focus:ring-2 focus:ring-primary px-2 py-1 text-sm"
      />
    );
  }

  // Display mode
  return (
    <div
      className={`px-2 py-1 cursor-pointer h-full transition-colors ${
        isDirty ? 'border-l-2 border-l-primary bg-primary/5' : 'hover:bg-muted/30'
      }`}
      onDoubleClick={handleDoubleClick}
      title="Double-click to edit"
    >
      {String(value)}
    </div>
  );
});
