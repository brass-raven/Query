import type { ComparisonWarning } from "../../types";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "../../lib/utils";
import { WARNING_SEVERITY } from "../../constants";

interface WarningsPanelProps {
  warnings: ComparisonWarning[];
}

export function WarningsPanel({ warnings }: WarningsPanelProps) {
  const highRiskWarnings = warnings.filter((w) => w.severity === WARNING_SEVERITY.HIGH);
  const mediumRiskWarnings = warnings.filter((w) => w.severity === WARNING_SEVERITY.MEDIUM);
  const lowRiskWarnings = warnings.filter((w) => w.severity === WARNING_SEVERITY.LOW);

  if (warnings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Info className="h-12 w-12 mb-4 text-green-500" />
        <p className="text-lg font-medium">No Warnings Detected</p>
        <p className="text-sm">All changes appear safe to apply</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 flex-shrink-0 mb-6">
        <h2 className="text-lg font-semibold">Schema Change Warnings</h2>
        <div className="flex gap-2 text-sm">
          {highRiskWarnings.length > 0 && (
            <span className="px-2 py-1 rounded bg-red-500/20 text-red-400">
              {highRiskWarnings.length} High Risk
            </span>
          )}
          {mediumRiskWarnings.length > 0 && (
            <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
              {mediumRiskWarnings.length} Medium Risk
            </span>
          )}
          {lowRiskWarnings.length > 0 && (
            <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">
              {lowRiskWarnings.length} Low Risk
            </span>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto min-h-0 space-y-6">
      {/* High Risk Warnings */}
      {highRiskWarnings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-red-400 font-medium">
            <AlertTriangle className="h-5 w-5" />
            <h3>🔴 HIGH RISK</h3>
          </div>
          <div className="space-y-2 pl-7">
            {highRiskWarnings.map((warning, idx) => (
              <WarningCard key={idx} warning={warning} severity={WARNING_SEVERITY.HIGH} />
            ))}
          </div>
        </div>
      )}

      {/* Medium Risk Warnings */}
      {mediumRiskWarnings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-yellow-400 font-medium">
            <AlertCircle className="h-5 w-5" />
            <h3>🟡 MEDIUM RISK</h3>
          </div>
          <div className="space-y-2 pl-7">
            {mediumRiskWarnings.map((warning, idx) => (
              <WarningCard key={idx} warning={warning} severity={WARNING_SEVERITY.MEDIUM} />
            ))}
          </div>
        </div>
      )}

      {/* Low Risk Warnings */}
      {lowRiskWarnings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-blue-400 font-medium">
            <Info className="h-5 w-5" />
            <h3>🟢 LOW RISK</h3>
          </div>
          <div className="space-y-2 pl-7">
            {lowRiskWarnings.map((warning, idx) => (
              <WarningCard key={idx} warning={warning} severity={WARNING_SEVERITY.LOW} />
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function WarningCard({
  warning,
  severity,
}: {
  warning: ComparisonWarning;
  severity: "high" | "medium" | "low";
}) {
  const borderColors = {
    high: "border-red-500/50 bg-red-500/10",
    medium: "border-yellow-500/50 bg-yellow-500/10",
    low: "border-blue-500/50 bg-blue-500/10",
  };

  const badgeColors = {
    high: "bg-red-500/20 text-red-400",
    medium: "bg-yellow-500/20 text-yellow-400",
    low: "bg-blue-500/20 text-blue-400",
  };

  // Capitalize for display
  const displaySeverity = severity.charAt(0).toUpperCase() + severity.slice(1);

  return (
    <div
      className={cn(
        "border rounded-lg p-4 space-y-2",
        borderColors[severity]
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-medium text-sm">{warning.message}</p>
          {warning.details && (
            <p className="text-sm text-muted-foreground mt-1">
              {warning.details}
            </p>
          )}
        </div>
        <span
          className={cn(
            "px-2 py-0.5 rounded text-xs whitespace-nowrap",
            badgeColors[severity]
          )}
        >
          {displaySeverity}
        </span>
      </div>

      {warning.affected_object && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Affected object:</span>
          <code className="px-1.5 py-0.5 bg-muted rounded font-mono">
            {warning.affected_object}
          </code>
        </div>
      )}

      {/* Additional context based on warning type */}
      {severity === WARNING_SEVERITY.HIGH && (
        <div className="flex items-start gap-2 text-xs mt-3 pt-3 border-t border-red-500/30">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5" />
          <div className="text-muted-foreground">
            <strong className="text-foreground">Recommended actions:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Create a backup before proceeding</li>
              <li>Review the affected data carefully</li>
              <li>Consider running in a test environment first</li>
            </ul>
          </div>
        </div>
      )}

      {severity === WARNING_SEVERITY.MEDIUM && (
        <div className="flex items-start gap-2 text-xs mt-3 pt-3 border-t border-yellow-500/30">
          <AlertCircle className="h-3.5 w-3.5 text-yellow-400 mt-0.5" />
          <div className="text-muted-foreground">
            <strong className="text-foreground">Note:</strong> This operation may cause temporary
            table locks or performance impact during execution.
          </div>
        </div>
      )}
    </div>
  );
}
