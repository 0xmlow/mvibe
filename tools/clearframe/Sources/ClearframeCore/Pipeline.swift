import Darwin
import Foundation

public struct FinishSettings: Codable, Equatable, Sendable {
  public var strip = true
  public var noise = 0.0
  public var animatedNoise = true
  public var colorNoise = false
  public var uniformNoise = false
  public var seed = 42
  public var dither = DitherAlgorithm.off
  public var palette = DitherPalette.mono
  public var spread = 64.0
  public var maxEdge = 0
  public var fps = 24
  public var crf = 18
  public var mute = false
  public var format = "Auto"
  public var start = 0.0
  public var duration = 0.0
  public init() {}
  public static let presets: [String] = [
    "Clean master", "Soft film grain", "Classic Macintosh", "Cobalt print", "Newsprint",
    "Retro color",
  ]
  public static func preset(_ name: String) -> Self {
    var s = Self()
    switch name {
    case "Soft film grain": s.noise = 5
    case "Classic Macintosh":
      s.dither = .atkinson
      s.palette = .mono
      s.maxEdge = 960
    case "Cobalt print":
      s.dither = .stucki
      s.palette = .cobalt
      s.maxEdge = 1280
    case "Newsprint":
      s.dither = .halftone
      s.palette = .mono
      s.maxEdge = 1280
    case "Retro color":
      s.dither = .bayer4
      s.palette = .rgb27
      s.maxEdge = 960
    default: break
    }
    return s
  }
  public func size(_ w: Int, _ h: Int) -> (Int, Int) {
    guard maxEdge > 0, max(w, h) > maxEdge else { return (w, h) }
    let scale = Double(maxEdge) / Double(max(w, h))
    return (max(2, Int(Double(w) * scale)), max(2, Int(Double(h) * scale)))
  }
  public func ext(for url: URL, animated: Bool? = nil) -> String {
    if format != "Auto" { return format.lowercased() }
    if let animated, url.pathExtension.lowercased() != "gif",
      Media.stillExtensions.contains(url.pathExtension.lowercased())
    {
      return animated ? "gif" : "png"
    }
    if Media.stillExtensions.contains(url.pathExtension.lowercased()) {
      return "png"
    }
    return url.pathExtension.lowercased() == "gif" ? "gif" : "mp4"
  }
}
public final class JobControl: @unchecked Sendable {
  private let lock = NSLock()
  private var processes: [Process] = []
  private var stopped = false
  public init() {}
  public var cancelled: Bool {
    lock.lock()
    defer { lock.unlock() }
    return stopped
  }
  public func launch(_ p: Process) throws {
    lock.lock()
    defer { lock.unlock() }
    if stopped { throw MediaError.message("Cancelled") }
    try p.run()
    processes.append(p)
  }
  public func cancel() {
    lock.lock()
    stopped = true
    for p in processes where p.isRunning { p.terminate() }
    lock.unlock()
  }
  public func check() throws { if cancelled { throw MediaError.message("Cancelled") } }
}
public enum Pipeline {
  static let base = ["-hide_banner", "-loglevel", "error", "-nostdin", "-y"]
  /// FFmpeg 7.0 writes nothing (and still exits 0) for `-ss 0` in front of a JPEG or PNG,
  /// which made every still import fail. Only seek when there is somewhere to seek to.
  static func seek(_ t: Double) -> [String] { t > 0.0005 ? ["-ss", String(t)] : [] }
  /// HLG/PQ video to SDR BT.709, so iPhone HDR clips do not export grey and washed out.
  static let toneMap =
    "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=mobius:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
  static func makeProcess(_ args: [String], log: FileHandle) throws -> Process {
    guard let path = MediaEngine.ffmpeg else {
      throw MediaError.message("FFmpeg not found. Install with brew install ffmpeg.")
    }
    let p = Process()
    p.executableURL = URL(fileURLWithPath: path)
    p.arguments = args
    p.standardError = log
    p.standardOutput = FileHandle.nullDevice
    return p
  }
  public static func thumbnail(
    input: URL, output: URL, time: Double, hdr: Bool = false, control: JobControl
  ) throws {
    let logURL = FileManager.default.temporaryDirectory.appendingPathComponent(
      UUID().uuidString + ".log")
    FileManager.default.createFile(atPath: logURL.path, contents: nil)
    let log = try FileHandle(forWritingTo: logURL)
    defer {
      try? log.close()
      try? FileManager.default.removeItem(at: logURL)
    }
    let p = try makeProcess(
      base + seek(time) + ["-i", input.path] + (hdr ? ["-vf", toneMap] : []) + [
        "-frames:v", "1", "-update", "1", output.path,
      ], log: log)
    try control.launch(p)
    p.waitUntilExit()
    try control.check()
    if p.terminationStatus != 0 {
      throw MediaError.message(
        String(((try? String(contentsOf: logURL)) ?? "Could not decode media").suffix(1500)))
    }
  }
  public static func uniqueURL(folder: URL, name: String, ext: String) -> URL {
    var suffix = 0
    while true {
      let url = folder.appendingPathComponent(name + (suffix == 0 ? "" : "-\(suffix)") + "." + ext)
      if !FileManager.default.fileExists(atPath: url.path) { return url }
      suffix += 1
    }
  }
  public static func render(
    input: URL, output: URL, size: (Int, Int), regions: [RepairRegion], settings: FinishSettings,
    preview: Bool = false, previewTime: Double = 0, hdr: Bool = false, control: JobControl,
    progress: @escaping @Sendable (Int) -> Void = { _ in }
  ) throws {
    signal(SIGPIPE, SIG_IGN)
    let s = settings
    guard s.start >= 0, s.duration >= 0, s.start.isFinite, s.duration.isFinite,
      previewTime.isFinite, s.fps > 0, s.fps <= 120, s.noise.isFinite, s.noise >= 0, s.noise <= 100,
      s.seed >= 0, s.seed <= 2_147_483_647, s.spread.isFinite
    else { throw MediaError.message("Invalid trim, noise seed, or frame-rate settings.") }
    let temp = FileManager.default.temporaryDirectory.appendingPathComponent(
      UUID().uuidString + ".log")
    FileManager.default.createFile(atPath: temp.path, contents: nil)
    let log = try FileHandle(forWritingTo: temp)
    defer {
      try? log.close()
      try? FileManager.default.removeItem(at: temp)
    }
    func check(_ p: Process) throws {
      p.waitUntilExit()
      try control.check()
      if p.terminationStatus != 0 {
        throw MediaError.message(
          String(((try? String(contentsOf: temp)) ?? "Export failed").suffix(2000)))
      }
    }
    var filters = hdr ? [toneMap] : []
    filters += try regions.map { try $0.filter(pixelWidth: size.0, pixelHeight: size.1) }
    let (w, h) = s.size(size.0, size.1)
    if (w, h) != size { filters.append("scale=\(w):\(h):flags=lanczos") }
    if s.noise > 0 {
      let flags = (s.animatedNoise ? "t" : "") + (s.uniformNoise ? "+u" : "")
      let f = flags.trimmingCharacters(in: CharacterSet(charactersIn: "+"))
      if s.colorNoise {
        filters.append(
          "noise=alls=\(Int(s.noise)):all_seed=\(s.seed)" + (f.isEmpty ? "" : ":allf=\(f)"))
      } else {
        filters.append(
          "format=yuva444p,noise=c0s=\(Int(s.noise)):c0_seed=\(s.seed)"
            + (f.isEmpty ? "" : ":c0f=\(f)"))
      }
    }
    let ext = output.pathExtension.lowercased()
    let still = ["png", "jpg", "jpeg"].contains(ext)
    let native = s.dither != .off
    if !still && native { filters.append("fps=\(s.fps)") }
    var source = base + seek(s.start + (preview ? previewTime : 0)) + ["-i", input.path]
    if !preview && s.duration > 0 { source += ["-t", String(s.duration)] }
    if preview || still { source += ["-frames:v", "1"] }
    var outputArgs: [String] = []
    if s.strip {
      outputArgs += ["-map_metadata", "-1", "-map_chapters", "-1", "-metadata", "encoder="]
    } else {
      outputArgs += ["-map_metadata", native ? "1" : "0"]
    }
    if ext == "mp4" {
      outputArgs += [
        "-c:v", "libx264", "-crf", String(s.crf), "-preset", "medium", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
      ]
      if !s.mute { outputArgs += ["-c:a", "aac", "-b:a", "192k"] }
    }
    if still {
      outputArgs += ["-frames:v", "1", "-update", "1"]
      if ext != "png" { outputArgs += ["-q:v", "2"] }
    }
    if ext == "gif" { outputArgs += ["-loop", "0"] }
    if !native {
      if ext == "mp4" { filters.append("pad=ceil(iw/2)*2:ceil(ih/2)*2") }
      let chain = filters.isEmpty ? "null" : filters.joined(separator: ",")
      if ext == "gif" {
        source += [
          "-filter_complex",
          "[0:v]\(chain),split[a][b];[a]palettegen=stats_mode=single[p];[b][p]paletteuse=new=1:dither=sierra2_4a[out]",
          "-map", "[out]",
        ]
      } else {
        source += ["-vf", chain, "-map", "0:v:0"]
      }
      if ext == "mp4" && !s.mute { source += ["-map", "0:a?"] }
      let p = try makeProcess(source + outputArgs + [output.path], log: log)
      try control.launch(p)
      try check(p)
      return
    }
    // Stream one RGBA frame at a time through the native dither engine.
    filters.append("format=rgba")
    let decoded = Pipe()
    let encoded = Pipe()
    let decoder = try makeProcess(
      source + [
        "-vf", filters.joined(separator: ","), "-map", "0:v:0", "-an", "-f", "rawvideo", "-pix_fmt",
        "rgba", "pipe:1",
      ], log: log)
    decoder.standardOutput = decoded
    var encoderArgs =
      base + [
        "-f", "rawvideo", "-pixel_format", "rgba", "-video_size", "\(w)x\(h)", "-framerate",
        String(s.fps), "-i", "pipe:0",
      ] + seek(s.start) + ["-i", input.path]
    if !preview && s.duration > 0 { encoderArgs += ["-t", String(s.duration)] }
    if ext == "gif" {
      encoderArgs += [
        "-filter_complex",
        "[0:v]split[a][b];[a]palettegen=stats_mode=single[p];[b][p]paletteuse=new=1:dither=none[out]",
        "-map", "[out]",
      ]
    } else {
      encoderArgs += ["-map", "0:v:0"]
      if ext == "mp4" { encoderArgs += ["-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2"] }
    }
    if ext == "mp4" && !s.mute { encoderArgs += ["-map", "1:a?", "-shortest"] }
    let encoder = try makeProcess(encoderArgs + outputArgs + [output.path], log: log)
    encoder.standardInput = encoded
    defer {
      for p in [decoder, encoder] where p.isRunning { p.terminate() }
      try? decoded.fileHandleForReading.close()
      try? encoded.fileHandleForWriting.close()
    }
    try control.launch(encoder)
    try control.launch(decoder)
    // Close parent copies so EOF and broken pipes propagate correctly.
    try encoded.fileHandleForReading.close()
    try decoded.fileHandleForWriting.close()
    let frameBytes = w * h * 4
    var frame = Data()
    frame.reserveCapacity(frameBytes)
    var count = 0
    while true {
      try control.check()
      guard let chunk = try decoded.fileHandleForReading.read(upToCount: frameBytes - frame.count),
        !chunk.isEmpty
      else { break }
      frame.append(chunk)
      if frame.count == frameBytes {
        let result = try Dither.apply(
          frame, width: w, height: h, algorithm: s.dither, palette: s.palette, spread: s.spread,
          seed: s.seed)
        try encoded.fileHandleForWriting.write(contentsOf: result)
        frame.removeAll(keepingCapacity: true)
        count += 1
        if count % 5 == 0 { progress(count) }
      }
    }
    try encoded.fileHandleForWriting.close()
    try check(decoder)
    try check(encoder)
    guard frame.isEmpty, count > 0 else {
      throw MediaError.message("Incomplete or empty decoded media.")
    }
  }
}
