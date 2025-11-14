import { Editor } from '@monaco-editor/react';
import { useRef, useEffect } from 'react';
import { initVimMode } from 'monaco-vim';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRunQuery: () => void;
  schema?: {
    tables: Array<{
      table_name: string;
      columns: Array<{
        column_name: string;
        data_type: string;
      }>;
    }>;
  } | null;
  onEditorReady?: (insertAtCursor: (text: string) => void) => void;
  vimMode?: boolean;
}

export function SqlEditor({ value, onChange, onRunQuery, schema, onEditorReady, vimMode = false }: SqlEditorProps) {
  const editorRef = useRef<any>(null);
  const schemaRef = useRef(schema);
  const onRunQueryRef = useRef(onRunQuery);
  const completionProviderRef = useRef<any>(null);
  const vimModeRef = useRef<any>(null);

  // Update refs when props change
  useEffect(() => {
    schemaRef.current = schema;
  }, [schema]);

  useEffect(() => {
    onRunQueryRef.current = onRunQuery;
  }, [onRunQuery]);

  // Cleanup completion provider on unmount
  useEffect(() => {
    return () => {
      if (completionProviderRef.current) {
        completionProviderRef.current.dispose();
      }
    };
  }, []);

  // Handle vim mode toggle
  useEffect(() => {
    if (!editorRef.current) return;

    // Dispose existing vim mode
    if (vimModeRef.current) {
      vimModeRef.current.dispose();
      vimModeRef.current = null;
    }

    // Initialize vim mode if enabled
    if (vimMode) {
      const statusNode = document.getElementById('vim-status');
      vimModeRef.current = initVimMode(editorRef.current, statusNode);
    }

    return () => {
      if (vimModeRef.current) {
        vimModeRef.current.dispose();
        vimModeRef.current = null;
      }
    };
  }, [vimMode]);

  function handleEditorChange(newValue: string | undefined) {
    onChange(newValue || '');
  }

  function handleEditorMount(editor: any, monaco: any) {
    // Store editor instance
    editorRef.current = editor;

    // Provide insert-at-cursor function to parent
    if (onEditorReady) {
      const insertAtCursor = (text: string) => {
        const position = editor.getPosition();
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column,
          endColumn: position.column,
        };
        editor.executeEdits('', [{
          range: range,
          text: text,
          forceMoveMarkers: true,
        }]);
        editor.focus();
      };
      onEditorReady(insertAtCursor);
    }

    // Cmd+Enter to run query (read current editor value and sync state first)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      // Get the current value from the editor to ensure we have the latest
      const currentValue = editor.getValue();
      // Update the parent state with current editor value
      onChange(currentValue);
      // Use setTimeout to ensure state update completes before running query
      setTimeout(() => {
        onRunQueryRef.current();
      }, 0);
    });

    // Cmd+/ to comment
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      editor.trigger('keyboard', 'editor.action.commentLine', {});
    });

    // Register completion provider with schema (dispose old one first if exists)
    if (completionProviderRef.current) {
      completionProviderRef.current.dispose();
    }

    completionProviderRef.current = monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        }).toLowerCase();

        const suggestions: any[] = [];

        // SQL Keywords
        const keywords = [
          'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
          'INNER JOIN', 'ON', 'AND', 'OR', 'ORDER BY', 'GROUP BY',
          'HAVING', 'LIMIT', 'OFFSET', 'INSERT INTO', 'UPDATE', 'DELETE',
          'CREATE', 'ALTER', 'DROP', 'AS', 'DISTINCT', 'COUNT', 'SUM',
          'AVG', 'MIN', 'MAX', 'IN', 'NOT IN', 'LIKE', 'BETWEEN',
        ];

        keywords.forEach(kw => {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range: range,
          });
        });

        // Add table names from schema (use ref to get latest schema value)
        const currentSchema = schemaRef.current;
        if (currentSchema?.tables) {
          currentSchema.tables.forEach(table => {
            suggestions.push({
              label: table.table_name,
              kind: monaco.languages.CompletionItemKind.Class,
              detail: `Table (${table.columns.length} columns)`,
              insertText: table.table_name,
              range: range,
            });
          });

          // If typing after "table." suggest columns
          const dotMatch = /(\w+)\.(\w*)$/.exec(textUntilPosition);
          if (dotMatch) {
            const tableName = dotMatch[1];
            const table = currentSchema.tables.find(t =>
              t.table_name.toLowerCase() === tableName.toLowerCase()
            );

            if (table) {
              // Clear suggestions and only show columns
              suggestions.length = 0;
              table.columns.forEach(col => {
                suggestions.push({
                  label: col.column_name,
                  kind: monaco.languages.CompletionItemKind.Field,
                  detail: col.data_type,
                  insertText: col.column_name,
                  range: range,
                });
              });
            }
          }
        }

        return { suggestions };
      },
    });
  }

  return (
    <div className="relative">
      <Editor
        height="300px"
        language="sql"
        theme="vs-dark"
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          quickSuggestions: true,
          suggestOnTriggerCharacters: true,
        }}
      />
      {vimMode && (
        <div
          id="vim-status"
          className="absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 px-3 py-1 text-xs font-mono text-gray-400"
        ></div>
      )}
    </div>
  );
}
