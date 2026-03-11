# Working with Trajectories

This tutorial shows how to visualize and analyze molecular dynamics trajectories.

## Opening Trajectory Files

### Supported Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| VASP XDATCAR | `XDATCAR`, `.xdatcar` | VASP MD trajectory |
| Multi-frame XYZ | `.xyz` | XYZ with multiple frames |
| VASP OUTCAR | `OUTCAR`, `.outcar` | VASP output with ionic steps |

### Open a Trajectory

1. Open the trajectory file in VS Code
2. ACoord detects multiple frames
3. The **Trajectory** panel appears
4. First frame loads automatically

## Trajectory Panel

The Trajectory panel provides playback controls:

### Frame Slider

- Drag to navigate frames
- Shows current frame number / total frames
- Updates view in real-time

### Playback Controls

| Button | Action |
|--------|--------|
| ⏮️ | Go to first frame |
| ⏪ | Previous frame |
| ▶️ | Play animation |
| ⏸️ | Pause animation |
| ⏩ | Next frame |
| ⏭️ | Go to last frame |

### Frame Rate

- Adjust playback speed
- Typical: 10-30 fps
- Higher = faster playback

## Navigating Frames

### Manual Navigation

1. Use the frame slider
2. Or click **Previous/Next** buttons
3. View updates immediately

### Jump to Frame

1. Enter frame number in the input box
2. Press **Enter**
3. View jumps to that frame

## Animation Playback

### Start Playback

1. Click the **Play** button
2. Frames advance automatically

### Pause Playback

1. Click the **Pause** button (same button toggles)
2. Current frame is held

### Adjust Speed

1. Use the **FPS** (frames per second) slider
2. Range: 1-30 fps
3. Playback speed updates immediately

## Analyzing Trajectories

### Track Atom Movement

1. Select an atom in the first frame
2. Play the trajectory
3. Watch the atom move through frames
4. Selection persists across frames

### Measure Bond Evolution

1. Select two atoms
2. Play the trajectory
3. Distance updates each frame
4. Observe bond length changes

## Exporting Frames

### Export Current Frame as New Structure File

1. Navigate to desired frame
2. Click **Save As** button
3. Choose format (POSCAR, XYZ, etc.)
4. Save the single frame

### Export HD Image

1. Navigate to desired frame
2. Click the **Export Image** button
3. High-resolution PNG is generated

## Tips and Best Practices

### Performance

- Large trajectories may load slowly
- Consider exporting subset of frames for analysis
- Close and reopen to clear memory

### Memory Management

- Trajectories are loaded fully into memory
- Very large files (>10000 frames) may cause slowdowns
- Export important frames to separate files

### Analysis Workflow

1. Open trajectory
2. Play through once to identify interesting regions
3. Navigate to key frames
4. Export frames for detailed analysis
5. Use measurement tools for quantitative data

### Combine with Other Features

- **Color schemes:** Highlight different element types
- **Labels:** Mark specific atoms
- **Bonds:** Show bonding changes during MD
- **Unit cell:** Display lattice during simulation

## Common Use Cases

### Phase Transition

1. Open XDATCAR from heating simulation
2. Play trajectory
3. Observe structural changes
4. Export frames before/after transition

### Diffusion Study

1. Load trajectory with mobile ions
2. Select an atom to track
3. Play through the trajectory
4. Observe the atom's movement path

### Vibrational Analysis

1. Open short trajectory (few ps)
2. Set high frame rate
3. Observe atomic vibrations
4. Measure bond oscillations

## Troubleshooting

### Frames Not Loading

- Check file format is supported
- Ensure file is not corrupted
- Try exporting frames from original simulation code

### Playback is Choppy

- Reduce frame rate
- Close other applications
- Consider exporting subset of frames

### Missing Atoms in Some Frames

- Check if atoms are removed in simulation
- Some formats may have inconsistent atom counts
- Contact simulation code support

## Next Steps

- [Viewing Structures](/tutorials/viewing-structures) — Basic navigation
- [File Formats](/guide/file-formats) — Format details
- [Features Overview](/features/) — All available features
