import type { DiffStatus, WarningSeverity } from "../types";

// Status badge styles
export const STATUS_BADGE_STYLES: Record<DiffStatus, { bg: string; text: string; border: string }> = {
  identical: {
    bg: "bg-gray-500/20",
    text: "text-gray-400",
    border: "border-gray-500/30",
  },
  modified: {
    bg: "bg-blue-500/20",
    text: "text-blue-400",
    border: "border-blue-500/30",
  },
  added: {
    bg: "bg-green-500/20",
    text: "text-green-400",
    border: "border-green-500/30",
  },
  removed: {
    bg: "bg-red-500/20",
    text: "text-red-400",
    border: "border-red-500/30",
  },
};

// Warning severity badge styles
export const SEVERITY_BADGE_STYLES: Record<WarningSeverity, { bg: string; text: string; icon: string }> = {
  high: {
    bg: "bg-red-500/20",
    text: "text-red-400",
    icon: "⚠️",
  },
  medium: {
    bg: "bg-yellow-500/20",
    text: "text-yellow-400",
    icon: "⚠️",
  },
  low: {
    bg: "bg-blue-500/20",
    text: "text-blue-400",
    icon: "ℹ️",
  },
};

// Status display labels
export const STATUS_LABELS: Record<DiffStatus, string> = {
  identical: "Identical",
  modified: "Modified",
  added: "Added",
  removed: "Removed",
};

// Warning severity display labels
export const SEVERITY_LABELS: Record<WarningSeverity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

// macOS UI dimensions
export const MACOS_TITLEBAR_TOP_PADDING = 28; // Height for traffic light buttons
export const MACOS_TITLEBAR_LEFT_PADDING = 72; // Left padding for traffic lights
export const SIDEBAR_FOOTER_HEIGHT = 240; // Height reserved for sidebar footer
export const GIT_STATUS_POLL_INTERVAL = 10000; // 10 seconds
export const MESSAGE_AUTO_CLEAR_DELAY = 5000; // 5 seconds
