# acoord-3d

> **Note**: This library is part of the [acoord monorepo](../../README.md). For development, use `npx nx run acoord-3d:build` or `npm run watch` from the monorepo root.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/acoord-3d.svg)](https://www.npmjs.com/package/acoord-3d)

Atomic structure 3D rendering engine powered by Three.js.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Core API](#core-api)
5. [Type Definitions](#type-definitions)
6. [State Management](#state-management)
7. [Rendering Engine](#rendering-engine)
8. [Performance](#performance)
9. [Testing](#testing)
10. [Build & Publish](#build--publish)

---

## Overview

**acoord-3d** is a 3D rendering engine designed for atomic structure visualization, built on Three.js. It provides high-performance atom and bond rendering, interactive camera controls, and a flexible state management system.

### Features

- **High-Performance Rendering**: Uses `InstancedMesh` to significantly reduce draw calls
- **Interactive Controls**: Atom dragging, selection, camera rotation and pan
- **Flexible State Management**: Supports external state injection for VS Code Webview integration
- **Professional Lighting**: Four-point lighting system (ambient, key, fill, rim)
- **Multiple Projection Modes**: Orthographic and perspective projection
- **Unit Cell Visualization**: Crystal unit cell edge display

### Tech Stack

- **Runtime**: Three.js r183
- **Build Tool**: esbuild
- **Language**: TypeScript 5.9+
- **Test Framework**: Mocha + Chai

---

## Quick Start

### Installation

```bash
npm install acoord-3d three
```

### Basic Usage

```typescript
import { createRenderer } from 'acoord-3d';

const renderer = createRenderer({
  canvas: document.getElementById('canvas') as HTMLCanvasElement,
  providers: {
    structure: structureStore,
    display: displayStore,
    lighting: lightingStore,
  },
  onError: (message) => console.error(message),
  onStatus: (message) => console.log(message),
  onCameraChange: (quaternion) => {
    // Handle camera changes
  },
});

renderer.renderStructure({
  atoms: [
    {
      id: '1',
      element: 'C',
      position: [0, 0, 0],
      color: '#333333',
      radius: 0.77,
    },
    {
      id: '2',
      element: 'H',
      position: [1, 0, 0],
      color: '#FFFFFF',
      radius: 0.37,
    },
  ],
  bonds: [],
  unitCell: null,
  unitCellParams: null,
  supercell: [1, 1, 1],
  selectedAtomIds: [],
  selectedBondKeys: [],
  trajectoryFrameIndex: 0,
  trajectoryFrameCount: 1,
});
```

---

## Architecture

### Module Structure

```
acoord-3d/
├── src/
│   ├── index.ts                 # Main entry, exports all public APIs
│   ├── renderer/
│   │   ├── factory.ts           # Factory function
│   │   ├── renderer.ts          # Core rendering engine
│   │   └── types.ts             # Renderer type definitions
│   ├── state/
│   │   ├── store.ts             # State definitions
│   │   └── provider.ts          # State provider
│   ├── types/
│   │   └── wire.ts              # Wire protocol types
│   ├── utils/
│   │   └── performance.ts       # Performance utilities
│   └── axis-indicator/
│       └── index.ts             # Axis indicator
├── test/
│   ├── renderer/
│   │   └── factory.test.ts
│   └── state/
│       └── provider.test.ts
└── README.md                    # This document
```

### Design Principles

#### 1. Separation of Concerns

- **Rendering Layer**: `StructureRenderer` handles all Three.js operations
- **State Layer**: Independent Store system manages application state
- **Protocol Layer**: Wire types define data exchange format with external systems

#### 2. Dependency Injection

State management uses dependency injection via `StoreProvider`:

```typescript
interface StoreProvider {
  structure: StructureState;
  display: DisplayState;
  lighting: LightingState;
}
```

#### 3. Immutable Updates

State updates follow immutable patterns for predictable state changes.

---

## Core API

### createRenderer(options)

Factory function to create renderer instances.

**Parameters:**

```typescript
interface CreateRendererOptions {
  canvas: HTMLCanvasElement;
  providers?: StoreProvider;
  onError?: (message: string) => void;
  onStatus?: (message: string) => void;
  onCameraChange?: (quaternion: THREE.Quaternion) => void;
}
```

**Returns:** `RendererApi` instance

**Example:**

```typescript
const renderer = createRenderer({
  canvas: myCanvas,
  providers: customProvider,
  onError: (msg) => showError(msg),
  onCameraChange: (quat) => updateAxisIndicator(quat),
});
```

### RendererApi

Core renderer interface with all rendering and control methods.

#### Methods

##### init(canvas: HTMLCanvasElement)

Initialize the renderer, setting up Three.js scene, camera, renderer, and controls.

**Internal Flow:**
1. Create Three.js scene
2. Initialize camera (orthographic or perspective based on config)
3. Create WebGL renderer
4. Setup TrackballControls
5. Configure lighting system
6. Initialize axis indicator
7. Bind event listeners

##### renderStructure(data, hooks?, options?)

Render atomic structure data.

**Parameters:**

```typescript
interface Structure {
  atoms: Atom[];
  bonds: Bond[];
  renderAtoms?: Atom[];      // Optional, defaults to atoms
  renderBonds?: Bond[];      // Optional, defaults to bonds
  unitCell: UnitCell | null;
  unitCellParams: UnitCellParams | null;
  supercell: [number, number, number];
  selectedAtomIds: string[];
  selectedBondKeys: string[];
  selectedAtomId?: string;   // Optional, single selected atom
  selectedBondKey?: string;  // Optional, single selected bond
  trajectoryFrameIndex: number;
  trajectoryFrameCount: number;
}

interface UiHooks {
  updateCounts: (atomCount: number, bondCount: number) => void;
  updateAtomList: (atoms: Atom[], selectedIds: string[], selectedId: string | null) => void;
}

interface RenderOptions {
  fitCamera?: boolean;
}
```

**Render Flow:**
1. Calculate scale (auto or manual)
2. Clean up old scene objects
3. Group atoms by radius for InstancedMesh
4. Create atom instanced meshes
5. Create bond half-cylinder instanced meshes
6. Build unit cell edges
7. Add fixed atom markers
8. Trigger UI hooks
9. Optionally fit camera

##### fitCamera()

Automatically adjust camera position and zoom to fit the structure.

**Algorithm:**
1. Calculate bounding box of all atoms
2. Compute appropriate camera distance from bounds
3. Adjust camera near/far planes
4. Update controls target

##### setProjectionMode(mode: 'orthographic' | 'perspective')

Switch camera projection mode.

**Implementation:**
- Preserve current camera position and target
- Recreate camera object
- Migrate controls to new camera

##### snapCameraToAxis(axis: string)

Align camera to specified axis direction.

**Supported axes:** `'a'`, `'-a'`, `'b'`, `'-b'`, `'c'`, `'-c'`

##### updateAtomPosition(atomId: string, position: THREE.Vector3)

Incrementally update single atom position for drag interaction.

**Optimization:**
1. Update hit-test mesh position
2. Update instance matrix in InstancedMesh
3. Incrementally update related bond half-cylinders
4. Update fixed atom marker

##### exportHighResolutionImage(options?)

Export high-resolution rendered image.

**Parameters:**

```typescript
interface ExportOptions {
  scale?: number;  // Default: 4
}
```

**Returns:** `{ dataUrl: string; width: number; height: number } | null`

**Implementation:**
1. Temporarily increase render resolution
2. Re-render scene
3. Export as PNG DataURL
4. Restore original resolution

##### dispose()

Clean up all resources to prevent memory leaks.

**Cleanup:**
- Cancel animation frame
- Remove event listeners
- Dispose all geometries and materials
- Release WebGL resources

##### Other Methods

```typescript
// Get camera scale
getScale(): number;

// Get raycaster (for selection)
getRaycaster(): THREE.Raycaster;

// Get normalized mouse coordinates
getMouse(): THREE.Vector2;

// Get camera object
getCamera(): THREE.Camera;

// Get atom mesh map
getAtomMeshes(): Map<string, THREE.Mesh>;

// Get bond mesh array
getBondMeshes(): THREE.Mesh[];

// Get drag plane
getDragPlane(): THREE.Plane;

// Set controls enabled state
setControlsEnabled(enabled: boolean): void;

// Set camera move callback
setOnCameraMove(callback: (() => void) | null): void;

// Manually mark scene dirty for re-render
markDirty(): void;

// Rotate camera around specified axis
rotateCameraBy(axis: 'tiltUp' | 'tiltDown' | 'rotateLeft' | 'rotateRight' | 'rollCCW' | 'rollCW', angleDeg: number): void;
```

---

## Type Definitions

### Core Types

#### Atom (WireAtom)

```typescript
interface WireAtom {
  id: string;                    // Unique identifier
  element: string;               // Element symbol
  color: string;                 // Display color (hex)
  position: [number, number, number];  // 3D coordinates
  radius: number;                // Atomic radius
  selected?: boolean;            // Is selected
  selectable?: boolean;          // Is selectable
  fixed?: boolean;               // Is fixed
}
```

#### Bond (WireBond)

```typescript
interface WireBond {
  key: string;                   // Unique key (usually "atomId1-atomId2")
  atomId1: string;               // First atom ID
  atomId2: string;               // Second atom ID
  start: [number, number, number];   // Bond start coordinates
  end: [number, number, number];     // Bond end coordinates
  radius: number;                // Bond radius
  color: string;                 // Bond color
  color1?: string;               // Half-bond 1 color (optional)
  color2?: string;               // Half-bond 2 color (optional)
  selected?: boolean;            // Is selected
  periodicStub?: true;           // Is periodic boundary bond
}
```

#### UnitCell (WireUnitCell)

```typescript
interface WireUnitCell {
  corners?: [number, number, number][];
  edges: WireUnitCellEdge[];
}

interface WireUnitCellEdge {
  start: [number, number, number];
  end: [number, number, number];
  radius?: number;
  color?: string;
}
```

#### LightConfig (WireLightConfig)

```typescript
interface WireLightConfig {
  intensity: number;
  color: string;
  x: number;
  y: number;
  z: number;
}
```

---

## State Management

### State Stores

#### StructureState

```typescript
interface StructureState {
  currentStructure: Structure | null;
  currentSelectedAtom: Atom | null;
  currentSelectedBondKey: string | null;
}
```

#### DisplayState

```typescript
interface DisplayState {
  showAxes: boolean;
  backgroundColor: string;
  unitCellColor: string;
  unitCellThickness: number;
  unitCellLineStyle: 'solid' | 'dashed';
  currentRadiusByElement: Record<string, number>;
  atomSizeElementExpanded: boolean;
  shininess: number;
  manualScale: number;
  autoScaleEnabled: boolean;
  currentRadiusScale: number;
  bondThicknessScale: number;
  viewZoom: number;
  scaleAtomsWithLattice: boolean;
  projectionMode: 'orthographic' | 'perspective';
  supercell: [number, number, number];
  unitCellEditing: boolean;
  currentColorScheme: string;
  currentColorByElement: Record<string, string>;
}
```

#### LightingState

```typescript
interface LightingState {
  lightingEnabled: boolean;
  ambientIntensity: number;
  ambientColor: string;
  keyLight: LightConfig;
  fillLight: LightConfig;
  rimLight: LightConfig;
}
```

#### SelectionState

```typescript
interface SelectionState {
  selectedAtomIds: string[];
  selectedBondKeys: string[];
}
```

#### InteractionState

```typescript
interface InteractionState {
  isDragging: boolean;
  dragAtomId: string | null;
  lastDragWorld: { x: number; y: number; z: number } | null;
  dragPlaneNormal: { x: number; y: number; z: number } | null;
  rotationAxis: string;
  rotationInProgress: boolean;
  groupMoveActive: boolean;
  renderAtomOffsets: Record<string, [number, number, number]>;
  shouldFitCamera: boolean;
  addingAtomElement: string | null;
  boxSelectionMode: 'atoms' | 'bonds' | 'both';
  currentTool: 'select' | 'add' | 'delete';
  rightDragType: 'none' | 'camera' | 'rotate' | 'move';
  rightDragStart: { x: number; y: number } | null;
  rightDragMoved: boolean;
  rightDragRotationBase: { id: string; pos: [number, number, number] }[] | null;
  rightDragRotationPivot: [number, number, number] | null;
  rightDragRotationAccumulatedDelta: { x: number; y: number } | null;
  rightDragLastDelta: { x: number; y: number } | null;
}
```

#### TrajectoryState

```typescript
interface TrajectoryState {
  trajectoryFrameIndex: number;
  trajectoryFrameCount: number;
  trajectoryPlaying: boolean;
  trajectoryPlaybackFps: number;
}
```

#### AdsorptionState

```typescript
interface AdsorptionState {
  adsorptionReferenceId: string | null;
  adsorptionAdsorbateIds: string[];
}
```

### State Provider

```typescript
// Set custom state provider
setStoreProvider(provider: StoreProvider): void;

// Get state stores
getStructureStore(): StructureState;
getDisplayStore(): DisplayState;
getLightingStore(): LightingState;
```

---

## Rendering Engine

### Scene Graph

```
Scene
├── Lights (Ambient, Key, Fill, Rim)
├── Atom InstancedMeshes (grouped by radius)
├── Bond InstancedMeshes (grouped by radius/emissive)
├── UnitCell Group (optional)
├── Fixed Atom Markers (optional)
└── Hit-test Meshes (invisible, for raycasting)
```

### InstancedMesh Optimization

#### Atom Grouping Strategy

Atoms are grouped by visual radius to share `InstancedMesh`:
- Filter non-selectable atoms (`selectable: false`)
- Selected atoms scaled 12% larger
- Radius rounded to 3 decimals as group key

#### Bond Half-Cylinder Rendering

Each bond split into two half-cylinders for dual-color support:
- Grouped by `(radius, emissive)`
- Supports periodic boundary bonds (`periodicStub`)

### Incremental Updates

`updateAtomPosition()` updates only affected objects:
1. Update atom hit-test mesh
2. Update corresponding instance in InstancedMesh
3. Incrementally update related bond half-cylinder matrices
4. Update fixed atom marker

Performance improved by an order of magnitude vs full re-render.

### Lighting System

#### Four-Point Lighting Configuration

| Light | Default Position | Default Intensity | Purpose |
|-------|------------------|-------------------|---------|
| Ambient | Global | 0.5π | Base illumination |
| Key | (0, 0, 10) | 0.7π | Main light source |
| Fill | (-10, -5, 5) | 0 | Shadow fill |
| Rim | (0, 5, -10) | 0 | Edge highlight |

#### Camera-Following Lights

Light positions dynamically adjust each frame based on camera direction for consistent lighting.

---

## Performance

### Geometry Optimization

- Atoms use 16×12 segmented spheres (balance quality/performance)
- Same-radius atoms share single geometry
- Hit-test uses simplified geometry

### Rendering Optimization

- **Dirty Flag System**: Render only when scene changes
- **InstancedMesh**: Dramatically reduces draw calls
- **Pre-allocated Temporaries**: Avoid GC pressure

### Event Optimization

- Resize events: 50ms debounce
- State updates: throttled

---

## Testing

### Run Tests

```bash
npm test
```

### Test Coverage

- **Factory Tests**: Renderer creation, dependency injection, error handling
- **Provider Tests**: Default state fallback, custom provider injection

### Test Framework

- Mocha (test runner)
- Chai (assertion library)
- tsx (TypeScript execution)

---

## Build & Publish

### Build

```bash
npm run build        # Production build
npm run watch        # Development mode
npm publish          # Publish (auto-builds)
```

### Output

```
dist/
├── index.js      # ESM bundle
└── index.js.map  # Source map
```

**Target**: ES2020 + Browser platform  
**External**: three (peer dependency)

---

## Important Notes

### Three.js Global Configuration

⚠️ **Warning**: acoord-3d modifies global Three.js state:

```typescript
THREE.ColorManagement.enabled = false;
```

This maintains linear color space behavior compatible with Three.js r128.

**Recommendation**: Initialize acoord-3d **before** any other Three.js code in your application.

### Peer Dependencies

Ensure Three.js is installed:

```bash
npm install three
```

### Browser Compatibility

- Requires WebGL support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES2020+ runtime support

---

## FAQ

**Customize atom colors**
```typescript
const displayStore = getDisplayStore();
displayStore.currentColorByElement = { C: '#333333', H: '#FFFFFF', O: '#FF0000' };
```

**Enable/disable lighting**
```typescript
const lightingStore = getLightingStore();
lightingStore.lightingEnabled = false;
renderer.updateLighting();
```

**Switch projection mode**
```typescript
renderer.setProjectionMode('orthographic');  // or 'perspective'
```

**Export high-resolution screenshot**
```typescript
const result = renderer.exportHighResolutionImage({ scale: 4 });
if (result) {
  const link = document.createElement('a');
  link.href = result.dataUrl;
  link.download = 'structure.png';
  link.click();
}
```

---

## License

MIT License - see [LICENSE](../../LICENSE) file for details.
