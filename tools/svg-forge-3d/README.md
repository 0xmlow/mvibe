# SVG Forge 3D

SVG Forge 3D is a private, offline macOS editor for turning SVG artwork into real extruded 3D meshes and binary GLB models.

## What it includes

- Nine built-in starter shapes
- SVG file import, drag-and-drop, and pasted SVG code
- True Three.js `ExtrudeGeometry` with curve, hole, transform, fill, and stroke support
- Bevel, curve detail, PBR material, metalness, roughness, transparency, and lighting controls
- Direct 3D orbit and zoom controls
- GLB export with meshes, normals, colors, and PBR materials
- Binary STL export for 3D printing and high-resolution PNG previews
- Undo/redo, style recipes, randomize, autosave, and canvas controls
- Native macOS open/save dialogs

The app processes artwork locally and never uploads files. Its extrusion and export architecture is adapted from the MIT-licensed [renatoworks/3dsvg](https://github.com/renatoworks/3dsvg) project; see `THIRD_PARTY_NOTICES.md`.

## Build locally

Run:

```sh
./build-macos.sh
```

The app bundle is created at `dist/SVG Forge 3D.app`.
