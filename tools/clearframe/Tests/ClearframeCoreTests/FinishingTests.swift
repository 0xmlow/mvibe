import XCTest

@testable import ClearframeCore

final class FinishingTests: XCTestCase {
  func testEveryAlgorithmPreservesAlphaAndUsesPalette() throws {
    var source = [UInt8]()
    for y in 0..<16 {
      for x in 0..<16 { source += [UInt8(x * 16), UInt8(y * 16), 100, UInt8(x == 0 ? 0 : 255)] }
    }
    for a in DitherAlgorithm.allCases where a != .off {
      let out = [UInt8](
        try Dither.apply(Data(source), width: 16, height: 16, algorithm: a, palette: .mono))
      XCTAssertEqual(out.count, source.count, a.rawValue)
      for i in stride(from: 0, to: out.count, by: 4) {
        XCTAssertEqual(out[i + 3], source[i + 3])
        if out[i + 3] > 0 {
          XCTAssertTrue(out[i] == 0 || out[i] == 255, a.rawValue)
          XCTAssertEqual(out[i], out[i + 1])
          XCTAssertEqual(out[i], out[i + 2])
        }
      }
    }
  }
  func testBlackWhiteAndRepeatableNoise() throws {
    for a in DitherAlgorithm.allCases {
      for v: UInt8 in [0, 255] {
        let pixels = Data(Array(repeating: [v, v, v, 255], count: 64).flatMap { $0 })
        XCTAssertEqual(
          try Dither.apply(pixels, width: 8, height: 8, algorithm: a, palette: .mono), pixels,
          a.rawValue)
      }
    }
    let pixels = Data(Array(repeating: [UInt8(128), 128, 128, 255], count: 64).flatMap { $0 })
    let a = try Dither.apply(
      pixels, width: 8, height: 8, algorithm: .noise, palette: .mono, seed: 42)
    XCTAssertEqual(
      a, try Dither.apply(pixels, width: 8, height: 8, algorithm: .noise, palette: .mono, seed: 42))
    XCTAssertNotEqual(
      a, try Dither.apply(pixels, width: 8, height: 8, algorithm: .noise, palette: .mono, seed: 99))
  }
  func testRecipesRoundTripAndNoUpscale() throws {
    var s = FinishSettings.preset("Cobalt print")
    s.maxEdge = 960
    let data = try JSONEncoder().encode(s)
    XCTAssertEqual(try JSONDecoder().decode(FinishSettings.self, from: data), s)
    XCTAssertEqual(s.size(1920, 1080).0, 960)
    XCTAssertEqual(s.size(200, 100).0, 200)
  }
  func testCancelledJobDoesNotLaunch() throws {
    let job = JobControl()
    job.cancel()
    XCTAssertThrowsError(try job.launch(Process()))
  }
  func testAllDithersAndNoiseExport() throws {
    guard MediaEngine.ffmpeg != nil else { throw XCTSkip("FFmpeg missing") }
    let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: dir) }
    let src = dir.appendingPathComponent("source.mp4")
    try MediaEngine.run([
      "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=96x64:rate=12:duration=0.5",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=0.5", "-c:v", "libx264", "-c:a", "aac",
      "-metadata", "title=PRIVATE", "-shortest", src.path,
    ])
    for algorithm in DitherAlgorithm.allCases {
      var s = FinishSettings()
      s.dither = algorithm
      s.palette = .cobalt
      s.noise = 5
      s.fps = 12
      let dest = dir.appendingPathComponent("\(algorithm.rawValue).png")
      let job = JobControl()
      DispatchQueue.global().asyncAfter(deadline: .now() + 15) { job.cancel() }
      try Pipeline.render(
        input: src, output: dest, size: (96, 64), regions: [], settings: s, preview: true,
        control: job)
      XCTAssertGreaterThan(try Data(contentsOf: dest).count, 100)
    }
    for ext in ["gif", "mp4"] {
      for dither in [DitherAlgorithm.off, .atkinson] {
        var s = FinishSettings()
        s.dither = dither
        s.noise = 4
        s.fps = 12
        let dest = dir.appendingPathComponent("animation-\(dither.rawValue).\(ext)")
        let job = JobControl()
        DispatchQueue.global().asyncAfter(deadline: .now() + 15) { job.cancel() }
        try Pipeline.render(
          input: src, output: dest, size: (96, 64),
          regions: [RepairRegion(x: 0.2, y: 0.2, width: 0.2, height: 0.2)], settings: s,
          control: job)
        try MediaEngine.run(["-v", "error", "-i", dest.path, "-f", "null", "-"])
        if ext == "mp4" {
          try MediaEngine.run(["-v", "error", "-i", dest.path, "-map", "0:a:0", "-f", "null", "-"])
        }
      }
    }
    let a = Pipeline.uniqueURL(folder: dir, name: "source", ext: "mp4")
    XCTAssertEqual(a.lastPathComponent, "source-1.mp4")
  }
}
