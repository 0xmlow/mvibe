import SwiftUI
import AppKit
import UniformTypeIdentifiers

private let mint = Color(red: 0.57, green: 0.92, blue: 0.77)
private let canvas = Color(red: 0.045, green: 0.055, blue: 0.065)

struct ArtworkItem: Identifiable {
    let id = UUID()
    let url: URL
    var status = "Ready"
    var output: URL?
    var exportedSettings: ExportSettings?
    var error: String?
    var dimensions: String?
}

@MainActor final class ArtModel: ObservableObject {
    @Published var items: [ArtworkItem] = []
    @Published var selection: UUID?
    @Published var busy = false
    @Published var progress = 0.0
    @Published var stage = "Ready when you are"
    @Published var detail = 256
    @Published var paintColors = 24
    @Published var brushStrength = 2
    @Published var previewImage: NSImage?
    @Published var previewStage = "Painting"
    @Published var stageImages: [String: NSImage] = [:]
    @Published var previewBusy = false
    @Published var previewDescription = ""
    private var previewID = UUID()
    private var previewCancellation: CancellationFlag?
    @Published var pngScale = 4
    @Published var whiteMatte = false
    @Published var destination: URL?
    @Published var showOutput = true
    @Published var notice: String?
    var cancellation: CancellationFlag?
    var selected: ArtworkItem? { items.first { $0.id == selection } ?? items.first }
    var readyCount: Int { items.filter { $0.output == nil || $0.exportedSettings != settings }.count }
    var settings: ExportSettings { ExportSettings(longEdge:detail,pngScale:pngScale,whiteMatte:whiteMatte,paintColors:paintColors,brushStrength:brushStrength) }

    func refreshPreview() {
        previewCancellation?.cancel();previewID=UUID();previewImage=nil;stageImages=[:];previewDescription=""
        guard let selected else {previewBusy=false;return}
        let flag=CancellationFlag(),id=UUID(),configuration=settings,url=selected.url
        previewID=id;previewCancellation=flag;previewBusy=true
        Task.detached(priority:.userInitiated) { [weak self] in
            do {
                let art=try CellArtwork.readImage(url,settings:configuration,cancel:flag)
                let cg=ArtEngine.previewImage(art)
                let stages = art.layers.compactMap { layer -> (String, CGImage)? in
                    guard let image = ArtEngine.previewImage(CellArtwork(width: art.width, height: art.height, pixels: layer.pixels)) else { return nil }
                    return (layer.name, image)
                }
                await MainActor.run { [weak self] in
                    guard let self,self.previewID==id else {return}
                    self.previewImage=cg.map {NSImage(cgImage:$0,size:.zero)}
                    self.stageImages = Dictionary(uniqueKeysWithValues: stages.map { ($0.0, NSImage(cgImage: $0.1, size: .zero)) })
                    if let image = self.previewImage { self.stageImages["Painting"] = image }
                    self.previewDescription="\(art.width) × \(art.height) cells · \(Set(art.pixels).count) pigments · 3 painting stages"
                    self.previewBusy=false
                }
            } catch {
                await MainActor.run { [weak self] in
                    guard let self,self.previewID==id else {return}
                    self.previewBusy=false;self.previewDescription=error.localizedDescription
                }
            }
        }
    }

