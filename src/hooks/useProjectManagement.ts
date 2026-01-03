import { useState, useCallback } from "react";
import {
  getCurrentProjectPath,
  setProjectPath,
  getRecentProjects,
  loadProjectSettings,
} from "../utils/tauri";
import type { RecentProject } from "../types";

interface UseProjectManagementReturn {
  currentProjectPath: string | null;
  recentProjects: RecentProject[];
  loadCurrentProjectPath: () => Promise<void>;
  loadRecentProjects: () => Promise<void>;
  changeProject: (path: string) => Promise<void>;
  initializeProjectSettings: () => Promise<void>;
}

export function useProjectManagement(): UseProjectManagementReturn {
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  const loadCurrentProjectPath = useCallback(async () => {
    try {
      const path = await getCurrentProjectPath();
      setCurrentProjectPath(path);
    } catch (error) {
      console.error("Failed to load project path:", error);
    }
  }, []);

  const loadRecentProjects = useCallback(async () => {
    try {
      const projects = await getRecentProjects();
      setRecentProjects(projects);
    } catch (error) {
      console.error("Failed to load recent projects:", error);
    }
  }, []);

  const changeProject = useCallback(async (path: string) => {
    await setProjectPath(path);
    setCurrentProjectPath(path);
    await loadRecentProjects();
  }, [loadRecentProjects]);

  const initializeProjectSettings = useCallback(async () => {
    try {
      await loadProjectSettings();
      await loadCurrentProjectPath();
      await loadRecentProjects();
    } catch (error) {
      console.error("Failed to initialize project settings:", error);
    }
  }, [loadCurrentProjectPath, loadRecentProjects]);

  return {
    currentProjectPath,
    recentProjects,
    loadCurrentProjectPath,
    loadRecentProjects,
    changeProject,
    initializeProjectSettings,
  };
}
