import Foundation
import AppKit
import ImageIO
import UniformTypeIdentifiers

enum ArtError: LocalizedError {
    case message(String), cancelled
    var errorDescription: String? {
        switch self { case .message(let text): return text; case .cancelled: return "Cancelled" }
    }
}

final class CancellationFlag: @unchecked Sendable {
    private let lock = NSLock()
    private var value = false
    func cancel() { lock.lock(); value = true; lock.unlock() }
    func check() throws { lock.lock(); let stopped = value; lock.unlock(); if stopped { throw ArtError.cancelled } }
}

struct ExportSettings: Sendable, Equatable {
    var longEdge = 256
    var pngScale = 4
    var whiteMatte = false
    var paintColors = 24
    var brushStrength = 2
    var cellPainting = true
}

struct CellArtwork: Sendable {
    let width: Int
    let height: Int
    let pixels: [UInt32]
    var layers: [CellLayer] = []

    static func readImage(_ url: URL, settings: ExportSettings, cancel: CancellationFlag = CancellationFlag()) throws -> CellArtwork {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else {
            throw ArtError.message("Could not read this image. Try PNG, JPEG, TIFF, or HEIC.")
        }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: max(32, min(1024, settings.longEdge)),
            kCGImageSourceShouldCacheImmediately: true
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            throw ArtError.message("This image could not be decoded. Animated images use their first frame.")
        }
        let w = image.width, h = image.height
        var bytes = [UInt8](repeating: 0, count: w * h * 4)
        let success = bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context = CGContext(data: buffer.baseAddress, width: w, height: h, bitsPerComponent: 8,
                bytesPerRow: w * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { return false }
            let matte: CGFloat = settings.whiteMatte ? 1 : 0
            context.setFillColor(red: matte, green: matte, blue: matte, alpha: 1)
            context.fill(CGRect(x: 0, y: 0, width: w, height: h))
            context.interpolationQuality = .high
            context.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
            return true
        }
        guard success else { throw ArtError.message("There is not enough memory to prepare this artwork.") }
        // Excel allows fewer than 65,490 unique cell styles. 5 bits per RGB
        // channel gives rich color while keeping every possible palette safe.
        func channel(_ byte: UInt8) -> UInt32 { let q = (Int(byte) * 31 + 127) / 255; return UInt32((q * 255 + 15) / 31) }
        var pixels = [UInt32](); pixels.reserveCapacity(w * h)
        for i in stride(from: 0, to: bytes.count, by: 4) {
            pixels.append(channel(bytes[i]) << 16 | channel(bytes[i+1]) << 8 | channel(bytes[i+2]))
        }
        let reference = CellArtwork(width: w, height: h, pixels: pixels)
        return settings.cellPainting ? try CellPainter.paint(reference, settings: settings, cancel: cancel) : reference
    }

    static func readGrid(_ url: URL) throws -> CellArtwork {
        struct Grid: Decodable { var width: Int; var height: Int; var pixels: [String] }
        let grid = try JSONDecoder().decode(Grid.self, from: Data(contentsOf: url))
        guard grid.width > 0, grid.height > 0, grid.width <= 16384, grid.height <= 16384,
              grid.width * grid.height <= 1_100_000, grid.pixels.count == grid.width * grid.height else {
            throw ArtError.message("The grid must contain one RGB color per cell, up to 1.1 million cells.")
        }
        let pixels = try grid.pixels.map { color -> UInt32 in
            let hex = color.hasPrefix("#") ? String(color.dropFirst()) : color
            guard hex.count == 6, let number = UInt32(hex, radix: 16) else { throw ArtError.message("Invalid grid color: \(color)") }
            return number
        }
        guard Set(pixels).count <= 60000 else { throw ArtError.message("Reduce the grid to 60,000 colors or fewer for Excel.") }
        return CellArtwork(width: grid.width, height: grid.height, pixels: pixels)
    }
}

