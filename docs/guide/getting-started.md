# Getting Started

This guide will help you get up and running with ACoord in just a few minutes.

## Prerequisites

- Visual Studio Code 1.109.0 or later
- Any structure file (`.cif`, `.xyz`, `POSCAR`, etc.)

## Step 1: Install ACoord

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X or Cmd+Shift+X)
3. Search for "ACoord"
4. Click **Install**

### From VSIX File

1. Download the `.vsix` file from the [GitHub Releases](https://github.com/wxia529/vscode-acoord/releases)
2. In VS Code, click the `...` menu in the Extensions panel
3. Select **Install from VSIX...**
4. Choose the downloaded `.vsix` file

## Step 2: Open a Structure File

1. Open VS Code
2. Open any supported structure file:
   - Drag and drop the file into VS Code
   - Or use **File → Open File...**
3. ACoord will automatically detect the file type
4. Click the **ACoord Structure Editor** icon in the editor title bar (or right-click → **Reopen with → ACoord Structure Editor**)

## Step 3: Explore Your Structure

Once opened, you'll see:

- **3D View** — Interactive 3D rendering of your structure
- **Navigation Controls**:
  - Left-click + drag: Rotate
  - Right-click + drag: Pan
  - Scroll: Zoom in/out
- **Side Panel** — Atom list, selection info, and tools

## Step 4: Try Basic Operations

### Select Atoms
- Click on an atom to select it
- Hold Shift + click to multi-select
- Use box selection (drag with modifier key)

### View Bonds
- Bonds are automatically calculated
- Click **Measure** to see bond distances

### Change View Settings
- Use the display settings panel to adjust:
  - Atom size
  - Bond style
  - Color scheme
  - Lighting

## What's Next?

- [Installation](/guide/installation) — More installation options
- [Viewing Structures](/tutorials/viewing-structures) — Detailed viewing tutorial
- [Editing Atoms](/tutorials/editing-atoms) — Learn to edit structures
- [Features Overview](/features/) — Explore all features
