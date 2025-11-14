import { Editor } from '@monaco-editor/react';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRunQuery: () => void;
}

export function SqlEditor({ value, onChange, onRunQuery }: SqlEditorProps) {
  function handleEditorChange(newValue: string | undefined) {
    onChange(newValue || '');
  }

function handleEditorMount(editor: any, monaco: any) {
  // Add Cmd+Enter / Ctrl+Enter keybinding to run query
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    onRunQuery();
  });

  // Add Cmd+/ / Ctrl+/ keybinding to comment/uncomment
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
    editor.trigger('keyboard', 'editor.action.commentLine', {});
  });

  // Register SQL keywords for better autocomplete
  monaco.languages.registerCompletionItemProvider('sql', {
    provideCompletionItems: (model: any, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions = [
        {
          label: 'SELECT',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'SELECT ',
          range: range,
        },
        {
          label: 'FROM',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'FROM ',
          range: range,
        },
        {
          label: 'WHERE',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'WHERE ',
          range: range,
        },
        {
          label: 'JOIN',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'JOIN ',
          range: range,
        },
        {
          label: 'LEFT JOIN',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'LEFT JOIN ',
          range: range,
        },
        {
          label: 'INNER JOIN',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'INNER JOIN ',
          range: range,
        },
        {
          label: 'ORDER BY',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'ORDER BY ',
          range: range,
        },
        {
          label: 'GROUP BY',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'GROUP BY ',
          range: range,
        },
        {
          label: 'LIMIT',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'LIMIT ',
          range: range,
        },
      ];

      return { suggestions };
    },
  });
}

  return (
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
  );
}
