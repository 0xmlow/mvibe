import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers
import XCTest

@testable import ClearframeCore

/// Import regressions: every still went through `-ss 0 -i file.jpg`, which FFmpeg 7.0 answers
/// with an empty output and exit status 0, so JPEG imports failed with "No readable image frame".
final class ImportTests: XCTestCase {
  var dir: URL!
  override func setUpWithError() throws {
    guard MediaEngine.ffmpeg != nil else { throw XCTSkip("FFmpeg missing") }
    dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  }
  override func tearDown() { try? FileManager.default.removeItem(at: dir) }

  func gradient(_ w: Int, _ h: Int) -> CGImage {
    let ctx = CGContext(
      data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
      space: CGColorSpace(name: CGColorSpace.sRGB)!,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    for x in 0..<w {
      ctx.setFillColor(red: CGFloat(x) / CGFloat(w), green: 0.3, blue: 0.8, alpha: 1)
      ctx.fill(CGRect(x: x, y: 0, width: 1, height: h))
    }
    return ctx.makeImage()!
  }
  func write(_ name: String, _ type: UTType, frames: Int = 1, orientation: Int? = nil) -> URL {
    let url = dir.appendingPathComponent(name)
    let dest = CGImageDestinationCreateWithURL(url as CFURL, type.identifier as CFString, frames, nil)!
    for _ in 0..<frames {
      var props: [CFString: Any] = [:]
      if let orientation { props[kCGImagePropertyOrientation] = orientation }
      if frames > 1 {
        props[kCGImagePropertyGIFDictionary] = [kCGImagePropertyGIFDelayTime: 0.1]
      }
      CGImageDestinationAddImage(dest, gradient(64, 40), props as CFDictionary)
    }
    XCTAssertTrue(CGImageDestinationFinalize(dest))
    return url
  }
  func roundTrip(_ url: URL, expect: (Int, Int), still: Bool, file: StaticString = #filePath, line: UInt = #line) throws {
    let info = try Media.inspect(url)
    XCTAssertEqual(info.width, expect.0, url.lastPathComponent, file: file, line: line)
    XCTAssertEqual(info.height, expect.1, url.lastPathComponent, file: file, line: line)
    XCTAssertEqual(info.isStill, still, url.lastPathComponent, file: file, line: line)
    let thumb = dir.appendingPathComponent(UUID().uuidString + ".png")
    try Pipeline.thumbnail(input: info.decodeURL, output: thumb, time: 0, control: JobControl())
    XCTAssertGreaterThan(
      (try? FileManager.default.attributesOfItem(atPath: thumb.path)[.size] as? Int) ?? 0, 0,
      "thumbnail for \(url.lastPathComponent)", file: file, line: line)
    var s = FinishSettings()
    s.noise = 6
    let ext = s.ext(for: url, animated: !info.isStill)
    let out = dir.appendingPathComponent(UUID().uuidString + "." + ext)
    try Pipeline.render(
      input: info.decodeURL, output: out, size: (info.width, info.height), regions: [],
      settings: s, hdr: info.hdr, control: JobControl())
    XCTAssertGreaterThan(
      (try? FileManager.default.attributesOfItem(atPath: out.path)[.size] as? Int) ?? 0, 0,
      "export for \(url.lastPathComponent)", file: file, line: line)
    Media.removeProxy(info, original: url)
  }

  func testJPEGImportsAndExports() throws {
    try roundTrip(write("photo.jpg", .jpeg), expect: (64, 40), still: true)
  }
  func testOrientationIsApplied() throws {
    // EXIF 6 = rotate 90° clockwise to display, so a 64x40 sensor image is 40x64 upright.
    try roundTrip(write("portrait.jpg", .jpeg, orientation: 6), expect: (40, 64), still: true)
  }
  func testHEICTIFFAndPNG() throws {
    try roundTrip(write("phone.heic", .heic), expect: (64, 40), still: true)
    try roundTrip(write("scan.tiff", .tiff), expect: (64, 40), still: true)
    try roundTrip(write("art.png", .png), expect: (64, 40), still: true)
  }
  func testGIFStaysAnimated() throws {
    try roundTrip(write("loop.gif", .gif, frames: 4), expect: (64, 40), still: false)
  }
  func testDitherExportOfStillAfterTrim() throws {
    // A trim start must never be applied to a still (it would seek past the only frame).
    let url = write("trimmed.jpg", .jpeg)
    let info = try Media.inspect(url)
    var s = FinishSettings.preset("Classic Macintosh")
    s.start = 0
    let out = dir.appendingPathComponent("trimmed.png")
    try Pipeline.render(
      input: info.decodeURL, output: out, size: (info.width, info.height), regions: [],
      settings: s, control: JobControl())
    XCTAssertNotNil(NSImageRepCount(out))
  }
  func NSImageRepCount(_ url: URL) -> Int? {
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil), CGImageSourceGetCount(src) > 0
    else { return nil }
    return CGImageSourceGetCount(src)
  }

  /// Point CLEARFRAME_MATRIX at a folder of real files (phone HEIC/MOV, WebM, MKV, ProRes,
  /// animated WebP, AVIF...) to run every one of them through import, preview and export.
  func testRealFileMatrix() throws {
    guard let folder = ProcessInfo.processInfo.environment["CLEARFRAME_MATRIX"] else {
      throw XCTSkip("Set CLEARFRAME_MATRIX to a folder of sample media")
    }
    let files = try FileManager.default.contentsOfDirectory(atPath: folder).filter {
      !$0.hasPrefix(".")
    }.sorted()
    var failures: [String] = []
    for name in files {
      let url = URL(fileURLWithPath: folder).appendingPathComponent(name)
      do {
        let info = try Media.inspect(url)
        let thumb = dir.appendingPathComponent(UUID().uuidString + ".png")
        try Pipeline.thumbnail(
          input: info.decodeURL, output: thumb, time: 0, hdr: info.hdr, control: JobControl())
        guard FileManager.default.fileExists(atPath: thumb.path) else {
          throw MediaError.message("empty thumbnail")
        }
        var s = FinishSettings()
        s.noise = 5
        if !info.isStill { s.duration = 1.5 }
        let ext = s.ext(for: url, animated: !info.isStill)
        let out = dir.appendingPathComponent(name + "." + ext)
        try Pipeline.render(
          input: info.decodeURL, output: out, size: (info.width, info.height), regions: [],
          settings: s, hdr: info.hdr, control: JobControl())
        var d = FinishSettings.preset("Cobalt print")
        if !info.isStill { d.duration = 1 }
        let dithered = dir.appendingPathComponent(name + "-dither." + d.ext(for: url, animated: !info.isStill))
        try Pipeline.render(
          input: info.decodeURL, output: dithered, size: (info.width, info.height),
          regions: [RepairRegion(x: 0.1, y: 0.1, width: 0.2, height: 0.2)], settings: d,
          hdr: info.hdr, control: JobControl())
        print(
          "MATRIX OK \(name): \(info.width)x\(info.height) \(info.isStill ? "still" : String(format: "%.2fs", info.duration))\(info.hdr ? " HDR" : "")\(info.decodeURL == url ? "" : " via ImageIO") -> \(ext)"
        )
        Media.removeProxy(info, original: url)
      } catch {
        failures.append("\(name): \(error.localizedDescription)")
      }
    }
    XCTAssertTrue(failures.isEmpty, failures.joined(separator: "\n"))
  }
}
