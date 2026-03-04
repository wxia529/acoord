/**
 * Message protocol types for the webview side.
 *
 * Re-exports everything from the shared protocol so existing imports
 * (`from './messages'`) continue to work without changes.
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
} from '../../../src/shared/protocol';

// ---------------------------------------------------------------------------
// Backward-compatible aliases
// ---------------------------------------------------------------------------

// The old webview code used `RenderData` which extended `Structure`.
// Now the canonical wire type is `WireRenderData`.
import type { WireRenderData } from '../../../src/shared/protocol';
export type RenderData = WireRenderData;
