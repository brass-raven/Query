import { memo, useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import {
  Edit3,
  Trash2,
  Folder,
  FolderOpen,
} from "lucide-react";
import type { ConnectionConfig } from "../../types";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  // General settings
  currentProjectPath: string | null;
  onProjectPathChange: () => Promise<void>;
  // Editor settings
  vimMode: boolean;
  onVimModeChange: (enabled: boolean) => void;
  // Display settings
  compactView: boolean;
  onCompactViewChange: (enabled: boolean) => void;
  layoutDirection: "vertical" | "horizontal";
  onLayoutDirectionChange: (direction: "vertical" | "horizontal") => void;
  // Connection settings
  connections: ConnectionConfig[];
  onDeleteConnection: (name: string) => Promise<void>;
  onEditConnection: (connection: ConnectionConfig) => void;
  onNewConnection: () => void;
}

export const Settings = memo(function Settings({
  isOpen,
  onClose,
  currentProjectPath,
  onProjectPathChange,
  vimMode,
  onVimModeChange,
  compactView,
  onCompactViewChange,
  layoutDirection,
  onLayoutDirectionChange,
  connections,
  onDeleteConnection,
  onEditConnection,
  onNewConnection,
}: SettingsProps) {
  const [isChangingPath, setIsChangingPath] = useState(false);
  const [autoConnectEnabled, setAutoConnectEnabled] = useState(false);
  const [lastConnectionName, setLastConnectionName] = useState<string | null>(null);

  // Load auto-connect settings when modal opens
  useEffect(() => {
    if (isOpen) {
      loadAutoConnectSettings();
    }
  }, [isOpen]);

  const loadAutoConnectSettings = useCallback(async () => {
    try {
      const enabled = await invoke<boolean>("get_auto_connect_enabled");
      const lastConn = await invoke<string | null>("get_last_connection");
      setAutoConnectEnabled(enabled);
      setLastConnectionName(lastConn);
    } catch (error) {
      console.error("Failed to load auto-connect settings:", error);
    }
  }, []);

  const handleAutoConnectToggle = useCallback(async (enabled: boolean) => {
    try {
      await invoke("set_auto_connect_enabled", { enabled });
      setAutoConnectEnabled(enabled);
    } catch (error) {
      console.error("Failed to set auto-connect:", error);
    }
  }, []);

  const handleChangeProjectPath = useCallback(async () => {
    setIsChangingPath(true);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Directory",
      });

      if (selected) {
        await invoke("set_project_path", { path: selected });
        await onProjectPathChange();
      }
    } catch (error) {
      console.error("Failed to change project path:", error);
    } finally {
      setIsChangingPath(false);
    }
  }, [onProjectPathChange]);

  const handleRevealProjectDirectory = useCallback(async () => {
    try {
      const path = currentProjectPath || `${await invoke<string>("get_app_dir")}/.query`;
      await revealItemInDir(path);
    } catch (error) {
      console.error("Failed to reveal project directory:", error);
    }
  }, [currentProjectPath]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Settings
          </DialogTitle>
          <DialogDescription>
            Manage your Query application preferences and connections
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general" className="gap-2">
              General
            </TabsTrigger>
            <TabsTrigger value="editor" className="gap-2">
              Editor
            </TabsTrigger>
            <TabsTrigger value="display" className="gap-2">
              Display
            </TabsTrigger>
            <TabsTrigger value="connections" className="gap-2">
              Connections
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[450px] mt-4">
            {/* General Tab */}
            <TabsContent value="general" className="space-y-6 px-1">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-3">Project Location</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          value={currentProjectPath || "~/.query (default)"}
                          readOnly
                          className="flex-1 font-mono text-xs"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRevealProjectDirectory}
                          title="Reveal in Finder"
                        >
                          <FolderOpen className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleChangeProjectPath}
                          disabled={isChangingPath}
                        >
                          {isChangingPath ? "Changing..." : "Change"}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      All connections, queries, and history are stored in this directory
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-medium mb-3">Startup Behavior</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="auto-connect">Auto-connect to last connection</Label>
                        <p className="text-xs text-muted-foreground">
                          Automatically connect when opening the app
                          {lastConnectionName && ` (${lastConnectionName})`}
                        </p>
                      </div>
                      <Switch
                        id="auto-connect"
                        checked={autoConnectEnabled}
                        onCheckedChange={handleAutoConnectToggle}
                      />
                    </div>
                    {!lastConnectionName && (
                      <p className="text-xs text-muted-foreground">
                        Connect to a database first to enable auto-connect
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Editor Tab */}
            <TabsContent value="editor" className="space-y-6 px-1">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-3">Editor Preferences</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="vim-mode">Vim Mode</Label>
                        <p className="text-xs text-muted-foreground">
                          Enable Vim keybindings in the SQL editor
                        </p>
                      </div>
                      <Switch
                        id="vim-mode"
                        checked={vimMode}
                        onCheckedChange={onVimModeChange}
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="theme">Theme</Label>
                        <p className="text-xs text-muted-foreground">
                          Editor color scheme
                        </p>
                      </div>
                      <Badge variant="secondary">Dark (default)</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Display Tab */}
            <TabsContent value="display" className="space-y-6 px-1">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-3">Layout</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="layout-direction">Layout Direction</Label>
                        <p className="text-xs text-muted-foreground">
                          How the editor and results are arranged
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={layoutDirection === "vertical" ? "default" : "outline"}
                          size="sm"
                          onClick={() => onLayoutDirectionChange("vertical")}
                        >
                          Vertical
                        </Button>
                        <Button
                          variant={layoutDirection === "horizontal" ? "default" : "outline"}
                          size="sm"
                          onClick={() => onLayoutDirectionChange("horizontal")}
                        >
                          Horizontal
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="compact-view">Compact View</Label>
                        <p className="text-xs text-muted-foreground">
                          Show results in a more dense format
                        </p>
                      </div>
                      <Switch
                        id="compact-view"
                        checked={compactView}
                        onCheckedChange={onCompactViewChange}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Connections Tab */}
            <TabsContent value="connections" className="space-y-6 px-1">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Saved Connections</h3>
                  <Button variant="default" size="sm" onClick={onNewConnection}>
                    New Connection
                  </Button>
                </div>

                <div className="space-y-2">
                  {connections.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No saved connections
                    </div>
                  ) : (
                    connections.map((conn) => (
                      <div
                        key={conn.name}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{conn.name}</p>
                            {conn.readOnly && (
                              <Badge variant="secondary" className="text-xs">
                                Read-only
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {conn.database}@{conn.host}:{conn.port} ({conn.username})
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditConnection(conn)}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteConnection(conn.name)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">⌘,</kbd> to open settings
          </p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
