# ACoord Migration Progress

**Started:** 2026-03-04  
**Current Phase:** Phase 1 - Critical Bug Fixes  
**Status:** ✅ COMPLETED

---

## Phase 1: Critical Bug Fixes

### 1.1 Fire onDidChangeCustomDocument (CRITICAL) ✅

**Status:** COMPLETED  
**Files Modified:** `src/providers/structureEditorProvider.ts`

**Changes Made:**
- Added `notifyDocumentChanged()` method to fire `CustomDocumentEditEvent` with proper undo/redo callbacks
- Tracks undo stack depth before/after message handling to detect structural changes
- Fires the event when:
  - Structural edit commands push to undo stack (detected via undo depth change)
  - Undo operations modify document content
  - Redo operations modify document content

**Implementation Details:**
```typescript
private notifyDocumentChanged(session: EditorSession, label: string = 'Structure modified'): void {
  this._onDidChangeCustomDocument.fire({
    document: session.document,
    undo: async () => { this.undoLastEdit(session); },
    redo: async () => { this.redoLastEdit(session); },
    label,
  });
}
```

**Verification:** VS Code will now prompt "Do you want to save?" when closing modified files.

---

### 1.2 Implement backupCustomDocument (HIGH) ✅

**Status:** COMPLETED  
**Files Modified:** `src/providers/structureEditorProvider.ts`

**Changes Made:**
- Changed from returning empty backup to actually serializing data
- Serializes all trajectory frames to JSON and writes to backup URI
- Preserves structure data, bonds, unit cells, and all metadata

**Implementation Details:**
```typescript
async backupCustomDocument(
  document: vscode.CustomDocument,
  context: vscode.CustomDocumentBackupContext,
  _cancellationToken: vscode.CancellationToken
): Promise<vscode.CustomDocumentBackup> {
  const backupUri = context.destination;
  const session = this.findSessionByDocument(document as StructureDocument);
  if (session) {
    const data = JSON.stringify(session.trajectoryManager.frames.map(f => f.toJSON()));
    await vscode.workspace.fs.writeFile(backupUri, Buffer.from(data));
  }
  return { id: backupUri.toString(), delete: async () => {...} };
}
```

**Verification:** Hot exit and crash recovery now preserve edits.

---

### 1.3 Fix Session Key Collision (HIGH) ✅

**Status:** COMPLETED  
**Files Modified:** `src/providers/structureEditorProvider.ts`

**Changes Made:**
- Added `nextSessionId` counter to generate unique session IDs
- Changed session key from `document.uri.fsPath` to `session_${++this.nextSessionId}`
- Added `document` reference to `EditorSession` class for proper session-to-document mapping
- Added `findSessionByDocument()` helper method to look up sessions by document reference
- Updated `saveCustomDocument` and `saveCustomDocumentAs` to use the new lookup method

**Implementation Details:**
```typescript
// Before:
const key = uri;  // Same file in split view = same key

// After:
const key = `session_${++this.nextSessionId}`;  // Unique per panel
```

**Verification:** Same file can now be opened in multiple split-view panels independently.

---

### 1.4 Add Error Handling to MessageRouter.route() (HIGH) ✅

**Status:** COMPLETED  
**Files Modified:** `src/services/messageRouter.ts`

**Changes Made:**
- Wrapped handler execution in try/catch block
- Logs errors to console with command context
- Shows user-facing error messages via `vscode.window.showErrorMessage`
- Returns `true` to claim the message was handled (prevents further dispatch attempts)

**Implementation Details:**
```typescript
async route(message: WebviewToExtensionMessage): Promise<boolean> {
  const handler = this.handlers.get(message.command);
  if (!handler) {
    return false;
  }
  try {
    return await handler(message);
  } catch (error) {
    console.error(`[ACoord] Handler for '${message.command}' threw:`, error);
    vscode.window.showErrorMessage(
      `ACoord: Command '${message.command}' failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return true;
  }
}
```

**Verification:** Handler exceptions no longer crash the extension host.

---

### Bonus: Implement revertCustomDocument ✅

**Status:** COMPLETED  
**Files Modified:** `src/providers/structureEditorProvider.ts`

**Changes Made:**
- Implemented proper revert functionality that:
  - Re-reads the file from disk
  - Replaces trajectory manager's frames
  - Clears undo stack
  - Resets selection
  - Re-renders the view

**Implementation Details:**
```typescript
async revertCustomDocument(
  document: StructureDocument,
  _cancellationToken: vscode.CancellationToken
): Promise<void> {
  const session = this.findSessionByDocument(document);
  if (!session) { return; }

  try {
    const updatedFrames = await StructureDocumentManager.load(document.uri);
    // ... reload structure, reset state, re-render
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to revert document: ...`);
  }
}
```

**Verification:** "Revert File" command now properly restores original file state.

---

## Summary

All Phase 1 critical bugs have been fixed:

| Issue | Severity | Status |
|-------|----------|--------|
| Fire onDidChangeCustomDocument | CRITICAL | ✅ Fixed |
| Implement backupCustomDocument | HIGH | ✅ Fixed |
| Fix Session Key Collision | HIGH | ✅ Fixed |
| Add Error Handling to MessageRouter | HIGH | ✅ Fixed |
| Implement revertCustomDocument | MEDIUM | ✅ Fixed (bonus) |

**Next Steps:** Proceed to Phase 2 - Type Safety & Error Handling

---

## Migration Roadmap

- [x] **Phase 1:** Critical Bug Fixes
- [ ] **Phase 2:** Type Safety & Error Handling
- [ ] **Phase 3:** Architecture — Extension Host
- [ ] **Phase 4:** Architecture — Webview
- [ ] **Phase 5:** Performance
- [ ] **Phase 6:** Parser Correctness
- [ ] **Phase 7:** Testing & CI
- [ ] **Phase 8:** Cleanup & Polish

**Estimated Total Effort:** 15-25 development days  
**Completed:** ~2-3 days (Phase 1)
