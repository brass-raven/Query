import { useState, useRef } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Button } from "../ui/button";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

interface MigrationScriptEditorProps {
  migrationScript: string;
  readOnly?: boolean;
}

export function MigrationScriptEditor({
  migrationScript,
  readOnly = false,
}: MigrationScriptEditorProps) {
  const [editorContent, setEditorContent] = useState(migrationScript);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorMount = (
    editor: editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    editorRef.current = editor;

    // Configure SQL language for better highlighting
    monaco.languages.setLanguageConfiguration("sql", {
      comments: {
        lineComment: "--",
        blockComment: ["/*", "*/"],
      },
    });
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(editorContent);
      toast.success("Migration script copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const saveToFile = async () => {
    try {
      const filePath = await save({
        defaultPath: "migration.sql",
        filters: [
          {
            name: "SQL Files",
            extensions: ["sql"],
          },
        ],
      });

      if (filePath) {
        await writeTextFile(filePath, editorContent);
        toast.success(`Migration script saved to ${filePath}`);
      }
    } catch (error) {
      console.error("Failed to save file:", error);
      toast.error("Failed to save migration script");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Editor Toolbar */}
      <div className="flex items-center justify-between pb-3 border-b mb-4">
        <div>
          <h2 className="text-lg font-semibold">Migration Script</h2>
          <p className="text-xs text-muted-foreground">
            {readOnly
              ? "Review the generated SQL migration script"
              : "Edit the migration script before saving or executing"}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyToClipboard}
            className="gap-2"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={saveToFile}
            className="gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            Save to File
          </Button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 border rounded-lg overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={editorContent}
          onChange={(value) => setEditorContent(value || "")}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            readOnly,
            minimap: { enabled: true },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
            folding: true,
            foldingStrategy: "indentation",
            renderLineHighlight: "all",
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
            suggest: {
              showKeywords: true,
            },
          }}
        />
      </div>

      {/* Script Stats */}
      <div className="flex items-center gap-6 pt-3 border-t mt-4 text-xs text-muted-foreground">
        <span>
          Lines: {editorContent.split("\n").length}
        </span>
        <span>
          Characters: {editorContent.length}
        </span>
        {!readOnly && (
          <span className="text-yellow-400">
            ⚠️ Changes made here will not affect the comparison results
          </span>
        )}
      </div>
    </div>
  );
}
