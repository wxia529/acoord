/**
 * Message protocol types for the extension side.
 *
 * Re-exports everything from the shared protocol so existing imports
 * (`from '../types/messages'`) continue to work without changes.
 */

export type {
  // Wire-format data types
  WireAtom,
  WireBond,
  WireUnitCell,
  WireUnitCellEdge,
  WireUnitCellParams,
  WireLightConfig,
  WireDisplaySettings,
  WireConfigEntry,
  WireRenderData,

  // Extension -> Webview
  RenderMessage,
  DisplayConfigChangedMessage,
  DisplayConfigsLoadedMessage,
  DisplayConfigLoadedMessage,
  DisplayConfigSavedMessage,
  CurrentDisplaySettingsMessage,
  DisplayConfigErrorMessage,
  ImageSavedMessage,
  ImageSaveFailedMessage,
  ExtensionToWebviewMessage,

  // Webview -> Extension
  GetStateMessage,
  SetTrajectoryFrameMessage,
  BeginDragMessage,
  EndDragMessage,
  UndoMessage,
  RedoMessage,
  SelectAtomMessage,
  SetSelectionMessage,
  SelectBondMessage,
  SetBondSelectionMessage,
  ToggleUnitCellMessage,
  SetUnitCellMessage,
  ClearUnitCellMessage,
  CenterToUnitCellMessage,
  SetSupercellMessage,
  AddAtomMessage,
  DeleteAtomMessage,
  DeleteAtomsMessage,
  MoveAtomMessage,
  MoveGroupMessage,
  SetAtomsPositionsMessage,
  CopyAtomsMessage,
  ChangeAtomsMessage,
  SetAtomColorMessage,
  UpdateAtomMessage,
  SetBondLengthMessage,
  CreateBondMessage,
  DeleteBondMessage,
  RecalculateBondsMessage,
  SaveStructureMessage,
  SaveStructureAsMessage,
  SaveRenderedImageMessage,
  OpenSourceMessage,
  ReloadStructureMessage,
  GetDisplayConfigsMessage,
  LoadDisplayConfigMessage,
  PromptSaveDisplayConfigMessage,
  SaveDisplayConfigMessage,
  GetCurrentDisplaySettingsMessage,
  UpdateDisplaySettingsMessage,
  ExportDisplayConfigsMessage,
  ImportDisplayConfigsMessage,
  ConfirmDeleteDisplayConfigMessage,
  DeleteDisplayConfigMessage,
  WebviewToExtensionMessage,

  // Utility types
  MessageByCommand,
  MessageCommand,
} from '../shared/protocol';

// ---------------------------------------------------------------------------
// Backward-compatible aliases
// ---------------------------------------------------------------------------

// The old extension-side code used `RenderData` (which referenced the
// extension's own Atom class).  Now the wire type is `WireRenderData`.
// Provide a convenience alias so that existing imports keep working.
import type { WireRenderData } from '../shared/protocol';
export type RenderData = WireRenderData;
