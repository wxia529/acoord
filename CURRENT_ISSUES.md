# ACoord — Current Codebase Issues

**Last Updated:** 2026-03-11
**Codebase Version:** 0.3.3
**Scope:** Issues verified against current source code. No aspirational items.

This document catalogs **verified, open issues** in the current ACoord
codebase, organized by severity and category. Each issue includes the file,
line numbers, impact, and the recommended fix.

When an issue is resolved, move it to the **Resolved** section at the bottom
with a note on the commit/date. Do not delete resolved entries — they serve as
a record of why a design decision was made.

---

## Table of Contents

1. [Architecture & Design](#1-architecture--design)
2. [Type Safety](#2-type-safety)
3. [Error Handling Inconsistencies](#3-error-handling-inconsistencies)
4. [Parser Issues](#4-parser-issues)
5. [Webview Issues](#5-webview-issues)
6. [Dead Code](#6-dead-code)
7. [Test Coverage Gaps](#7-test-coverage-gaps)
8. [Active Bugs](#8-active-bugs)

---

## Resolved Issues

### [2026-03-11] Right-Drag Rotation Not Persisted

**Severity:** High  
**Status:** Resolved

**Root Cause:**  
In `interaction.ts:588-590`, the code attempted to access `window.vscode` to send the `setAtomsPositions` message after a right-drag rotation. However, `window.vscode` does not exist — the `vscode` API object is a module-local variable in `app.ts` obtained via `acquireVsCodeApi()`.

**Fix Applied:**
1. Added `onSetAtomsPositions` callback to `InteractionHandlers` interface in `interaction.ts:66`
2. Modified `interaction.ts:582-594` to use `handlers.onSetAtomsPositions()` instead of `window.vscode.postMessage()`
3. Added `onSetAtomsPositions` implementation in `app.ts:338-340` that properly sends the message via the module-local `vscode` object

**Files Changed:**
- `media/webview/src/interaction.ts` — Added callback to interface, replaced direct `window.vscode` access with handler callback
- `media/webview/src/app.ts` — Added `onSetAtomsPositions` handler

**Note:** This fix follows the existing pattern used by other handlers (e.g., `onEndDrag`, `onDragGroup`) which correctly use the handler callback mechanism.

---

## 8. Active Bugs

*(No active bugs at this time)*
