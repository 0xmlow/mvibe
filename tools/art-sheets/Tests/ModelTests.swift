import Foundation

@main struct ModelTests {
    @MainActor static func main() throws {
        let model = ArtModel()
        let first = ArtworkItem(url: URL(fileURLWithPath: "/tmp/first.png"))
        let second = ArtworkItem(url: URL(fileURLWithPath: "/tmp/second.png"))
        model.items = [first, second]
        let saved = model.settings
        model.finish(first.id, folder: URL(fileURLWithPath: "/tmp/export"), settings: saved, dimensions: "256 × 256")
        precondition(model.readyCount == 1)
        model.brushStrength = 3
        precondition(model.readyCount == 2, "Changed settings must include previous exports")
        precondition(model.items[0].output != nil, "Keep earlier exports available")
        model.brushStrength = saved.brushStrength
        precondition(model.readyCount == 1)
        model.items = []
        model.refreshPreview()
        precondition(!model.previewBusy && model.previewImage == nil && model.stageImages.isEmpty)
        print("PASS: changed settings requeue exported art; previous outputs remain available; empty collection clears previews.")
    }
}
