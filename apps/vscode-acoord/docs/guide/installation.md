# Installation

This page covers different ways to install ACoord.

## Method 1: VS Code Marketplace (Recommended)

The easiest way to install ACoord is from the VS Code Marketplace.

### Steps

1. Open **Visual Studio Code**
2. Open the **Extensions** panel:
   - Keyboard: `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (macOS)
   - Menu: **View → Extensions**
3. Search for **"ACoord"**
4. Find the extension by publisher **wxia529**
5. Click **Install**

### Verify Installation

After installation:
1. Open any structure file (`.cif`, `.xyz`, etc.)
2. You should see the ACoord icon in the editor title bar
3. Click it to open the structure in 3D view

## Method 2: Install from VSIX

If you want to install a specific version or test pre-release builds:

### Steps

1. Download the `.vsix` file from:
   - [GitHub Releases](https://github.com/wxia529/vscode-acoord/releases)
   - Or build from source (see below)
2. In VS Code, open the **Extensions** panel
3. Click the `...` (More Actions) button
4. Select **Install from VSIX...**
5. Navigate to and select the downloaded `.vsix` file
6. Click **Install**

## Method 3: Build from Source

For development or latest features:

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/wxia529/vscode-acoord.git
cd vscode-acoord

# 2. Install dependencies
npm install

# 3. Build the extension
npm run compile

# 4. Package as VSIX (optional)
npm install -g @vscode/vsce
vsce package

# 5. Install the VSIX file
# Follow Method 2 steps above
```

### Development Mode

To test changes during development:

```bash
# Start watch mode
npm run watch

# Press F5 in VS Code to launch Extension Development Host
# This opens a new VS Code window with the extension loaded
```

## System Requirements

| Component | Requirement |
|-----------|-------------|
| VS Code | 1.109.0 or later |
| Node.js | 18+ (for building) |
| OS | Windows, macOS, or Linux |
| GPU | Any GPU supporting WebGL (for 3D rendering) |

## Uninstall

To remove ACoord:

1. Open **Extensions** panel in VS Code
2. Find **ACoord**
3. Click **Uninstall**
4. Reload VS Code if prompted

## Troubleshooting

### Extension Not Appearing

- Ensure VS Code is version 1.109.0 or later
- Check **File → Preferences → Settings → Extensions** to ensure extensions are enabled
- Try reloading VS Code (`Ctrl+Shift+P` → **Developer: Reload Window**)

### 3D View Not Rendering

- Check that your browser/webview supports WebGL
- Try disabling hardware acceleration in VS Code settings
- Update your graphics drivers

### File Not Opening

- Ensure the file extension is supported
- Try **Right-click → Reopen with → ACoord Structure Editor**
- Check the Output panel for error messages
