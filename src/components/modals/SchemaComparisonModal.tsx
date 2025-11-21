import { useState, memo } from "react";
import { WARNING_SEVERITY } from "../../constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import type { ConnectionConfig, SchemaComparison } from "../../types";
import { compareSchemas, generateMigrationSql, getConnectionPassword } from "../../utils/tauri";
import { Loader2, AlertTriangle, CheckCircle2, XCircle, MinusCircle } from "lucide-react";

interface SchemaComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  connections: ConnectionConfig[];
}

export const SchemaComparisonModal = memo(function SchemaComparisonModal({
  isOpen,
  onClose,
  connections,
}: SchemaComparisonModalProps) {
  const [sourceConnectionName, setSourceConnectionName] = useState<string>("");
  const [targetConnectionName, setTargetConnectionName] = useState<string>("");
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<SchemaComparison | null>(null);
  const [migrationScript, setMigrationScript] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleCompare = async () => {
    if (!sourceConnectionName || !targetConnectionName) {
      setError("Please select both source and target connections");
      return;
    }

    const sourceConfig = connections.find((c) => c.name === sourceConnectionName);
    const targetConfig = connections.find((c) => c.name === targetConnectionName);

    if (!sourceConfig || !targetConfig) {
      setError("Selected connections not found");
      return;
    }

    setComparing(true);
    setError("");
    setComparison(null);
    setMigrationScript("");

    try {
      // Fetch passwords from keychain for both connections
      const sourcePassword = await getConnectionPassword(sourceConfig.name);
      const targetPassword = await getConnectionPassword(targetConfig.name);

      // Create connection configs with passwords
      const sourceConfigWithPassword = {
        ...sourceConfig,
        password: sourcePassword || "",
      };
      const targetConfigWithPassword = {
        ...targetConfig,
        password: targetPassword || "",
      };

      const result = await compareSchemas(sourceConfigWithPassword, targetConfigWithPassword);
      setComparison(result);

      // Generate migration script
      const script = await generateMigrationSql(result);
      setMigrationScript(script);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setComparing(false);
    }
  };

  const handleSaveScript = () => {
    if (!migrationScript) return;

    const blob = new Blob([migrationScript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `migration_${sourceConnectionName}_to_${targetConnectionName}_${Date.now()}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Added":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "Removed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "Modified":
        return <MinusCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "High":
        return "bg-red-500";
      case "Medium":
        return "bg-yellow-500";
      case "Low":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schema Comparison</DialogTitle>
          <DialogDescription>
            Compare database schemas between two connections
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Connection Selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Source (From)</Label>
              <Select
                value={sourceConnectionName}
                onValueChange={setSourceConnectionName}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source connection" />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((conn) => (
                    <SelectItem key={conn.name} value={conn.name}>
                      {conn.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target (To)</Label>
              <Select
                value={targetConnectionName}
                onValueChange={setTargetConnectionName}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target connection" />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((conn) => (
                    <SelectItem key={conn.name} value={conn.name}>
                      {conn.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Compare Button */}
          <div className="flex gap-3">
            <Button
              onClick={handleCompare}
              disabled={comparing || !sourceConnectionName || !targetConnectionName}
              className="flex-1"
            >
              {comparing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Compare Schemas
            </Button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Comparison Results */}
          {comparison && (
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="tables">Tables</TabsTrigger>
                <TabsTrigger value="warnings">
                  Warnings
                  {comparison.warnings.length > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {comparison.warnings.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="script">Migration Script</TabsTrigger>
              </TabsList>

              {/* Summary Tab */}
              <TabsContent value="summary" className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="text-sm text-gray-400 mb-1">Tables</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm">
                          {comparison.summary.tables_added} added
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span className="text-sm">
                          {comparison.summary.tables_removed} removed
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MinusCircle className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm">
                          {comparison.summary.tables_modified} modified
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="text-sm text-gray-400 mb-1">Indexes</div>
                    <div className="text-2xl font-semibold">
                      {comparison.summary.indexes_missing}
                    </div>
                    <div className="text-xs text-gray-500">changes detected</div>
                  </div>

                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="text-sm text-gray-400 mb-1">Views</div>
                    <div className="text-2xl font-semibold">
                      {comparison.summary.views_changed}
                    </div>
                    <div className="text-xs text-gray-500">changed</div>
                  </div>
                </div>
              </TabsContent>

              {/* Tables Tab */}
              <TabsContent value="tables" className="space-y-4">
                <div className="space-y-3">
                  {comparison.table_differences.map((tableDiff) => (
                    <div
                      key={tableDiff.table_name}
                      className="p-4 bg-gray-800 rounded-lg border border-gray-700"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        {getStatusIcon(tableDiff.status)}
                        <span className="font-semibold">{tableDiff.table_name}</span>
                        <Badge variant="outline" className="ml-auto">
                          {tableDiff.status}
                        </Badge>
                      </div>

                      {tableDiff.column_changes.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-xs text-gray-400">Column Changes:</div>
                          {tableDiff.column_changes.map((colChange) => (
                            <div
                              key={colChange.column_name}
                              className="flex items-center gap-2 text-sm pl-4"
                            >
                              {getStatusIcon(colChange.status)}
                              <span>{colChange.column_name}</span>
                              {colChange.changes.length > 0 && (
                                <span className="text-xs text-gray-500">
                                  ({colChange.changes.join(", ")})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {tableDiff.index_changes.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-xs text-gray-400">Index Changes:</div>
                          {tableDiff.index_changes.map((idxChange) => (
                            <div
                              key={idxChange.index_name}
                              className="flex items-center gap-2 text-sm pl-4"
                            >
                              {getStatusIcon(idxChange.status)}
                              <span>{idxChange.index_name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Warnings Tab */}
              <TabsContent value="warnings" className="space-y-3">
                {comparison.warnings.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No warnings detected
                  </div>
                ) : (
                  comparison.warnings.map((warning, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-gray-800 rounded-lg border border-gray-700"
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                          warning.severity === WARNING_SEVERITY.HIGH
                            ? "text-red-500"
                            : warning.severity === WARNING_SEVERITY.MEDIUM
                            ? "text-yellow-500"
                            : "text-blue-500"
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">{warning.message}</span>
                            <Badge
                              variant="outline"
                              className={`${getSeverityColor(warning.severity)} text-white border-0`}
                            >
                              {warning.severity}
                            </Badge>
                          </div>
                          {warning.details && (
                            <div className="text-sm text-gray-400">
                              {warning.details}
                            </div>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            Affects: {warning.affected_object}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Migration Script Tab */}
              <TabsContent value="script" className="space-y-4">
                <div className="flex gap-2">
                  <Button onClick={handleSaveScript} variant="outline">
                    Save Script
                  </Button>
                </div>
                <pre className="p-4 bg-gray-900 rounded-lg border border-gray-700 text-sm font-mono overflow-x-auto max-h-96 overflow-y-auto">
                  {migrationScript}
                </pre>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});
