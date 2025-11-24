import { useState } from "react";
import { WARNING_SEVERITY, MACOS_TITLEBAR_TOP_PADDING } from "../../constants";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type {
  ConnectionConfig,
  SchemaComparison,
} from "../../types";
import { compareSchemas, generateMigrationSql, getConnectionPassword } from "../../utils/tauri";
import { DiffViewer } from "./DiffViewer";
import { ObjectSelectionTree } from "./ObjectSelectionTree";
import { WarningsPanel } from "./WarningsPanel";
import { MigrationScriptEditor } from "./MigrationScriptEditor";

interface SchemaComparisonPageProps {
  connections: ConnectionConfig[];
  onClose: () => void;
}

type FilterMode = "all" | "differences" | "conflicts";

export function SchemaComparisonPage({
  connections,
  onClose,
}: SchemaComparisonPageProps) {
  const [sourceConnection, setSourceConnection] =
    useState<ConnectionConfig | null>(null);
  const [targetConnection, setTargetConnection] =
    useState<ConnectionConfig | null>(null);
  const [comparison, setComparison] = useState<SchemaComparison | null>(null);
  const [migrationScript, setMigrationScript] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(
    new Set()
  );

  const runComparison = async () => {
    if (!sourceConnection || !targetConnection) {
      toast.error("Please select both source and target connections");
      return;
    }
    const sourcePassword = await getConnectionPassword(sourceConnection.name);
    const targetPassword = await getConnectionPassword(targetConnection.name);

    const sourceConfigWithPassword = {
      ...sourceConnection,
      password: sourcePassword || "",
    };
    const targetConfigWithPassword = {
      ...targetConnection,
      password: targetPassword || "",
    };

    setLoading(true);
    try {
      const result = await compareSchemas(sourceConfigWithPassword, targetConfigWithPassword);
      console.log("Comparison result:", result);
      console.log("Warnings:", result.warnings);
      console.log("Table differences:", result.table_differences);
      setComparison(result);

      // Generate migration script
      const script = await generateMigrationSql(result);
      setMigrationScript(script);

      // Auto-select all changes by default
      const allChanges = new Set<string>();
      result.table_differences.forEach((table) => {
        if (table.status !== "identical") {
          allChanges.add(`table:${table.table_name}`);
        }
      });
      setSelectedChanges(allChanges);

      toast.success("Schema comparison completed");
    } catch (error) {
      console.error("Failed to compare schemas:", error);
      toast.error(`Comparison failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const getDifferenceCount = () => {
    if (!comparison) return 0;
    return (
      comparison.table_differences.filter((t) => t.status !== "identical")
        .length +
      comparison.view_differences.filter((v) => v.status !== "identical")
        .length +
      comparison.routine_differences.filter((r) => r.status !== "identical")
        .length
    );
  };

  const getConflictCount = () => {
    return comparison?.warnings.filter((w) => w.severity === WARNING_SEVERITY.HIGH).length || 0;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b" style={{ paddingTop: `${MACOS_TITLEBAR_TOP_PADDING}px` }}>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Schema Comparison</h1>
            {comparison && (
              <p className="text-xs text-muted-foreground">
                {sourceConnection?.name} → {targetConnection?.name}
              </p>
            )}
          </div>
        </div>

        {/* Filter Buttons */}
        {comparison && (
          <div className="flex items-center gap-2">
            <Button
              variant={filterMode === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMode("all")}
            >
              Show All
            </Button>
            <Button
              variant={filterMode === "differences" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMode("differences")}
            >
              Show Differences Only ({getDifferenceCount()})
            </Button>
            <Button
              variant={filterMode === "conflicts" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMode("conflicts")}
            >
              Show Conflicts ({getConflictCount()})
            </Button>
          </div>
        )}
      </header>

      {/* Connection Selection */}
      {!comparison && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-4xl space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Source Schema</Label>
                <Select
                  value={sourceConnection?.name || ""}
                  onValueChange={(value) => {
                    const conn = connections.find((c) => c.name === value);
                    setSourceConnection(conn || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source..." />
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
                <Label>Target Schema</Label>
                <Select
                  value={targetConnection?.name || ""}
                  onValueChange={(value) => {
                    const conn = connections.find((c) => c.name === value);
                    setTargetConnection(conn || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target..." />
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

            <div className="flex justify-center">
              <Button
                onClick={runComparison}
                disabled={loading || !sourceConnection || !targetConnection}
                size="lg"
              >
                {loading ? "Comparing..." : "Compare Schemas"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Results */}
      {comparison && (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <Tabs defaultValue="summary" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-6 mt-4 w-fit flex-shrink-0">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="objects">Objects</TabsTrigger>
              <TabsTrigger value="diff">Side-by-Side Diff</TabsTrigger>
              <TabsTrigger value="warnings">
                Warnings ({comparison.warnings?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="script">Migration Script</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden px-6 py-4 min-h-0">
              <TabsContent value="summary" className="mt-0 h-full overflow-auto">
                {/* Summary will be implemented next */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold">Comparison Summary</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">
                        Tables Modified
                      </div>
                      <div className="text-2xl font-bold">
                        {comparison.summary.tables_modified}
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">
                        Tables Added
                      </div>
                      <div className="text-2xl font-bold text-green-500">
                        {comparison.summary.tables_added}
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">
                        Tables Removed
                      </div>
                      <div className="text-2xl font-bold text-red-500">
                        {comparison.summary.tables_removed}
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">
                        Indexes Missing
                      </div>
                      <div className="text-2xl font-bold">
                        {comparison.summary.indexes_missing}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="objects" className="mt-0 h-full overflow-hidden">
                <ObjectSelectionTree
                  comparison={comparison}
                  selectedChanges={selectedChanges}
                  onSelectionChange={setSelectedChanges}
                  filterMode={filterMode}
                />
              </TabsContent>

              <TabsContent value="diff" className="mt-0 h-full overflow-hidden">
                <DiffViewer
                  comparison={comparison}
                  filterMode={filterMode}
                />
              </TabsContent>

              <TabsContent value="warnings" className="mt-0 h-full overflow-hidden">
                <WarningsPanel warnings={comparison.warnings || []} />
              </TabsContent>

              <TabsContent value="script" className="mt-0 h-full overflow-hidden">
                <MigrationScriptEditor
                  migrationScript={migrationScript}
                  readOnly={false}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      )}
    </div>
  );
}
