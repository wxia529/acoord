# acoord-3d

Atomic structure 3D rendering engine powered by Three.js.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
npm install acoord-3d three
```

## Quick Start

```typescript
import { createRenderer } from 'acoord-3d';

const renderer = createRenderer({
  canvas: document.getElementById('canvas'),
  providers: {
    structure: structureStore,
    display: displayStore,
    lighting: lightingStore,
  },
});

renderer.renderStructure({
  atoms: [
    { id: '1', element: 'C', position: [0, 0, 0], color: '#333333', radius: 0.77 },
    { id: '2', element: 'H', position: [1, 0, 0], color: '#FFFFFF', radius: 0.37 },
  ],
  bonds: [],
});
```

## API Reference

### `createRenderer(options)`

Creates a new renderer instance.

**Options:**
- `canvas: HTMLCanvasElement` - The canvas element to render to
- `providers?: StoreProvider` - Optional custom state provider
- `onError?: (message: string) => void` - Error callback
- `onStatus?: (message: string) => void` - Status message callback
- `onCameraChange?: (quaternion: Quaternion) => void` - Camera change callback

**Returns:** `RendererApi` instance

### `RendererApi`

Core rendering interface with methods:
- `renderStructure(data, hooks?, options?)` - Render a structure
- `fitCamera()` - Fit camera to scene
- `dispose()` - Cleanup resources
- And more...

## Advanced Usage

### Custom State Management

```typescript
import { createRenderer, setStoreProvider } from 'acoord-3d';

const myState = {
  structure: { currentStructure: null },
  display: { backgroundColor: '#0d1015', ... },
  lighting: { lightingEnabled: true, ... },
};

setStoreProvider(myState);

const renderer = createRenderer({ canvas });
```

### Camera Callbacks

```typescript
const renderer = createRenderer({
  canvas,
  onCameraChange: (quaternion) => {
    // Update UI elements based on camera orientation
    updateAxisIndicator(quaternion);
  },
});
```

## Important Notes

### Three.js Global Configuration

⚠️ **Warning:** `acoord-3d` modifies global Three.js state:
- `THREE.ColorManagement.enabled = false` (for legacy color behavior)

Initialize `acoord-3d` **before** any other Three.js code in your application.

### Peer Dependencies

`acoord-3d` expects `three` as a peer dependency. Make sure to install it:

```bash
npm install three
```

## License

MIT License - see [LICENSE](LICENSE) for details.
