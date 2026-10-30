import AVKit
import ClearframeCore
import ImageIO
import SwiftUI
import UniformTypeIdentifiers

struct MediaItem: Identifiable {
  let id = UUID()
  let url: URL
  var thumbnail: NSImage?
  var width = 0
  var height = 0
  var duration = 0.0
  var regions: [RepairRegion] = []
  var state = "Ready"
  var failure: String?
  var output: URL?
  var info: MediaInfo?
  /// What FFmpeg reads: an upright ImageIO proxy for stills, the original for video and GIF.
  var decodeURL: URL { info?.decodeURL ?? url }
  var isStill: Bool { info?.isStill ?? false }
}
struct SavedRecipe: Codable, Identifiable {
  var id = UUID()
  var name: String
  var settings: FinishSettings
}
@MainActor final class Studio: ObservableObject {
  @Published var items: [MediaItem] = []
  @Published var selection: UUID?
  @Published var settings = FinishSettings()
  @Published var original: NSImage?
  @Published var preview: NSImage?
  @Published var draft: RepairRegion?
  @Published var drawRegion = false
  @Published var showOriginal = false
  @Published var previewTime = 0.0
  @Published var busy = false
  @Published var status = "Ready when you are."
  @Published var error: String?
  @Published var completed = 0
  @Published var total = 0
  @Published var frames = 0
  @Published var player: AVPlayer?
  @Published var recipes: [SavedRecipe] = []
  var control: JobControl?
  var index: Int? { items.firstIndex { $0.id == selection } }
  var selected: MediaItem? {
    guard let index else { return nil }
    return items[index]
  }
  init() {
    if let data = UserDefaults.standard.data(forKey: "Clearframe.recipes"),
      let r = try? JSONDecoder().decode([SavedRecipe].self, from: data)
    {
      recipes = r
    }
  }
  func saveRecipe(_ name: String) {
    let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !n.isEmpty else { return }
    recipes.append(SavedRecipe(name: n, settings: settings))
    persist()
  }
  func removeRecipe(_ id: UUID) {
    recipes.removeAll { $0.id == id }
    persist()
  }
  func persist() {
    if let data = try? JSONEncoder().encode(recipes) {
      UserDefaults.standard.set(data, forKey: "Clearframe.recipes")
    }
  }
  func invalidate() {
    preview = nil
    player = nil
    frames = 0
  }
  func select(_ id: UUID) {
    guard !busy else { return }
    selection = id
    original = selected?.thumbnail
    preview = nil
    draft = nil
    previewTime = 0
    player = nil
  }
  func choose() {
    let p = NSOpenPanel()
    p.allowedContentTypes = Media.contentTypes
    p.allowsMultipleSelection = true
    if p.runModal() == .OK { add(p.urls) }
  }
  func add(_ urls: [URL]) {
    guard !busy else { return }
    let existing = Set(items.map { $0.url.standardizedFileURL })
    let unique = Array(Set(urls.map { $0.standardizedFileURL })).filter { !existing.contains($0) }
      .sorted { $0.lastPathComponent < $1.lastPathComponent }
    guard !unique.isEmpty else { return }
    busy = true
    total = unique.count
    completed = 0
    let job = JobControl()
    control = job
    Task {
      for url in unique {
        if job.cancelled { break }
        status = "Importing \(url.lastPathComponent)…"
        do {
          let info = try await Task.detached { try Media.inspect(url) }.value
          var item = MediaItem(url: url)
          item.info = info
          do {
            let (image, w, h) = try await thumbnail(
              info.decodeURL, time: 0, hdr: info.hdr, job: job)
            item.thumbnail = image
            item.width = w
            item.height = h
          } catch {
            Media.removeProxy(info, original: url)
            throw error
          }
          item.duration = info.duration
          items.append(item)
        } catch {
          if !job.cancelled {
            var item = MediaItem(url: url)
            item.state = "Import failed"
            item.failure = error.localizedDescription
            items.append(item)
          }
        }
        completed += 1
      }
      busy = false
      control = nil
      if selection == nil, let first = items.first(where: { $0.thumbnail != nil }) {
        select(first.id)
      }
      status = "\(items.count) files in the queue."
    }
  }
  func thumbnail(_ url: URL, time: Double, hdr: Bool = false, job: JobControl) async throws -> (
    NSImage, Int, Int
  ) {
    let tmp = FileManager.default.temporaryDirectory.appendingPathComponent(
      UUID().uuidString + ".png")
    defer { try? FileManager.default.removeItem(at: tmp) }
    try await Task.detached {
      try Pipeline.thumbnail(input: url, output: tmp, time: time, hdr: hdr, control: job)
    }.value
    guard let image = NSImage(contentsOf: tmp), let rep = image.representations.first else {
      throw MediaError.message("No readable image frame.")
    }
    return (image, rep.pixelsWide, rep.pixelsHigh)
  }
  func commitRegion() {
    guard let i = index, let draft, draft.width > 0.001, draft.height > 0.001 else { return }
    items[i].regions.append(draft)
    self.draft = nil
    invalidate()
  }
  func clearRegions() {
    guard let i = index else { return }
    items[i].regions = []
    draft = nil
    invalidate()
  }
  func copyRegions() {
    guard let selected else { return }
    for i in items.indices { items[i].regions = selected.regions }
    status = "Repair regions applied proportionally to every queued file."
  }
  func removeSelected() {
    guard !busy, let i = index else { return }
    if let info = items[i].info { Media.removeProxy(info, original: items[i].url) }
    items.remove(at: i)
    selection = nil
    original = nil
    preview = nil
    draft = nil
    if let first = items.first { select(first.id) }
  }
  func cancel() {
    control?.cancel()
    status = "Cancelling…"
  }
  func makePreview(animated: Bool = false) {
    guard !busy, let item = selected, item.thumbnail != nil else { return }
    commitRegion()
    let regions = selected?.regions ?? []
    var s = settings
    if item.isStill {
      s.start = 0
      s.duration = 0
    }
    if animated {
      s.start += previewTime
      s.duration = min(3, max(0.1, item.duration - s.start))
      s.format = "MP4"
    }
    let temp = FileManager.default.temporaryDirectory.appendingPathComponent(
      "clearframe-preview-" + UUID().uuidString + (animated ? ".mp4" : ".png"))
    busy = true
    frames = 0
    status = animated ? "Rendering a 3-second motion preview…" : "Rendering comparison…"
    let job = JobControl()
    control = job
    let time = previewTime
    Task {
      do {
        if !animated {
          let source = try await thumbnail(
            item.decodeURL, time: item.isStill ? 0 : s.start + time, hdr: item.info?.hdr ?? false,
            job: job)
          original = source.0
        }
        let snapshot = s
        try await Task.detached {
          try Pipeline.render(
            input: item.decodeURL, output: temp, size: (item.width, item.height), regions: regions,
            settings: snapshot, preview: !animated, previewTime: animated || item.isStill ? 0 : time,
            hdr: item.info?.hdr ?? false, control: job,
            progress: { n in Task { @MainActor in self.frames = n } })
        }.value
        if animated {
          player = AVPlayer(url: temp)
          player?.play()
          motionFiles.append(temp)
        } else {
          preview = NSImage(contentsOf: temp)
          try? FileManager.default.removeItem(at: temp)
        }
        showOriginal = false
        status = "Preview ready."
      } catch {
        if !job.cancelled { self.error = error.localizedDescription }
        try? FileManager.default.removeItem(at: temp)
        status = job.cancelled ? "Cancelled." : "Preview failed."
      }
      busy = false
      control = nil
    }
  }
  var motionFiles: [URL] = []
  func export(all: Bool) {
    guard !busy else { return }
    commitRegion()
    let targets = all ? items.filter { $0.thumbnail != nil } : selected.map { [$0] } ?? []
    guard !targets.isEmpty else { return }
    let p = NSOpenPanel()
    p.canChooseDirectories = true
    p.canChooseFiles = false
    p.prompt = "Export here"
    p.message = "Clearframe creates new files and never overwrites existing files."
    guard p.runModal() == .OK, let folder = p.url else { return }
    busy = true
    completed = 0
    total = targets.count
    frames = 0
    let job = JobControl()
    control = job
    let s = settings
    Task {
      var failed = 0
      for item in targets {
        if job.cancelled { break }
        guard let idx = items.firstIndex(where: { $0.id == item.id }) else { continue }
        items[idx].state = "Exporting"
        items[idx].failure = nil
        status = "Exporting \(completed+1) / \(total) · \(item.url.lastPathComponent)"
        frames = 0
        var s = s
        if item.isStill {
          s.start = 0
          s.duration = 0
        }
        let ext = s.ext(for: item.url, animated: item.info.map { !$0.isStill })
        let destination = Pipeline.uniqueURL(
          folder: folder, name: item.url.deletingPathExtension().lastPathComponent + "-finished",
          ext: ext)
        let staging = folder.appendingPathComponent(".clearframe-" + UUID().uuidString + "." + ext)
        do {
          let snapshot = s
          try await Task.detached {
            try Pipeline.render(
              input: item.decodeURL, output: staging, size: (item.width, item.height),
              regions: item.regions, settings: snapshot, hdr: item.info?.hdr ?? false, control: job,
              progress: { n in Task { @MainActor in self.frames = n } })
          }.value
          try job.check()
          try FileManager.default.moveItem(at: staging, to: destination)
          items[idx].state = "Done"
          items[idx].output = destination
        } catch {
          items[idx].state = job.cancelled ? "Cancelled" : "Failed"
          items[idx].failure = error.localizedDescription
          failed += 1
          try? FileManager.default.removeItem(at: staging)
        }
        completed += 1
      }
      busy = false
      control = nil
      status =
        job.cancelled
        ? "Batch cancelled. Finished files are kept."
        : "Finished \(completed-failed) / \(total) files"
          + (failed > 0 ? " · \(failed) failed; see queue details." : ".")
    }
  }
  func cleanup() {
    for item in items { if let info = item.info { Media.removeProxy(info, original: item.url) } }
    for url in motionFiles { try? FileManager.default.removeItem(at: url) }
    motionFiles = []
  }
}
