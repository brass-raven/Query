import { Editor } from '@monaco-editor/react';
import { useRef, useEffect, memo } from 'react';
import { initVimMode } from 'monaco-vim';
import type { DatabaseSchema } from '../../types';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRunQuery: () => void;
  schema?: DatabaseSchema | null;
  onEditorReady?: (
    insertAtCursor: (text: string) => void,
    insertSnippet: (snippet: string) => void
  ) => void;
  vimMode?: boolean;
}

export const SqlEditor = memo(function SqlEditor({ value, onChange, onRunQuery, schema, onEditorReady, vimMode = false }: SqlEditorProps) {
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

    // Define custom theme matching app's dark color scheme
    monaco.editor.defineTheme('query-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword.sql', foreground: '8b5cf6', fontStyle: 'bold' },
        { token: 'string.sql', foreground: '34d399' },
        { token: 'number', foreground: 'f59e0b' },
        { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
        { token: 'operator.sql', foreground: '60a5fa' },
      ],
      colors: {
        'editor.background': '#0a0a0f', // matches card background hsl(224 71.4% 4.1%)
        'editor.foreground': '#fafafa', // matches foreground
        'editor.lineHighlightBackground': '#1c1c27', // slightly lighter than bg
        'editor.selectionBackground': '#7c3aed40', // primary with opacity
        'editor.inactiveSelectionBackground': '#7c3aed20',
        'editorLineNumber.foreground': '#6b7280', // muted
        'editorLineNumber.activeForeground': '#a78bfa', // primary lighter
        'editorCursor.foreground': '#a78bfa', // primary
        'editor.selectionHighlightBackground': '#7c3aed20',
        'editorWhitespace.foreground': '#374151',
        'editorIndentGuide.background': '#374151',
        'editorIndentGuide.activeBackground': '#6b7280',
        'editorSuggestWidget.background': '#18181b',
        'editorSuggestWidget.border': '#3f3f46',
        'editorSuggestWidget.foreground': '#fafafa',
        'editorSuggestWidget.selectedBackground': '#7c3aed40',
        'editorWidget.background': '#18181b',
        'editorWidget.border': '#3f3f46',
        'input.background': '#18181b',
        'input.border': '#3f3f46',
      },
    });

    // Set the custom theme
    monaco.editor.setTheme('query-dark');

    // Provide insert-at-cursor and insert-snippet functions to parent
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

      const insertSnippet = (snippet: string) => {
        // Remove snippet placeholders (${1:text}) and keep just the text
        const plainText = snippet.replace(/\$\{\d+:([^}]+)\}/g, '$1').replace(/\$\d+/g, '');
        const position = editor.getPosition();
        if (!position) return;

        const range = new monaco.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column
        );

        editor.executeEdits('', [{
          range: range,
          text: plainText,
          forceMoveMarkers: true,
        }]);
        editor.focus();
      };

      onEditorReady(insertAtCursor, insertSnippet);
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
    <div className="relative rounded-lg border border-border overflow-hidden bg-card">
      <Editor
        height="300px"
        language="sql"
        theme="query-dark"
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
          padding: { top: 12, bottom: 12 },
          fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
          fontLigatures: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          renderLineHighlight: 'all',
          renderWhitespace: 'selection',
          bracketPairColorization: {
            enabled: true,
          },
        }}
      />
      {vimMode && (
        <div
          id="vim-status"
          className="absolute bottom-0 left-0 right-0 bg-muted border-t border-border px-3 py-1 text-xs font-mono text-muted-foreground"
        ></div>
      )}
    </div>
  );
});
