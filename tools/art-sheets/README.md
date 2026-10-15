# Art sheets 2.1

A native SwiftUI macOS app that repaints references using broad color regions, directional cell brushwork, and selective contours, then exports editable Excel paintings and matching SVG and PNG files. Runs locally without network services or a bundled scripting runtime.

## Use

Open **Art sheets.app**, add images or a folder, choose cell detail and an export folder, and click **Export artwork**. Drag and drop is also supported. Each image gets a new folder containing three files. Existing exports are preserved. A failed image does not stop the rest of a batch; cancellation preserves completed exports and removes the current unfinished bundle.

The default is a 24-pigment cell painting. Compare the live painting preview with the reference, adjust pigment count and brushwork, and export. The workbook contains Painting, Underpainting, and Brushwork sheets. Stage sheets are independently editable studies; edits to them do not recomposite the finished sheet. The Open workbook button opens the actual .xlsx in the default spreadsheet application.

The SVG uses true vector cell geometry. It preserves the cell artwork at any scale, rather than tracing smooth shapes from the original. PNG size is selectable at 1, 2, or 4 pixels per cell. The default painting uses 24 pigments. Legacy pixel sampling is only available through the explicit CLI --mosaic option. Transparent areas are composited onto black or white. Animated images use the first frame.

## Build

Requires Apple's command-line developer tools. Run `zsh build.sh`. The build produces an Apple silicon app for macOS 13 or later, signed locally with an ad-hoc signature. No paid signing identity or external dependencies are required. This is a local build, not an App Store or notarized distribution.

`Sources/CellPainter.swift` builds paint stages. `Sources/ArtEngine.swift` handles decoding, pixel grids, XLSX, SVG, PNG, atomic output folders, and cancellation. `Sources/ArtSheetsApp.swift` provides the native interface. `Sources/main.swift` also exposes the engine to automation:

```sh
"dist/Art sheets.app/Contents/MacOS/ArtSheets" --convert "/path/image.png" --output "/path/exports" --detail 384 --colors 24 --brush 2 --png-scale 4
```

For new, original cell paintings, use `--grid` with a JSON object containing `width`, `height`, and row-major six-digit RGB `pixels`. `--formats svg,png` can limit output formats.

## Verification

The integration test compares every Excel cell, SVG cell, and PNG pixel against a known grid. It also checks orientation, portrait proportions, transparency, filename collisions, XML escaping, corrupt-image batch recovery, and source-file preservation. `Tests/EngineTests.swift` verifies cancellation cleanup.

Run the Python tests with a Python environment containing Pillow. Run the Swift test by compiling `Sources/ArtEngine.swift` together with `Tests/EngineTests.swift`.

The app was exercised through its native import and export controls. Native Microsoft Excel was unavailable on the build machine; workbook checks cover its OOXML package and cell formatting rather than a native Excel screenshot.

## Version 2.1

Preview Underpainting, Brushwork, and Painting directly in the app. Each preview uses the same cell grid as its workbook sheet. Changing export settings includes previously exported artwork in the next export while preserving earlier files. Clearing the collection cancels and invalidates pending previews.

Verified in this build: export integration suite, cell painting suite, cancellation cleanup, and model regressions all pass. The native window was visually inspected, but automated interaction with the macOS file picker was unreliable, so a full native import/export walkthrough was not completed in this session. Native Excel rendering remains unverified.

## Version 2.1.1 — complete workbook imports

Fixed Numbers importing color-only artwork as a 5-column by 10-row fragment. Each painted cell now contains a zero hidden by the `;;;` number format, retaining editable fills and the complete used range. All three painting stages use this representation. The local cell-art exporter accepts only these hidden-zero markers, and continues to reject visible values and formulas.

Verified the new app's 256 × 144 export in native Numbers: all three sheets import and the entire painting is visible at 25% zoom. Numbers enlarges tiny cells and ignores Excel's saved zoom; select 25% from its Zoom menu. Larger artwork may require scrolling or a wider window. The app's 160–512 detail choices are below Numbers' observed 1,000-column import limit; CLI grids wider than 1,000 columns should be opened in Excel. Native Excel is not installed here.

Re-export artwork with 2.1.1 to correct earlier files. Earlier exports are preserved.
