import Foundation

@main struct EngineTests {
    static func main() throws {
        let output = FileManager.default.temporaryDirectory.appendingPathComponent("ArtSheets-cancel-test-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: output) }
        let art = CellArtwork(width: 100, height: 100, pixels: Array(repeating: 0x127856, count: 10000))
        let cancel = CancellationFlag()
        var didCancel = false
        do {
            _ = try ArtEngine.export(art,title:"Cancel test",destination:output,settings:ExportSettings(),cancel:cancel) { value,_ in
                if value > 0.1 { cancel.cancel() }
            }
        } catch ArtError.cancelled { didCancel = true }
        guard didCancel, try FileManager.default.contentsOfDirectory(atPath: output.path).isEmpty else {
            throw ArtError.message("Cancellation did not remove the incomplete export.")
        }
        print("PASS: cancellation interrupts conversion and leaves no partial artwork folder.")
    }
}