enum ArtEngine {
    static func previewImage(_ art: CellArtwork) -> CGImage? {
        var bytes=[UInt8]();bytes.reserveCapacity(art.pixels.count*4)
        for c in art.pixels {bytes += [UInt8((c>>16)&255),UInt8((c>>8)&255),UInt8(c&255),255]}
        guard let data=CGDataProvider(data:Data(bytes) as CFData) else {return nil}
        return CGImage(width:art.width,height:art.height,bitsPerComponent:8,bitsPerPixel:32,bytesPerRow:art.width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGBitmapInfo(rawValue:CGImageAlphaInfo.last.rawValue),provider:data,decode:nil,shouldInterpolate:false,intent:.defaultIntent)
    }
    static func xml(_ text: String) -> String {
        text.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;").replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&apos;")
    }
    static func hex(_ number: UInt32) -> String { String(format: "%06X", number) }
    static func column(_ index: Int) -> String {
        var n = index + 1, name = ""
        while n > 0 { n -= 1; name = String(UnicodeScalar(65 + n % 26)!) + name; n /= 26 }
        return name
    }
    static func stem(_ text: String) -> String {
        let clean = text.components(separatedBy: CharacterSet.controlCharacters.union(CharacterSet(charactersIn: "/:\\"))).joined(separator: "-")
        let trimmed = clean.trimmingCharacters(in: .whitespacesAndNewlines)
        return String((trimmed.isEmpty ? "Untitled artwork" : trimmed).prefix(100))
    }
    static func write(_ text: String, to url: URL) throws { try text.write(to: url, atomically: true, encoding: .utf8) }

    static func svg(_ art: CellArtwork, title: String, to url: URL, cancel: CancellationFlag) throws {
        var paths: [UInt32: String] = [:]
        for y in 0..<art.height {
            if y % 32 == 0 { try cancel.check() }
            var x = 0
            while x < art.width {
                let color = art.pixels[y * art.width + x]
                var end = x + 1
                while end < art.width && art.pixels[y * art.width + end] == color { end += 1 }
                paths[color, default: ""] += "M\(x) \(y)h\(end-x)v1h-\(end-x)z"
                x = end
            }
        }
        var result = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"\(art.width*4)\" height=\"\(art.height*4)\" viewBox=\"0 0 \(art.width) \(art.height)\" shape-rendering=\"crispEdges\">\n<title>\(xml(title))</title>\n<desc>Art sheets. \(art.width) by \(art.height) editable cell colors, represented by vector paths. No embedded raster image.</desc>\n"
        for color in paths.keys.sorted() { result += "<path fill=\"#\(hex(color))\" d=\"\(paths[color]!)\"/>\n" }
        result += "</svg>\n"
        try write(result, to: url)
    }

    static func png(_ art: CellArtwork, scale: Int, to url: URL, cancel: CancellationFlag) throws {
        try cancel.check()
        let factor = max(1, min(4, scale)), w = art.width * factor, h = art.height * factor
        var bytes = [UInt8](repeating: 255, count: w * h * 4)
        for y in 0..<h {
            if y % 64 == 0 { try cancel.check() }
            for x in 0..<w {
                let color = art.pixels[(y/factor)*art.width + x/factor], i = (y*w+x)*4
                bytes[i] = UInt8((color >> 16) & 255); bytes[i+1] = UInt8((color >> 8) & 255); bytes[i+2] = UInt8(color & 255)
            }
        }
        guard let provider = CGDataProvider(data: Data(bytes) as CFData),
              let image = CGImage(width: w, height: h, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: w*4,
                space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue),
                provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent),
              let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
            throw ArtError.message("The PNG could not be created.")
        }
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else { throw ArtError.message("The PNG could not be saved.") }
    }

    static func xlsx(_ art: CellArtwork, title: String, to url: URL, cancel: CancellationFlag, progress: (Double) -> Void) throws {
        let fm = FileManager.default
        let temp = fm.temporaryDirectory.appendingPathComponent("ArtSheets-XLSX-\(UUID().uuidString)", isDirectory: true)
        try fm.createDirectory(at: temp, withIntermediateDirectories: true)
        defer { try? fm.removeItem(at: temp) }
        for path in ["_rels", "xl/_rels", "xl/worksheets", "docProps"] { try fm.createDirectory(at: temp.appendingPathComponent(path), withIntermediateDirectories: true) }
        var palette: [UInt32] = [], indices: [UInt32: Int] = [:]
        for colors in [art.pixels] + art.layers.map(\.pixels) {
            for color in colors where indices[color] == nil { indices[color] = palette.count + 1; palette.append(color) }
        }
        guard palette.count <= 60000 else { throw ArtError.message("This artwork has too many unique colors for Excel.") }
        let range = "A1:\(column(art.width-1))\(art.height)"
        try write("""
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>
        """, to: temp.appendingPathComponent("[Content_Types].xml"))
        try write("""
        <?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>
        """, to: temp.appendingPathComponent("_rels/.rels"))
        try write("""
        <?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="Artwork" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'Artwork'!$A$1:$\(column(art.width-1))$\(art.height)</definedName></definedNames></workbook>
        """, to: temp.appendingPathComponent("xl/workbook.xml"))
        try write("""
        <?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>
        """, to: temp.appendingPathComponent("xl/_rels/workbook.xml.rels"))
        try write("""
        <?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>\(xml(title))</dc:title><dc:creator>Art sheets</dc:creator><dc:description>Artwork painted with editable Excel cell fills.</dc:description></cp:coreProperties>
        """, to: temp.appendingPathComponent("docProps/core.xml"))
        try write("""
        <?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Art sheets</Application></Properties>
        """, to: temp.appendingPathComponent("docProps/app.xml"))
        var styles = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><numFmts count=\"1\"><numFmt numFmtId=\"164\" formatCode=\";;;\"/></numFmts><fonts count=\"1\"><font><sz val=\"11\"/><name val=\"Calibri\"/></font></fonts><fills count=\"\(palette.count+2)\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill>"
        for color in palette { styles += "<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF\(hex(color))\"/><bgColor indexed=\"64\"/></patternFill></fill>" }
        styles += "</fills><borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs><cellXfs count=\"\(palette.count+1)\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>"
        for i in palette.indices { styles += "<xf numFmtId=\"164\" applyNumberFormat=\"1\" fontId=\"0\" fillId=\"\(i+2)\" borderId=\"0\" xfId=\"0\" applyFill=\"1\"/>" }
        styles += "</cellXfs><cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles></styleSheet>"
        try write(styles, to: temp.appendingPathComponent("xl/styles.xml"))
        let sheetURL = temp.appendingPathComponent("xl/worksheets/sheet1.xml")
        fm.createFile(atPath: sheetURL.path, contents: nil)
        let handle = try FileHandle(forWritingTo: sheetURL); defer { try? handle.close() }
        let zoom = max(10, min(100, Int(min(1100.0/Double(art.width*4), 740.0/Double(art.height*4))*100)))
        try handle.write(contentsOf: Data("<?xml version=\"1.0\" encoding=\"UTF-8\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetPr><tabColor rgb=\"FF87EAC5\"/><pageSetUpPr fitToPage=\"1\"/></sheetPr><dimension ref=\"\(range)\"/><sheetViews><sheetView showGridLines=\"0\" showRowColHeaders=\"0\" zoomScale=\"\(zoom)\" workbookViewId=\"0\"><selection activeCell=\"A1\" sqref=\"A1\"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight=\"3\"/><cols><col min=\"1\" max=\"\(art.width)\" width=\"0.333333333\" customWidth=\"1\"/></cols><sheetData>".utf8))
        // Hidden numeric values keep spreadsheet importers from trimming color-only cells.
        let columns = (0..<art.width).map(column)
        for y in 0..<art.height {
            if y % 16 == 0 { try cancel.check(); progress(Double(y)/Double(art.height)) }
            var row = "<row r=\"\(y+1)\" ht=\"3\" customHeight=\"1\">"
            for x in 0..<art.width { row += "<c r=\"\(columns[x])\(y+1)\" s=\"\(indices[art.pixels[y*art.width+x]]!)\"><v>0</v></c>" }
            row += "</row>"; try handle.write(contentsOf: Data(row.utf8))
        }
        try handle.write(contentsOf: Data("</sheetData><printOptions horizontalCentered=\"1\" verticalCentered=\"1\"/><pageMargins left=\"0.25\" right=\"0.25\" top=\"0.25\" bottom=\"0.25\" header=\"0\" footer=\"0\"/><pageSetup paperSize=\"9\" orientation=\"\(art.width >= art.height ? "landscape" : "portrait")\" fitToWidth=\"1\" fitToHeight=\"1\"/></worksheet>".utf8))
        try handle.synchronize(); try cancel.check()
        if !art.layers.isEmpty {
            let original = try String(contentsOf: sheetURL, encoding: .utf8)
            let prefix = String(original[..<original.range(of: "<sheetData>")!.upperBound])
            let suffix = String(original[original.range(of: "</sheetData>")!.lowerBound...])
            var workbook = try String(contentsOf: temp.appendingPathComponent("xl/workbook.xml"), encoding: .utf8)
            workbook = workbook.replacingOccurrences(of: "Artwork", with: "Painting")
            var relationships = try String(contentsOf: temp.appendingPathComponent("xl/_rels/workbook.xml.rels"), encoding: .utf8)
            var types = try String(contentsOf: temp.appendingPathComponent("[Content_Types].xml"), encoding: .utf8)
            for (layerIndex,layer) in art.layers.enumerated() {
                try cancel.check()
                let number = layerIndex+2, relationship = layerIndex+3
                var data = prefix
                for y in 0..<art.height {
                    if y % 32 == 0 { try cancel.check() }
                    data += "<row r=\"\(y+1)\" ht=\"3\" customHeight=\"1\">"
                    for x in 0..<art.width { data += "<c r=\"\(columns[x])\(y+1)\" s=\"\(indices[layer.pixels[y*art.width+x]]!)\"><v>0</v></c>" }
                    data += "</row>"
                }
                data += suffix
                try write(data,to:temp.appendingPathComponent("xl/worksheets/sheet\(number).xml"))
                workbook = workbook.replacingOccurrences(of:"</sheets>",with:"<sheet name=\"\(xml(layer.name))\" sheetId=\"\(number)\" r:id=\"rId\(relationship)\"/></sheets>")
                relationships = relationships.replacingOccurrences(of:"</Relationships>",with:"<Relationship Id=\"rId\(relationship)\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet\(number).xml\"/></Relationships>")
                types = types.replacingOccurrences(of:"</Types>",with:"<Override PartName=\"/xl/worksheets/sheet\(number).xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>")
            }
            try write(workbook,to:temp.appendingPathComponent("xl/workbook.xml"))
            try write(relationships,to:temp.appendingPathComponent("xl/_rels/workbook.xml.rels"))
            try write(types,to:temp.appendingPathComponent("[Content_Types].xml"))
        }
        let process = Process(); process.executableURL = URL(fileURLWithPath: "/usr/bin/zip")
        process.arguments = ["-q", "-r", url.path, "."]; process.currentDirectoryURL = temp
        let errors = Pipe(); process.standardError = errors
        try process.run()
        while process.isRunning {
            do { try cancel.check() } catch { process.terminate(); process.waitUntilExit(); throw error }
            Thread.sleep(forTimeInterval: 0.03)
        }
        process.waitUntilExit()
        guard process.terminationStatus == 0 else { throw ArtError.message("Could not package the Excel file. Check the output folder and available disk space.") }
        progress(1)
    }

    static func export(_ art: CellArtwork, title: String, destination: URL, settings: ExportSettings,
                       formats: Set<String> = ["xlsx", "svg", "png"], cancel: CancellationFlag,
                       progress: (Double, String) -> Void = { _,_ in }) throws -> URL {
        let fm = FileManager.default
        try fm.createDirectory(at: destination, withIntermediateDirectories: true)
        let base = stem(title)
        let work = destination.appendingPathComponent(".ArtSheets-\(UUID().uuidString)", isDirectory: true)
        try fm.createDirectory(at: work, withIntermediateDirectories: false)
        defer { try? fm.removeItem(at: work) }
        if formats.contains("xlsx") {
            progress(0.05, "Painting Excel cells")
            try xlsx(art, title: title, to: work.appendingPathComponent(base+".xlsx"), cancel: cancel) { progress(0.05+$0*0.55,"Painting Excel cells") }
        }
        if formats.contains("svg") { progress(0.65,"Drawing vector paths"); try svg(art,title: title,to: work.appendingPathComponent(base+".svg"),cancel: cancel) }
        if formats.contains("png") { progress(0.85,"Rendering PNG"); try png(art,scale: settings.pngScale,to: work.appendingPathComponent(base+".png"),cancel: cancel) }
        try cancel.check()
        var output = destination.appendingPathComponent(base+" - Art sheets", isDirectory: true), suffix = 2
        while fm.fileExists(atPath: output.path) { output = destination.appendingPathComponent(base+" - Art sheets (\(suffix))",isDirectory: true); suffix += 1 }
        try fm.moveItem(at: work, to: output)
        progress(1,"Finished")
        return output
    }
}
