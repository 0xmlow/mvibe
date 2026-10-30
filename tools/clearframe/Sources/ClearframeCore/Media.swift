import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

/// What Clearframe knows about one imported file before any finishing happens.
public struct MediaInfo: Sendable {
  /// The file FFmpeg reads. Usually the original; a PNG/APNG proxy for stills FFmpeg cannot decode.
  public var decodeURL: URL
  public var width: Int
  public var height: Int
  /// Seconds. 0 for a single still image.
  public var duration: Double
  public var animated: Bool
  public var hasAudio: Bool
  /// HLG or PQ video (iPhone HDR, for example); tone mapped to SDR on export.
  public var hdr: Bool
  public var isStill: Bool { !animated && duration == 0 }
}

public enum Media {
  public static let stillExtensions: Set<String> = [
    "png", "jpg", "jpeg", "jpe", "jfif", "heic", "heif", "hif", "avif", "webp", "tif", "tiff",
    "bmp", "dng", "cr2", "cr3", "nef", "nrw", "arw", "srf", "sr2", "raf", "orf", "rw2", "pef",
    "srw", "x3f", "3fr", "iiq", "erf", "raw", "psd", "tga", "jp2", "ico",
  ]
  public static let videoExtensions: Set<String> = [
    "mp4", "m4v", "mov", "qt", "mkv", "webm", "avi", "wmv", "flv", "mpg", "mpeg", "m2v", "ts",
    "mts", "m2ts", "3gp", "3g2", "ogv", "mxf", "dv", "vob", "f4v", "hevc", "h264", "y4m",
  ]
  /// Types the open panel offers. Registered dynamically so formats like MKV are not greyed out.
  public static var contentTypes: [UTType] {
    var types: [UTType] = [.image, .movie, .audiovisualContent, .gif]
    for ext in stillExtensions.union(videoExtensions) {
      if let t = UTType(filenameExtension: ext) { types.append(t) }
    }
    return types
  }

  public static var ffprobe: String? {
    guard let ffmpeg = MediaEngine.ffmpeg else { return nil }
    let resolved = URL(fileURLWithPath: ffmpeg).resolvingSymlinksInPath()
    let candidates = [
      ProcessInfo.processInfo.environment["CLEARFRAME_FFPROBE"],
      resolved.deletingLastPathComponent().appendingPathComponent("ffprobe").path,
      URL(fileURLWithPath: ffmpeg).deletingLastPathComponent().appendingPathComponent("ffprobe")
        .path,
      "/opt/homebrew/bin/ffprobe", "/usr/local/bin/ffprobe", NSHomeDirectory() + "/bin/ffprobe",
    ].compactMap { $0 }
    return candidates.first { FileManager.default.isExecutableFile(atPath: $0) }
  }

  static let proxyFolder: URL = {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent(
      "clearframe-proxies", isDirectory: true)
    try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }()

  /// Inspect a file and, for stills, decode them with ImageIO into an upright proxy.
  /// ImageIO reads iPhone grid HEIC, camera RAW, animated WebP/HEICS, CMYK JPEG and EXIF
  /// orientation, all of which the FFmpeg 7.0 still decoders get wrong or reject.
  public static func inspect(_ url: URL) throws -> MediaInfo {
    let ext = url.pathExtension.lowercased()
    if ext == "gif" || videoExtensions.contains(ext) { return try probe(url) }
    do { return try imageIOProxy(url) } catch {
      // Unknown extension or a still ImageIO rejects: let FFmpeg have a go.
      if let info = try? probe(url) { return info }
      throw error
    }
  }

