import Foundation

public struct TextEdit: Identifiable {
  public let id = UUID()
  public let from: String
  public let to: String
  public let count: Int
}
public enum TextCleaner {
  public static func clean(_ input: String, simplify: Bool, punctuation: Bool) -> (
    String, [TextEdit]
  ) {
    var output = input
    var edits: [TextEdit] = []
    func replace(_ pattern: String, _ replacement: String, _ label: String) {
      guard let regex = try? NSRegularExpression(pattern: pattern) else { return }
      let range = NSRange(output.startIndex..., in: output)
      let count = regex.numberOfMatches(in: output, range: range)
      if count > 0 {
        output = regex.stringByReplacingMatches(in: output, range: range, withTemplate: replacement)
        edits.append(TextEdit(from: label, to: replacement, count: count))
      }
    }
    if simplify {
      // Case-insensitive; a capital at the start of the phrase carries over to what replaces it,
      // or to the next word when the phrase is removed outright.
      for (a, b) in [
        ("in order to", "to"), ("due to the fact that", "because"),
        ("at this point in time", "now"), ("a wide range of", "many"), ("utilize", "use"),
        ("it is worth noting that ", ""), ("it's worth noting that ", ""),
        ("it is important to note that ", ""),
      ] {
        let pattern =
          "\\b" + NSRegularExpression.escapedPattern(for: a) + (a.hasSuffix(" ") ? "(\\p{L})?" : "\\b")
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
        else { continue }
        let matches = regex.matches(in: output, range: NSRange(output.startIndex..., in: output))
        guard !matches.isEmpty else { continue }
        let text = output as NSString
        let result = NSMutableString(string: text)
        for m in matches.reversed() {
          let found = text.substring(with: m.range)
          let upper = found.first.map { $0.isUppercase } ?? false
          var replacement = b
          if !b.isEmpty {
            if upper { replacement = b.prefix(1).uppercased() + b.dropFirst() }
          } else if m.numberOfRanges > 1, m.range(at: 1).location != NSNotFound {
            let next = text.substring(with: m.range(at: 1))
            replacement = upper ? next.uppercased() : next
          }
          result.replaceCharacters(in: m.range, with: replacement)
        }
        output = result as String
        edits.append(TextEdit(from: a, to: b, count: matches.count))
      }
    }
    if punctuation {
      replace("[\\u200B\\uFEFF]", "", "Zero-width spaces / byte-order marks")
      replace("(?m)[ \\t]+$", "", "Trailing whitespace")
    }
    return (output, edits)
  }
}
public struct RepairRegion: Sendable, Equatable {
  public var x: Double
  public var y: Double
  public var width: Double
  public var height: Double
  public init(x: Double, y: Double, width: Double, height: Double) {
    self.x = x
    self.y = y
    self.width = width
    self.height = height
  }
  public func filter(pixelWidth: Int, pixelHeight: Int) throws -> String {
    guard pixelWidth > 5, pixelHeight > 5, [x, y, width, height].allSatisfy({ $0.isFinite }),
      x >= 0, y >= 0, x < 1, y < 1, width > 0, height > 0, width <= 1, height <= 1
    else { throw MediaError.message("Draw a larger repair region.") }
    // Round outward (with a hair of tolerance for float error) so the box always covers the mark.
    let left = max(2, min(pixelWidth - 4, Int((x * Double(pixelWidth) + 1e-6).rounded(.down))))
    let top = max(2, min(pixelHeight - 4, Int((y * Double(pixelHeight) + 1e-6).rounded(.down))))
    let right = min(pixelWidth - 2, Int(((x + width) * Double(pixelWidth) - 1e-6).rounded(.up)))
    let bottom = min(pixelHeight - 2, Int(((y + height) * Double(pixelHeight) - 1e-6).rounded(.up)))
    guard right - left >= 2, bottom - top >= 2 else {
      throw MediaError.message("The selected region is too small or outside the image.")
    }
    return "delogo=x=\(left):y=\(top):w=\(right-left):h=\(bottom-top)"
  }
}
public enum MediaError: LocalizedError {
  case message(String)
  public var errorDescription: String? {
    if case .message(let s) = self { return s }
    return nil
  }
}
public enum MediaEngine {
  public static var ffmpeg: String? {
    let candidates = [
      ProcessInfo.processInfo.environment["CLEARFRAME_FFMPEG"], "/opt/homebrew/bin/ffmpeg",
      "/usr/local/bin/ffmpeg", NSHomeDirectory() + "/bin/ffmpeg",
    ].compactMap { $0 }
    return candidates.first { FileManager.default.isExecutableFile(atPath: $0) }
  }
  public static func arguments(
    input: URL, output: URL, region: RepairRegion?, size: (Int, Int), strip: Bool,
    preview: Bool = false
  ) throws -> [String] {
    var args = ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", input.path]
    args += ["-map", output.pathExtension.lowercased() == "gif" ? "[out]" : "0:v:0"]
    let ext = output.pathExtension.lowercased()
    var filters: [String] = []
    if let region { filters.append(try region.filter(pixelWidth: size.0, pixelHeight: size.1)) }
    if ext == "mp4" { filters.append("pad=ceil(iw/2)*2:ceil(ih/2)*2") }
    if strip {
      args += ["-map_metadata", "-1", "-map_chapters", "-1", "-metadata", "encoder="]
    } else {
      args += ["-map_metadata", "0"]
    }
    if preview || ["png", "jpg", "jpeg"].contains(ext) {
      args += ["-frames:v", "1", "-update", "1"]
    }
    if ext == "gif" {
      let base = filters.isEmpty ? "null" : filters.joined(separator: ",")
      args += [
        "-filter_complex",
        "[0:v]\(base),split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=dither=sierra2_4a[out]",
        "-loop", "0",
      ]
    } else if !filters.isEmpty {
      args += ["-vf", filters.joined(separator: ",")]
    }
    if ext == "mp4" {
      args += [
        "-map", "0:a?", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
      ]
    }
    args += [output.path]
    return args
  }
  public static func run(_ args: [String], process: Process = Process()) throws {
    guard let executable = ffmpeg else {
      throw MediaError.message(
        "FFmpeg was not found. Install it with Homebrew: brew install ffmpeg, then reopen Clearframe."
      )
    }
    let log = FileManager.default.temporaryDirectory.appendingPathComponent(
      UUID().uuidString + ".log")
    FileManager.default.createFile(atPath: log.path, contents: nil)
    let handle = try FileHandle(forWritingTo: log)
    defer {
      try? handle.close()
      try? FileManager.default.removeItem(at: log)
    }
    process.executableURL = URL(fileURLWithPath: executable)
    process.arguments = args
    process.standardError = handle
    process.standardOutput = FileHandle.nullDevice
    try process.run()
    process.waitUntilExit()
    guard process.terminationStatus == 0 else {
      let detail = (try? String(contentsOf: log)) ?? ""
      throw MediaError.message(
        detail.isEmpty ? "Processing cancelled or failed." : String(detail.suffix(2500)))
    }
  }
}
