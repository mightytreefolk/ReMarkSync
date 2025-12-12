# ReMarkable Sync for Obsidian

Sync your ReMarkable tablet handwritten notes and PDF annotations to Obsidian as editable Excalidraw drawings.

> **Platform Support:** Currently tested on **macOS** only. Linux and Windows support has not been confirmed yet. Contributions welcome!

## Privacy & Data Access

This plugin:
- **Reads files outside your vault** from the ReMarkable desktop app's local data folder (see paths below)
- **Does not make any network requests**
- **Does not collect any data**
- **Does not require an account** (though the ReMarkable desktop app requires one)
- All processing happens locally on your machine

## Features

- **Automatic sync** from ReMarkable desktop app to your vault
- **Folder structure preservation** - mirrors your ReMarkable folders
- **PDF annotation support** - imports markup from annotated PDFs
- **v6 format support** - works with current ReMarkable firmware (3.0+)
- **Incremental sync** - only imports new or changed documents
- **Manual import** - import individual .rm files directly

## Requirements

### 1. ReMarkable Desktop App (Required)

This plugin reads from the ReMarkable desktop app's local data folder. **You must have the desktop app installed and synced** for the sync feature to work.

**Installation:**
1. Download from [remarkable.com/download](https://remarkable.com/download)
2. Install and sign in with your ReMarkable account
3. Wait for your documents to fully sync to your computer

**Data folder locations:**
| Platform | Path |
|----------|------|
| macOS | `~/Library/Containers/com.remarkable.desktop/Data/Library/Application Support/remarkable/desktop` |
| Windows | Not yet confirmed - please open an issue if you find it! |
| Linux | Not yet confirmed - please open an issue if you find it! |

The plugin will attempt to auto-detect the folder on macOS. For other platforms, you may need to manually set the path in settings.

### 2. Excalidraw Plugin (Required)

This plugin converts ReMarkable drawings to Excalidraw format. You need the Excalidraw plugin installed to view the imported files.

**Installation:**
1. Open Obsidian Settings
2. Go to **Community plugins** → **Browse**
3. Search for **"Excalidraw"**
4. Click **Install**, then **Enable**

## Installation

### From Release

1. Download the latest release (`main.js`, `manifest.json`)
2. Create folder: `.obsidian/plugins/remarkable-sync/`
3. Copy files into the folder
4. Reload Obsidian
5. Enable "ReMarkable Sync" in Community plugins

### From Source

```bash
git clone https://github.com/peterthompson/ReMarkSync
cd ReMarkSync
npm install
npm run build
```

Then copy `main.js` and `manifest.json` to your vault's `.obsidian/plugins/remarkable-sync/` folder.

## Usage

### Quick Start

1. Install the plugin and Excalidraw
2. Open plugin settings
3. Click **"Detect"** to find your ReMarkable data folder
4. Click **"Sync Now"**

Your ReMarkable notebooks will appear in the `ReMarkSync/` folder.

### Manual Import

Click the **file-input icon** in the left ribbon (or use command palette: "Import ReMarkable .rm file") to import individual .rm files.

### Auto Sync

Enable **"Auto-sync"** in settings to automatically check for changes at regular intervals.

## Settings

| Setting | Description |
|---------|-------------|
| **ReMarkable data folder** | Path to desktop app data (auto-detected on macOS) |
| **Sync folder** | Destination folder in your vault (default: `ReMarkSync`) |
| **Auto-sync** | Enable periodic sync (default: off) |
| **Sync interval** | Time between syncs (supports minutes or hours) |
| **Sync notebooks** | Import handwritten notebooks (default: on) |
| **Sync PDF annotations** | Import annotations from PDFs (default: on) |
| **Preserve layers** | Keep layer grouping in Excalidraw (default: on) |
| **Stroke width scale** | Adjust stroke thickness (default: 0.5, range: 0.25-2.0) |

## File Structure

After sync, your vault will contain:

```
ReMarkSync/
├── Notebook Name/
│   ├── Page 01.excalidraw
│   ├── Page 02.excalidraw
│   ├── Page 03.excalidraw
│   └── .sync-meta.json
├── Folder Name/
│   └── Another Notebook/
│       ├── Page 01.excalidraw
│       └── .sync-meta.json
└── PDF Document - Annotations/
    ├── Page 01.excalidraw
    ├── Page 02.excalidraw
    └── .sync-meta.json
```

- Each notebook becomes a folder containing its pages
- `.excalidraw` files can be opened with the Excalidraw plugin
- `.sync-meta.json` files track sync state (hidden by default with `.` prefix)

## PDF Annotations

When you annotate a PDF on your ReMarkable, this plugin imports the annotations as separate Excalidraw files. The annotations preserve:

- Pen strokes and drawings
- Highlighting (as semi-transparent strokes)
- Different pen types and colors

Note: Currently, only the annotations are imported (not the PDF background). You can view the original PDF alongside the annotations in Obsidian.

## Supported Formats

| Format | Support |
|--------|---------|
| v6 (.rm) | ✅ Full support (firmware 3.0+) |
| v5 (.rm) | ✅ Full support (older firmware) |
| v3 (.rm) | ✅ Basic support |

## Pen Type Mapping

ReMarkable pens are mapped to Excalidraw with appropriate characteristics:

| ReMarkable Pen | Excalidraw Style |
|----------------|------------------|
| Ballpoint | Solid, pressure-sensitive |
| Fineliner | Solid, uniform width |
| Marker | Thick, solid |
| Highlighter | Semi-transparent (40% opacity) |
| Pencil | Rough texture |
| Paintbrush | Variable width |
| Calligraphy | Variable width |

## Troubleshooting

### "ReMarkable data folder not found"

1. Ensure the ReMarkable desktop app is installed
2. Sign in and wait for sync to complete
3. Try clicking "Detect" in settings
4. Manually enter the path if auto-detect fails

### Empty drawings

- The document may have no strokes on the imported page
- Try "Full Resync" to reimport all documents

### Excalidraw not opening files

- Ensure the Excalidraw plugin is installed and enabled
- Files must have `.excalidraw` extension (not `.excalidraw.md`)

## Roadmap

Future features under consideration:

- **PDF background rendering** - Display the original PDF page behind annotations
- **Linux/Windows support** - Test and confirm data folder paths
- **Two-way sync** - Edit in Obsidian and sync back to ReMarkable
- **Template support** - Preserve ReMarkable templates as backgrounds

## Contributing

Contributions welcome! Please open issues or PRs on GitHub.

## License

MIT

## Acknowledgments

- [rmscene](https://github.com/ricklupton/rmscene) - v6 format documentation
- [remarkable_file_format](https://github.com/YakBarber/remarkable_file_format) - Format specification
- [Excalidraw](https://github.com/zsviczian/obsidian-excalidraw-plugin) - Drawing viewer
