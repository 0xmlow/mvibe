import Foundation
import AppKit

let args = Array(CommandLine.arguments.dropFirst())
if args.contains("--convert") || args.contains("--grid") || args.contains("--help") {
    func value(_ key: String) -> String? { guard let i = args.firstIndex(of: key), i+1 < args.count else { return nil }; return args[i+1] }
    if args.contains("--help") {
        print("Art sheets 2: --convert INPUT [INPUT ...] --output FOLDER [--detail 160|256|384|512] [--colors 8...48] [--brush 1|2|3] [--png-scale 1|2|4] [--white-matte] [--formats xlsx,svg,png]\nDefaults to layered cell painting. --mosaic explicitly selects the legacy sampled-pixel converter.\nExact authored cell art: --grid RGB_GRID.json --output FOLDER [--title TITLE]")
        exit(0)
    }
    do {
        guard let target = value("--output") else { throw ArtError.message("Provide --output FOLDER.") }
        var settings = ExportSettings()
        if let detail = value("--detail") { guard let n = Int(detail), (32...1024).contains(n) else { throw ArtError.message("Detail must be between 32 and 1024 cells.") }; settings.longEdge = n }
        if let scale = value("--png-scale") { guard let n = Int(scale), [1,2,4].contains(n) else { throw ArtError.message("PNG scale must be 1, 2, or 4.") }; settings.pngScale = n }
        settings.whiteMatte = args.contains("--white-matte")
        settings.cellPainting = !args.contains("--mosaic")
        if let colors = value("--colors") { guard let n=Int(colors), (8...48).contains(n) else { throw ArtError.message("Choose 8–48 paint colors.") }; settings.paintColors=n }
        if let brush = value("--brush") { guard let n=Int(brush), (1...3).contains(n) else { throw ArtError.message("Choose brush strength 1, 2, or 3.") };settings.brushStrength=n }
        let formats = Set((value("--formats") ?? "xlsx,svg,png").split(separator: ",").map(String.init))
        guard !formats.isEmpty, formats.isSubset(of: ["xlsx","svg","png"]) else { throw ArtError.message("Formats must be xlsx,svg,png or a subset.") }
        let destination = URL(fileURLWithPath: target, isDirectory: true)
        if let grid = value("--grid") {
            let art = try CellArtwork.readGrid(URL(fileURLWithPath: grid))
            let output = try ArtEngine.export(art,title:value("--title") ?? "Cell artwork",destination:destination,settings:settings,formats:formats,cancel:CancellationFlag())
            print(output.path)
        } else {
            guard let start = args.firstIndex(of: "--convert") else { throw ArtError.message("Provide input images after --convert.") }
            let inputs = args.dropFirst(start+1).prefix { !$0.hasPrefix("--") }
            guard !inputs.isEmpty else { throw ArtError.message("Provide at least one image after --convert.") }
            var failures = 0
            for input in inputs {
                do {
                    let output = try autoreleasepool {
                        let url = URL(fileURLWithPath: input), art = try CellArtwork.readImage(url,settings:settings)
                        return try ArtEngine.export(art,title:url.deletingPathExtension().lastPathComponent,destination:destination,settings:settings,formats:formats,cancel:CancellationFlag())
                    }
                    print(output.path)
                } catch { failures += 1; FileHandle.standardError.write(Data("\(input): \(error.localizedDescription)\n".utf8)) }
            }
            if failures > 0 { exit(1) }
        }
    } catch { FileHandle.standardError.write(Data("Art sheets: \(error.localizedDescription)\n".utf8)); exit(1) }
} else {
    ArtSheetsApp.main()
}