    func addImages() {
        let panel = NSOpenPanel(); panel.title = "Choose artwork"; panel.prompt = "Add artwork"
        panel.allowedContentTypes = [.image]; panel.allowsMultipleSelection = true
        panel.begin { response in if response == .OK { self.add(panel.urls) } }
    }
    func addFolder() {
        let panel = NSOpenPanel(); panel.title = "Choose a folder of artwork"; panel.prompt = "Add folder"
        panel.canChooseDirectories = true; panel.canChooseFiles = false
        panel.begin { response in if response == .OK { self.add(panel.urls) } }
    }
    func chooseDestination(andExport: Bool = false) {
        let panel = NSOpenPanel(); panel.title = "Where should Art sheets save your files?"; panel.prompt = "Use this folder"
        panel.canChooseDirectories = true; panel.canChooseFiles = false; panel.canCreateDirectories = true
        panel.begin { response in
            if response == .OK { self.destination = panel.url; if andExport { self.start() } }
        }
    }
    func add(_ urls: [URL]) {
        guard !busy else { return }
        let fm = FileManager.default
        var files: [URL] = []
        for url in urls {
            var directory: ObjCBool = false
            if fm.fileExists(atPath: url.path, isDirectory: &directory), directory.boolValue {
                if let enumerator = fm.enumerator(at: url, includingPropertiesForKeys: [.isRegularFileKey], options: [.skipsHiddenFiles, .skipsPackageDescendants]) {
                    for case let child as URL in enumerator {
                        if child.lastPathComponent.contains(" - Art sheets") { enumerator.skipDescendants(); continue }
                        if (try? child.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true { files.append(child) }
                    }
                }
            } else { files.append(url) }
        }
        let existing = Set(items.map { $0.url.standardizedFileURL.path })
        var seen = existing
        var accepted = 0
        for url in files.sorted(by: { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending }) {
            let supported = UTType(filenameExtension: url.pathExtension)?.conforms(to: .image) == true
            guard supported, !seen.contains(url.standardizedFileURL.path) else { continue }
            items.append(ArtworkItem(url: url)); seen.insert(url.standardizedFileURL.path); accepted += 1
        }
        if selection == nil { selection = items.first?.id }
        if accepted == 0 && files.count > 0 { notice = "No new supported images were found. Add PNG, JPEG, HEIC, TIFF, or another image macOS can read." }
        else { stage = "\(items.count) artwork\(items.count == 1 ? "" : "s") in your collection" }
    }
    func removeSelected() {
        guard !busy, let selected else { return }
        items.removeAll { $0.id == selected.id }; selection = items.first?.id
    }
    func cancel() { cancellation?.cancel(); stage = "Stopping after the current operation…" }
    func reveal() { if let url = selected?.output ?? destination { NSWorkspace.shared.open(url) } }
    func openWorkbook() {
        guard let selected,let output=selected.output else {return}
        let file=output.appendingPathComponent(ArtEngine.stem(selected.url.deletingPathExtension().lastPathComponent)+".xlsx")
        if !NSWorkspace.shared.open(file) {notice="The workbook is saved in your export folder. Open it with Microsoft Excel or another app that supports .xlsx files."}
    }
    func start() {
        guard !busy, !items.isEmpty else { return }
        if destination == nil { chooseDestination(andExport: true); return }
        guard let destination else { return }
        let pending = items.filter { $0.output == nil || $0.exportedSettings != self.settings }
        let jobs = pending.isEmpty ? items : pending
        let settings = self.settings
        let flag = CancellationFlag(); cancellation = flag; busy = true; progress = 0
        let jobIDs = Set(jobs.map(\.id))
        for index in items.indices where jobIDs.contains(items[index].id) { items[index].error = nil; items[index].status = "Waiting" }
        Task.detached(priority: .userInitiated) { [weak self] in
            var completed = 0, failed = 0, stopped = false
            for (jobIndex, job) in jobs.enumerated() {
                do {
                    try flag.check()
                    await self?.begin(job.id)
                    let artwork = try autoreleasepool { try CellArtwork.readImage(job.url, settings: settings, cancel: flag) }
                    let folder = try autoreleasepool {
                        try ArtEngine.export(artwork, title: job.url.deletingPathExtension().lastPathComponent, destination: destination, settings: settings, cancel: flag) { fraction, label in
                            Task { @MainActor [weak self] in
                                self?.progress = (Double(jobIndex)+fraction)/Double(jobs.count)
                                self?.stage = "\(jobIndex+1) of \(jobs.count) · \(label)"
                            }
                        }
                    }
                    completed += 1
                    await self?.finish(job.id, folder: folder, settings: settings, dimensions: "\(artwork.width) × \(artwork.height) cells")
                } catch ArtError.cancelled { stopped = true; await self?.reset(job.id); break }
                catch { failed += 1; await self?.fail(job.id, message: error.localizedDescription) }
            }
            await self?.end(completed: completed, failed: failed, stopped: stopped)
        }
    }
    func begin(_ id: UUID) { selection = id; if let i = items.firstIndex(where: {$0.id == id}) { items[i].status = "Converting" } }
    func finish(_ id: UUID, folder: URL, settings: ExportSettings, dimensions: String) { if let i = items.firstIndex(where: {$0.id == id}) { items[i].status = "Exported"; items[i].output = folder; items[i].exportedSettings = settings; items[i].dimensions = dimensions } }
    func reset(_ id: UUID) { if let i = items.firstIndex(where: {$0.id == id}) { items[i].status = "Ready" } }
    func fail(_ id: UUID, message: String) { if let i = items.firstIndex(where: {$0.id == id}) { items[i].status = "Needs attention"; items[i].error = message } }
    func end(completed: Int, failed: Int, stopped: Bool) {
        busy = false; cancellation = nil
        for i in items.indices where items[i].status == "Waiting" { items[i].status = "Ready" }
        if stopped { stage = "Stopped · \(completed) exported. Remaining artwork is ready to resume." }
        else if failed > 0 { stage = "\(completed) exported · \(failed) need attention. Select an artwork for details."; progress = 1 }
        else { stage = "\(completed) artwork\(completed == 1 ? "" : "s") exported · Excel, SVG, and PNG"; progress = 1 }
    }
}

struct ArtSheetsApp: App {
    @StateObject private var model = ArtModel()
    var body: some Scene {
        WindowGroup("Art sheets") { ContentView(model: model).preferredColorScheme(.dark) }
            .defaultSize(width: 1220, height: 800)
            .windowStyle(.hiddenTitleBar)
            .commands {
                CommandGroup(replacing: .newItem) {
                    Button("Add artwork…") { model.addImages() }.keyboardShortcut("o").disabled(model.busy)
                    Button("Add folder…") { model.addFolder() }.keyboardShortcut("o", modifiers: [.command,.shift]).disabled(model.busy)
                }
                CommandMenu("Artwork") {
                    Button("Export collection") { model.start() }.keyboardShortcut("e").disabled(model.busy || model.items.isEmpty)
                    Button("Show exports in Finder") { model.reveal() }.disabled(model.destination == nil)
                }
            }
    }
}

struct ContentView: View {
    @ObservedObject var model: ArtModel
    @State private var isTargeted = false
    var body: some View {
        VStack(spacing: 0) {
            header
            Divider().opacity(0.4)
            HStack(spacing: 0) {
                sidebar.frame(width: 240)
                Divider().opacity(0.4)
                preview.frame(maxWidth: .infinity, maxHeight: .infinity)
                Divider().opacity(0.4)
                settings.frame(width: 264)
            }
            Divider().opacity(0.4)
            footer
        }
        .background(canvas)
        .frame(minWidth: 1000, minHeight: 650)
        .tint(mint)
        .onChange(of:model.selection) { _ in model.refreshPreview() }
        .onChange(of:model.detail) { _ in model.refreshPreview() }
        .onChange(of:model.paintColors) { _ in model.refreshPreview() }
        .onChange(of:model.brushStrength) { _ in model.refreshPreview() }
        .onChange(of:model.whiteMatte) { _ in model.refreshPreview() }
        .onDrop(of: [UTType.fileURL], isTargeted: $isTargeted) { providers in
            guard !model.busy else { return false }
            for provider in providers {
                _ = provider.loadObject(ofClass: URL.self) { url, _ in
                    if let url { Task { @MainActor in model.add([url]) } }
                }
            }
            return true
        }
        .overlay { if isTargeted { RoundedRectangle(cornerRadius: 16).stroke(mint, lineWidth: 3).padding(6).allowsHitTesting(false) } }
        .alert("Art sheets", isPresented: Binding(get: {model.notice != nil}, set: {if !$0 {model.notice = nil}})) { Button("OK") {model.notice = nil} } message: {Text(model.notice ?? "")}
    }
    private var header: some View {
        HStack(spacing: 13) {
            Image(systemName: "square.grid.3x3.fill").font(.system(size: 25)).foregroundStyle(mint)
            VStack(alignment: .leading, spacing: 3) {
                Text("Art sheets").font(.system(size: 22, weight: .semibold, design: .rounded))
                Text("Paint with spreadsheet cells.").font(.system(size: 11)).foregroundStyle(.secondary)
            }
            Spacer()
            Label("On your Mac", systemImage: "lock.shield").font(.system(size: 11)).foregroundStyle(.secondary)
            Button { model.addFolder() } label: { Label("Add folder", systemImage: "folder.badge.plus") }.disabled(model.busy)
            Button { model.addImages() } label: { Label("Add artwork", systemImage: "plus") }.disabled(model.busy)
        }
        .buttonStyle(.bordered).padding(.horizontal, 24).padding(.top, 30).padding(.bottom, 20)
    }
    private var sidebar: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack { Text("COLLECTION").tracking(1.8); Spacer(); Text("\(model.items.count)").monospacedDigit() }
                .font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary).padding(20)
            if model.items.isEmpty {
                VStack(alignment: .leading, spacing: 9) {
                    Text("Start with an image.").foregroundStyle(.primary)
                    Text("Or add a whole folder. Each artwork gets its own set of exports.").foregroundStyle(.secondary).lineSpacing(4)
                }.font(.system(size: 12)).padding(.horizontal, 20)
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: 5) {
                        ForEach(model.items) { item in
                            Button { model.selection = item.id } label: {
                                HStack(spacing: 10) {
                                    Thumbnail(url: item.url).frame(width: 42, height: 48).clipped().clipShape(RoundedRectangle(cornerRadius: 4))
                                    VStack(alignment: .leading, spacing: 5) {
                                        Text(item.url.deletingPathExtension().lastPathComponent).font(.system(size: 11, weight: .medium)).lineLimit(2).multilineTextAlignment(.leading)
                                        HStack(spacing: 4) {
                                            if item.output != nil { Image(systemName: "checkmark.circle.fill").foregroundStyle(mint) }
                                            Text(item.status)
                                        }.font(.system(size: 9)).foregroundStyle(item.error == nil ? Color.secondary : Color.orange)
                                    }
                                    Spacer(minLength: 0)
                                }
                                .padding(9).background(model.selected?.id == item.id ? mint.opacity(0.10) : Color.clear)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }.buttonStyle(.plain)
                        }
                    }.padding(.horizontal, 10)
                }
            }
            HStack {
                Button { model.removeSelected() } label: { Image(systemName: "minus") }.disabled(model.items.isEmpty || model.busy).help("Remove selected artwork from the collection")
                Spacer()
                if !model.items.isEmpty { Button("Clear") { model.items.removeAll(); model.selection = nil }.disabled(model.busy) }
            }.buttonStyle(.borderless).font(.system(size: 11)).foregroundStyle(.secondary).padding(20)
        }.background(Color.white.opacity(0.018))
    }
    private var preview: some View {
        VStack(spacing: 16) {
            HStack {
                Text(model.selected == nil ? "YOUR NEXT PIECE" : "ARTWORK").tracking(1.8).font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary)
                Spacer()
                if model.selected != nil {
                    Picker("Preview", selection: $model.showOutput) { Text("Reference").tag(false); Text("Cell painting").tag(true) }.pickerStyle(.segmented).labelsHidden().frame(width: 205)
                }
            }
            if model.selected != nil && model.showOutput {
                Picker("Painting stage", selection: $model.previewStage) {
                    Text("Underpainting").tag("Underpainting")
                    Text("Brushwork").tag("Brushwork")
                    Text("Painting").tag("Painting")
                }.pickerStyle(.segmented)
                Text("Each stage is an editable sheet in your workbook.")
                    .font(.system(size: 10)).foregroundStyle(.secondary)
            }
            if let selected = model.selected {
                GeometryReader { geo in
                    Group {
                        if !model.showOutput { ArtworkPreview(url:selected.url) }
                        else if let image=model.stageImages[model.previewStage] { Image(nsImage:image).resizable().interpolation(.none).scaledToFit() }
                        else if model.previewBusy { VStack(spacing:12) { ProgressView();Text("Laying down cell brushwork…").font(.system(size:12)).foregroundStyle(.secondary) } }
                        else { Text(model.previewDescription).font(.system(size:12)).foregroundStyle(.secondary) }
                    }
                        .frame(width: geo.size.width, height: geo.size.height)
                        .background(Color.black.opacity(0.35)).clipShape(RoundedRectangle(cornerRadius: 10))
                }
                VStack(spacing: 6) {
                    Text(selected.url.deletingPathExtension().lastPathComponent).font(.system(size: 14, weight: .medium)).lineLimit(2).multilineTextAlignment(.center)
                    if let error = selected.error { Text(error).font(.system(size: 11)).foregroundStyle(.orange).multilineTextAlignment(.center) }
                    else { Text(model.previewDescription).font(.system(size: 11)).foregroundStyle(.secondary) }
                }
            } else {
                Spacer(minLength: 0)
                ZStack {
                    RoundedRectangle(cornerRadius: 26).fill(mint.opacity(0.03)).frame(width: 230, height: 230)
                    PixelEmblem().frame(width: 150, height: 150)
                }
                VStack(spacing: 10) {
                    Text("Every cell, a brushstroke.").font(.system(size: 26, weight: .medium, design: .serif)).multilineTextAlignment(.center)
                    Text("Turn a reference into broad color regions,\ncell brushwork, and drawn contours.")
                        .font(.system(size: 12)).foregroundStyle(.secondary).multilineTextAlignment(.center).lineSpacing(5)
                }
                Button("Choose artwork…") { model.addImages() }.buttonStyle(.bordered).padding(.top, 4)
                Spacer(minLength: 0)
                Text("PNG  ·  JPEG  ·  HEIC  ·  TIFF  ·  and more").font(.system(size: 10)).foregroundStyle(.tertiary)
            }
        }.padding(24)
    }
    private func exportedPNG(_ item: ArtworkItem) -> URL? {
        guard let folder = item.output else { return nil }
        return folder.appendingPathComponent(ArtEngine.stem(item.url.deletingPathExtension().lastPathComponent)+".png")
    }
    private var settings: some View {
        ScrollView {
        VStack(alignment: .leading, spacing: 22) {
            Text("MAKE IT YOURS").tracking(1.8).font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary)
            VStack(alignment:.leading,spacing:9) {
                Text("Pigment palette").font(.system(size:13,weight:.medium))
                Picker("Pigment palette",selection:$model.paintColors) {Text("12 · Graphic").tag(12);Text("24 · Painterly").tag(24);Text("40 · Rich").tag(40)}.labelsHidden()
                Text("Brushwork").font(.system(size:13,weight:.medium))
                Picker("Brushwork",selection:$model.brushStrength) {Text("Fine").tag(1);Text("Bold").tag(2);Text("Broad").tag(3)}.pickerStyle(.segmented).labelsHidden()
            }
            VStack(alignment: .leading, spacing: 9) {
                Text("Cell detail").font(.system(size: 13, weight: .medium))
                Picker("Cell detail", selection: $model.detail) {
                    Text("160 · Broad cells").tag(160); Text("256 · Studio").tag(256); Text("384 · Fine cells").tag(384); Text("512 · Intricate").tag(512)
                }.labelsHidden()
                Text("Cells along the longest edge. Built in underpainting, brushwork, and contour passes.").font(.system(size: 11)).foregroundStyle(.secondary).lineSpacing(3).fixedSize(horizontal: false, vertical: true)
            }
            VStack(alignment: .leading, spacing: 9) {
                Text("PNG size").font(.system(size: 13, weight: .medium))
                Picker("PNG size", selection: $model.pngScale) { Text("1×").tag(1); Text("2×").tag(2); Text("4×").tag(4) }.pickerStyle(.segmented).labelsHidden()
                Text("Up to \(model.detail * model.pngScale) pixels on the longest edge.").font(.system(size: 11)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
            VStack(alignment: .leading, spacing: 9) {
                Text("Transparent areas").font(.system(size: 13, weight: .medium))
                Picker("Transparent areas", selection: $model.whiteMatte) { Text("Ink black").tag(false); Text("Paper white").tag(true) }.labelsHidden()
            }
            Divider().opacity(0.5)
            VStack(alignment: .leading, spacing: 12) {
                Text("THREE WAYS TO KEEP IT").tracking(1.4).font(.system(size: 9, weight: .semibold)).foregroundStyle(.secondary)
                formatRow("XLSX", "Painting + editable paint stages", "square.grid.3x3")
                formatRow("SVG", "Crisp vector cell geometry", "point.topleft.down.curvedto.point.bottomright.up")
                formatRow("PNG", "Ready to share or print", "photo")
            }
            Spacer(minLength: 0)
            VStack(alignment: .leading, spacing: 8) {
                Text("SAVE TO").tracking(1.5).font(.system(size: 9, weight: .semibold)).foregroundStyle(.secondary)
                Button { model.chooseDestination() } label: {
                    HStack { Image(systemName: "folder"); Text(model.destination?.lastPathComponent ?? "Choose a folder…").lineLimit(1); Spacer(); Image(systemName: "chevron.right").font(.system(size: 9)) }
                }.buttonStyle(.bordered).help(model.destination?.path ?? "Choose the export folder")
                Text("Each image gets a new folder. Existing exports are kept.").font(.system(size: 10)).foregroundStyle(.secondary).lineSpacing(3).fixedSize(horizontal: false, vertical: true)
            }
        }.padding(20).disabled(model.busy)
        }.background(Color.white.opacity(0.018))
    }
    private func formatRow(_ name: String, _ description: String, _ symbol: String) -> some View {
        HStack(spacing: 11) {
            Image(systemName: symbol).font(.system(size: 15)).foregroundStyle(mint).frame(width: 23)
            VStack(alignment: .leading, spacing: 3) { Text(name).font(.system(size: 11, weight: .semibold)); Text(description).font(.system(size: 10)).foregroundStyle(.secondary) }
        }
    }
    private var footer: some View {
        HStack(spacing: 20) {
            VStack(alignment: .leading, spacing: 7) {
                Text(model.stage).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(2)
                if model.busy { ProgressView(value: model.progress).progressViewStyle(.linear).frame(maxWidth: 400) }
            }
            if model.selected?.output != nil && !model.busy {
                Text("Numbers: use 25% zoom to see more of the painting.")
                    .font(.system(size: 10)).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true).frame(maxWidth: 190)
            }
            Spacer()
            if model.busy { Button("Cancel") { model.cancel() }.buttonStyle(.bordered) }
            else if model.selected?.output != nil {
                Button("Open workbook") { model.openWorkbook() }.buttonStyle(.bordered)
                Button("Show files") { model.reveal() }.buttonStyle(.bordered)
            }
            Button { model.start() } label: {
                HStack(spacing: 9) { Text(model.readyCount == 0 && !model.items.isEmpty ? "Export again" : model.readyCount > 1 ? "Export \(model.readyCount) artworks" : "Export artwork"); Image(systemName: "arrow.up.right") }
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.black.opacity(0.85)).padding(.horizontal, 18).padding(.vertical, 12)
                    .background(model.items.isEmpty || model.busy ? mint.opacity(0.25) : mint).clipShape(RoundedRectangle(cornerRadius: 8))
            }.buttonStyle(.plain).disabled(model.items.isEmpty || model.busy)
        }.padding(.horizontal, 24).padding(.vertical, 18)
    }
}

