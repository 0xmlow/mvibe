import XCTest

@testable import ClearframeCore

final class CoreTests: XCTestCase {
  func testTextPreservesFactsAndParagraphs() {
    let input = "We utilize 42 samples in order to compare results.\n\nThe year is 2026. 👩‍💻"
    let (out, edits) = TextCleaner.clean(input, simplify: true, punctuation: true)
    XCTAssertEqual(out, "We use 42 samples to compare results.\n\nThe year is 2026. 👩‍💻")
    XCTAssertEqual(edits.count, 2)
  }
  func testSentenceStartsKeepTheirCapital() {
    let (out, _) = TextCleaner.clean(
      "In order to win, Utilize it. It is worth noting that the show sold out.", simplify: true,
      punctuation: true)
    XCTAssertEqual(out, "To win, Use it. The show sold out.")
  }
  func testNoSubstringEdits() {
    XCTAssertEqual(
      TextCleaner.clean("utilized reutilize", simplify: true, punctuation: false).0,
      "utilized reutilize")
  }
  func testRegionBounds() throws {
    XCTAssertEqual(
      try RepairRegion(x: 0, y: 0, width: 1, height: 1).filter(pixelWidth: 100, pixelHeight: 100),
      "delogo=x=2:y=2:w=96:h=96")
    XCTAssertThrowsError(
      try RepairRegion(x: 2, y: 2, width: 0.1, height: 0.1).filter(
        pixelWidth: 100, pixelHeight: 100))
  }
  func testMediaExports() throws {
    guard MediaEngine.ffmpeg != nil else { throw XCTSkip("FFmpeg unavailable") }
    let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: dir) }
    let input = dir.appendingPathComponent("source with spaces.mp4")
    try MediaEngine.run([
      "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=160x120:rate=10:duration=1",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:v", "libx264", "-c:a", "aac",
      "-metadata", "title=private source", "-shortest", input.path,
    ])
    for ext in ["png", "gif", "mp4"] {
      let out = dir.appendingPathComponent("result." + ext)
      let args = try MediaEngine.arguments(
        input: input, output: out, region: RepairRegion(x: 0.2, y: 0.2, width: 0.2, height: 0.2),
        size: (160, 120), strip: true)
      try MediaEngine.run(args)
      XCTAssertGreaterThan((try Data(contentsOf: out)).count, 100)
      try MediaEngine.run(["-loglevel", "error", "-i", out.path, "-f", "null", "-"])
    }
  }
}
