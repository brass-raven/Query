import { useState, useCallback, useEffect } from "react";
import { getVimModeEnabled, setVimModeEnabled } from "../utils/tauri";

export type LayoutDirection = "vertical" | "horizontal";

interface UseLayoutPreferencesReturn {
  vimMode: boolean;
  setVimMode: (enabled: boolean) => Promise<void>;
  compactView: boolean;
  setCompactView: (compact: boolean) => void;
  fullScreenResults: boolean;
  setFullScreenResults: (fullScreen: boolean) => void;
  layoutDirection: LayoutDirection;
  setLayoutDirection: (direction: LayoutDirection) => void;
  readOnlyMode: boolean;
  setReadOnlyMode: (readOnly: boolean) => void;
  toggleLayoutDirection: () => void;
  toggleFullScreenResults: () => void;
}

export function useLayoutPreferences(): UseLayoutPreferencesReturn {
  const [vimMode, setVimModeState] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [fullScreenResults, setFullScreenResults] = useState(false);
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>("vertical");
  const [readOnlyMode, setReadOnlyMode] = useState(false);

  // Load vim mode setting on mount
  useEffect(() => {
    async function loadVimMode() {
      try {
        const enabled = await getVimModeEnabled();
        setVimModeState(enabled);
      } catch (error) {
        console.error("Failed to load vim mode setting:", error);
      }
    }
    loadVimMode();
  }, []);

  const setVimMode = useCallback(async (enabled: boolean) => {
    setVimModeState(enabled);
    try {
      await setVimModeEnabled(enabled);
    } catch (error) {
      console.error("Failed to save vim mode setting:", error);
    }
  }, []);

  const toggleLayoutDirection = useCallback(() => {
    setLayoutDirection((prev) => (prev === "vertical" ? "horizontal" : "vertical"));
  }, []);

  const toggleFullScreenResults = useCallback(() => {
    setFullScreenResults((prev) => !prev);
  }, []);

  return {
    vimMode,
    setVimMode,
    compactView,
    setCompactView,
    fullScreenResults,
    setFullScreenResults,
    layoutDirection,
    setLayoutDirection,
    readOnlyMode,
    setReadOnlyMode,
    toggleLayoutDirection,
    toggleFullScreenResults,
  };
}