  static func imageIOProxy(_ url: URL) throws -> MediaInfo {
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
      let type = CGImageSourceGetType(src), CGImageSourceGetCount(src) > 0
    else { throw MediaError.message("ImageIO cannot read this file.") }
    let utType = UTType(type as String)
    if utType?.conforms(to: .movie) == true { throw MediaError.message("Not a still") }
    let count = CGImageSourceGetCount(src)
    let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any] ?? [:]
    let pw = props[kCGImagePropertyPixelWidth] as? Int ?? 0
    let ph = props[kCGImagePropertyPixelHeight] as? Int ?? 0
    guard pw > 0, ph > 0 else { throw MediaError.message("No pixel size.") }
    let opts: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: max(pw, ph),
      kCGImageSourceShouldCacheImmediately: true,
    ]
    let animated = count > 1
    let proxy = proxyFolder.appendingPathComponent(UUID().uuidString + ".png")
    guard
      let dest = CGImageDestinationCreateWithURL(
        proxy as CFURL, UTType.png.identifier as CFString, animated ? count : 1, nil)
    else { throw MediaError.message("Could not create a decode proxy.") }
    if animated {
      CGImageDestinationSetProperties(
        dest,
        [kCGImagePropertyPNGDictionary: [kCGImagePropertyAPNGLoopCount: 0]] as CFDictionary)
    }
    var duration = 0.0
    var w = 0
    var h = 0
    for i in 0..<(animated ? count : 1) {
      guard let image = CGImageSourceCreateThumbnailAtIndex(src, i, opts as CFDictionary) else {
        throw MediaError.message("Frame \(i + 1) could not be decoded.")
      }
      if i == 0 {
        w = image.width
        h = image.height
      } else if image.width != w || image.height != h {
        throw MediaError.message("Animated frames change size.")
      }
      var frameProps: [CFString: Any] = [:]
      if animated {
        let delay = frameDelay(src, i)
        duration += delay
        frameProps[kCGImagePropertyPNGDictionary] = [
          kCGImagePropertyAPNGDelayTime: delay, kCGImagePropertyAPNGUnclampedDelayTime: delay,
        ]
      }
      CGImageDestinationAddImage(dest, image, frameProps as CFDictionary)
    }
    guard CGImageDestinationFinalize(dest) else {
      throw MediaError.message("Could not write a decode proxy.")
    }
    return MediaInfo(
      decodeURL: proxy, width: w, height: h, duration: animated ? duration : 0,
      animated: animated, hasAudio: false, hdr: false)
  }

  static func frameDelay(_ src: CGImageSource, _ i: Int) -> Double {
    let p = CGImageSourceCopyPropertiesAtIndex(src, i, nil) as? [CFString: Any] ?? [:]
    let dicts: [(CFString, CFString, CFString)] = [
      (kCGImagePropertyGIFDictionary, kCGImagePropertyGIFUnclampedDelayTime, kCGImagePropertyGIFDelayTime),
      (kCGImagePropertyPNGDictionary, kCGImagePropertyAPNGUnclampedDelayTime, kCGImagePropertyAPNGDelayTime),
      (kCGImagePropertyWebPDictionary, kCGImagePropertyWebPUnclampedDelayTime, kCGImagePropertyWebPDelayTime),
      (kCGImagePropertyHEICSDictionary, kCGImagePropertyHEICSUnclampedDelayTime, kCGImagePropertyHEICSDelayTime),
    ]
    for (dict, unclamped, clamped) in dicts {
      if let d = p[dict] as? [CFString: Any] {
        let v = (d[unclamped] as? Double) ?? (d[clamped] as? Double) ?? 0
        return v >= 0.02 ? v : 0.1
      }
    }
    return 0.1
  }

  /// Video and GIF: ask ffprobe for size, length, audio and transfer function.
  static func probe(_ url: URL) throws -> MediaInfo {
    guard let ffprobe else {
      throw MediaError.message("FFmpeg not found. Install with brew install ffmpeg.")
    }
    let p = Process()
    p.executableURL = URL(fileURLWithPath: ffprobe)
    p.arguments = [
      "-v", "error", "-show_entries",
      "stream=codec_type,width,height,color_transfer,duration,nb_frames:stream_side_data=rotation:format=duration",
      "-of", "json", url.path,
    ]
    let out = Pipe()
    let err = Pipe()
    p.standardOutput = out
    p.standardError = err
    try p.run()
    let data = out.fileHandleForReading.readDataToEndOfFile()
    let errData = err.fileHandleForReading.readDataToEndOfFile()
    p.waitUntilExit()
    guard p.terminationStatus == 0,
      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
      let detail = String(data: errData, encoding: .utf8) ?? ""
      throw MediaError.message(
        detail.isEmpty ? "This file has no readable picture." : String(detail.suffix(800)))
    }
    let streams = json["streams"] as? [[String: Any]] ?? []
    guard let video = streams.first(where: { $0["codec_type"] as? String == "video" }),
      var w = video["width"] as? Int, var h = video["height"] as? Int, w > 0, h > 0
    else { throw MediaError.message("This file has no picture track.") }
    let sideData = video["side_data_list"] as? [[String: Any]] ?? []
    if let rotation = sideData.compactMap({ $0["rotation"] as? Int }).first, abs(rotation) % 180 == 90 {
      swap(&w, &h)
    }
    let format = json["format"] as? [String: Any]
    let headerDuration =
      Double(format?["duration"] as? String ?? "") ?? Double(video["duration"] as? String ?? "")
      ?? 0
    var duration = headerDuration.isFinite ? max(0, headerDuration) : 0
    if duration == 0 { duration = packetDuration(url, ffprobe: ffprobe) }
    let transfer = video["color_transfer"] as? String ?? ""
    let isGIF = url.pathExtension.lowercased() == "gif"
    let frames = Int(video["nb_frames"] as? String ?? "") ?? 0
    return MediaInfo(
      decodeURL: url, width: w, height: h, duration: duration,
      animated: isGIF ? frames != 1 : true,
      hasAudio: streams.contains { $0["codec_type"] as? String == "audio" },
      hdr: ["arib-std-b67", "smpte2084"].contains(transfer))
  }

  /// Recordings from browsers (MediaRecorder WebM) often have no duration in the header.
  /// Demux every packet (no decoding) and take the last timestamp.
  static func packetDuration(_ url: URL, ffprobe: String) -> Double {
    let p = Process()
    p.executableURL = URL(fileURLWithPath: ffprobe)
    p.arguments = [
      "-v", "error", "-select_streams", "v:0", "-show_entries", "packet=pts_time,duration_time",
      "-of", "csv=p=0", url.path,
    ]
    let out = Pipe()
    p.standardOutput = out
    p.standardError = FileHandle.nullDevice
    guard (try? p.run()) != nil else { return 0 }
    let data = out.fileHandleForReading.readDataToEndOfFile()
    p.waitUntilExit()
    var end = 0.0
    for line in String(decoding: data, as: UTF8.self).split(separator: "\n") {
      let parts = line.split(separator: ",").compactMap { Double($0) }
      if let pts = parts.first { end = max(end, pts + (parts.count > 1 ? parts[1] : 0)) }
    }
    return end
  }

  public static func removeProxy(_ info: MediaInfo, original: URL) {
    if info.decodeURL != original, info.decodeURL.path.hasPrefix(proxyFolder.path) {
      try? FileManager.default.removeItem(at: info.decodeURL)
    }
  }
}