struct Thumbnail: View {
    let url: URL
    @State private var image: NSImage?
    var body: some View {
        Group { if let image { Image(nsImage: image).resizable().scaledToFill() } else { Rectangle().fill(Color.white.opacity(0.05)) } }
            .task(id: url) {
                image = nil
                let cg = await Task.detached(priority: .utility) {
                    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil as CGImage? }
                    return CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: 120] as CFDictionary)
                }.value
                image = cg.map { NSImage(cgImage: $0, size: .zero) }
            }
    }
}

struct ArtworkPreview: View {
    let url: URL
    @State private var image: NSImage?
    var body: some View {
        Group { if let image { Image(nsImage: image).resizable().interpolation(.none).scaledToFit() } else { ProgressView() } }
            .task(id: url) {
                image = nil
                let cg = await Task.detached(priority: .utility) {
                    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil as CGImage? }
                    return CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: 1600] as CFDictionary)
                }.value
                image = cg.map { NSImage(cgImage: $0, size: .zero) }
            }
    }
}

struct PixelEmblem: View {
    var body: some View {
        Canvas { context, size in
            let n = 11, step = size.width/CGFloat(n)
            for y in 0..<n { for x in 0..<n {
                let dx = Double(x-5), dy = Double(y-5), r = sqrt(dx*dx+dy*dy)
                let color: Color = r < 1.6 ? canvas : r < 2.8 ? mint : (r < 4.8 && (abs(dx)<1.5 || abs(dy)<1.5 || abs(abs(dx)-abs(dy))<1.2)) ? Color(red:0.80,green:0.89,blue:0.85) : mint.opacity(0.035)
                context.fill(Path(CGRect(x: CGFloat(x)*step, y:CGFloat(y)*step,width:step-2,height:step-2)),with:.color(color))
            }}
        }
    }
}
