import { useState, memo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { FolderOpen, RotateCcw, Lightbulb } from "lucide-react";

interface ProjectSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string | null;
  onPathChanged: () => void;
}

export const ProjectSettings = memo(function ProjectSettings({
  isOpen,
  onClose,
  currentPath,
  onPathChanged,
}: ProjectSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenProject = async () => {
    setLoading(true);
    setError(null);

    try {
      // Use Tauri dialog to pick directory
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Directory",
      });

      if (selected && typeof selected === 'string') {
        // Set the project path
        await invoke("set_project_path", { path: selected });
        onPathChanged();
        onClose();
      }
    } catch (err) {
      setError(`Failed to open project: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUseDefault = async () => {
    setLoading(true);
    setError(null);

    try {
      const homeDir = await invoke<string>("get_app_dir");
      await invoke("set_project_path", { path: homeDir });
      onPathChanged();
      onClose();
    } catch (err) {
      setError(`Failed to reset to default: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
          <DialogDescription>
            Manage your project location and data storage
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Current Project Location</Label>
            <div className="px-3 py-2.5 bg-muted rounded-md border border-border text-sm font-mono text-muted-foreground">
              {currentPath || "~/.query (default)"}
            </div>
            <p className="text-xs text-muted-foreground">
              All connections, queries, and history are stored in this directory
            </p>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="border-t border-border pt-4 space-y-3">
            <Label className="text-muted-foreground">Change Project Location</Label>
            <div className="space-y-2">
              <Button
                onClick={handleOpenProject}
                disabled={loading}
                className="w-full justify-start gap-2"
              >
                <FolderOpen className="h-4 w-4" />
                {loading ? "Opening..." : "Open Different Project..."}
              </Button>
              {currentPath && (
                <Button
                  onClick={handleUseDefault}
                  disabled={loading}
                  variant="outline"
                  className="w-full justify-start gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset to Default Location
                </Button>
              )}
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-md p-3 flex gap-2">
            <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Tip:</span> Use different project directories to organize connections by environment (dev, staging, prod) or by client/project.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
