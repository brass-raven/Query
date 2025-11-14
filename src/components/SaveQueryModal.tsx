import { useState } from "react";

interface SaveQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  currentQuery: string;
}

export function SaveQueryModal({
  isOpen,
  onClose,
  onSave,
  currentQuery,
}: SaveQueryModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  if (!isOpen) return null;

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), description.trim());
      setName("");
      setDescription("");
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="bg-gray-800 rounded-lg border border-gray-700 p-6 w-full max-w-2xl"
        onKeyDown={handleKeyDown}
      >
        <h2 className="text-xl font-semibold mb-4">Save Query</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Query Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Active Users Report"
              className="w-full px-3 py-2 bg-gray-900 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this query do?"
              className="w-full px-3 py-2 bg-gray-900 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Query</label>
            <pre className="w-full px-3 py-2 bg-gray-900 rounded border border-gray-700 text-sm font-mono overflow-x-auto max-h-32">
              {currentQuery}
            </pre>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium disabled:opacity-50 transition"
          >
            Save Query
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">
          Press <kbd className="px-1.5 py-0.5 bg-gray-900 rounded border border-gray-700">⌘ Enter</kbd> to save,{" "}
          <kbd className="px-1.5 py-0.5 bg-gray-900 rounded border border-gray-700">Esc</kbd> to cancel
        </p>
      </div>
    </div>
  );
}
