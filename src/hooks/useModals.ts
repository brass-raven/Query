import { useState, useCallback } from "react";
import type { ConnectionConfig } from "../types";

export type ModalName =
  | "saveModal"
  | "commandPalette"
  | "queryBuilder"
  | "connectionModal"
  | "settings"
  | "schemaComparison"
  | "erd"
  | "projectPicker";

interface ModalState {
  saveModal: boolean;
  commandPalette: boolean;
  queryBuilder: boolean;
  connectionModal: boolean;
  settings: boolean;
  schemaComparison: boolean;
  erd: boolean;
  projectPicker: boolean;
}

interface UseModalsReturn {
  modals: ModalState;
  editingConnection: ConnectionConfig | null;
  setEditingConnection: (connection: ConnectionConfig | null) => void;
  openModal: (name: ModalName) => void;
  closeModal: (name: ModalName) => void;
  toggleModal: (name: ModalName) => void;
  closeAllModals: () => void;
}

const initialState: ModalState = {
  saveModal: false,
  commandPalette: false,
  queryBuilder: false,
  connectionModal: false,
  settings: false,
  schemaComparison: false,
  erd: false,
  projectPicker: false,
};

export function useModals(): UseModalsReturn {
  const [modals, setModals] = useState<ModalState>(initialState);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | null>(null);

  const openModal = useCallback((name: ModalName) => {
    setModals((prev) => ({ ...prev, [name]: true }));
  }, []);

  const closeModal = useCallback((name: ModalName) => {
    setModals((prev) => ({ ...prev, [name]: false }));
    // Clear editing connection when closing connection modal
    if (name === "connectionModal") {
      setEditingConnection(null);
    }
  }, []);

  const toggleModal = useCallback((name: ModalName) => {
    setModals((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  const closeAllModals = useCallback(() => {
    setModals(initialState);
    setEditingConnection(null);
  }, []);

  return {
    modals,
    editingConnection,
    setEditingConnection,
    openModal,
    closeModal,
    toggleModal,
    closeAllModals,
  };
}
