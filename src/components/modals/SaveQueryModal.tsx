import { useState, memo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Kbd } from "../ui/kbd";

interface SaveQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  currentQuery: string;
}

export const SaveQueryModal = memo(function SaveQueryModal({
  isOpen,
  onClose,
  onSave,
  currentQuery,
}: SaveQueryModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
    }
  }, [isOpen]);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), description.trim());
      setName("");
      setDescription("");
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px]" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Save Query</DialogTitle>
          <DialogDescription>
            Save this query for quick access later
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="query-name">
              Query Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="query-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Active Users Report"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="query-description">Description (optional)</Label>
            <Input
              id="query-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this query do?"
            />
          </div>

          <div className="space-y-2">
            <Label>Query Preview</Label>
            <pre className="w-full px-3 py-2 bg-muted rounded-md border border-border text-sm font-mono overflow-x-auto max-h-32 text-muted-foreground">
              {currentQuery}
            </pre>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex-1 text-xs text-muted-foreground hidden sm:flex items-center gap-1">
            <Kbd>⌘</Kbd><Kbd>↵</Kbd> to save
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              Save Query
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
