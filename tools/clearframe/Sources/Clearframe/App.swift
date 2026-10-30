import AVKit
import AppKit
import ClearframeCore
import SwiftUI
import UniformTypeIdentifiers

@main struct ClearframeApp: App {
  var body: some Scene {
    WindowGroup { ContentView().frame(minWidth: 1180, minHeight: 780) }.defaultSize(
      width: 1440, height: 920
    ).windowStyle(.hiddenTitleBar)
  }
}
enum Theme {
  static let ink = Color(red: 0.016, green: 0.027, blue: 0.055)
  static let panel = Color(red: 0.035, green: 0.055, blue: 0.095)
  static let cyan = Color(red: 0.12, green: 0.83, blue: 0.98)
  static let cobalt = Color(red: 0.16, green: 0.38, blue: 1)
  static let line = Color.white.opacity(0.075)
  static var icon: NSImage? {
    Bundle.main.url(forResource: "Clearframe-Icon-v2", withExtension: "png").flatMap {
      NSImage(contentsOf: $0)
    }
  }
}
struct BrandIcon: View {
  var size: CGFloat = 44
  var body: some View {
    Group {
      if let image = Theme.icon {
        Image(nsImage: image).resizable().interpolation(.high)
      } else {
        Image(systemName: "viewfinder").resizable().foregroundStyle(Theme.cyan)
      }
    }.frame(width: size, height: size)
  }
}
struct ContentView: View {
  @StateObject private var studio = Studio()
  @State private var section = "Studio"
  @State private var recipeName = ""
  @State private var saveRecipe = false
  @State private var dropping = false
  var body: some View {
    VStack(spacing: 0) {
      header
      Rectangle().fill(Theme.line).frame(height: 1)
      HStack(spacing: 0) {
        sidebar
        if section == "Text" {
          TextWorkspace().frame(maxWidth: .infinity)
        } else {
          workspace
          Rectangle().fill(Theme.line).frame(width: 1)
          inspector
        }
      }
      footer
    }.background(Theme.ink).preferredColorScheme(.dark).tint(Theme.cyan)
      .onChange(of: studio.settings) { studio.invalidate() }
      .onChange(of: studio.previewTime) { studio.invalidate() }
      .onReceive(NotificationCenter.default.publisher(for: NSApplication.willTerminateNotification))
    { _ in
      studio.cancel()
      studio.cleanup()
    }
      .alert(
        "Clearframe",
        isPresented: Binding(get: { studio.error != nil }, set: { if !$0 { studio.error = nil } })
      ) {
        Button("OK") { studio.error = nil }
      } message: {
        Text(studio.error ?? "")
      }
      .sheet(isPresented: $saveRecipe) {
        VStack(alignment: .leading, spacing: 20) {
          Text("Save a finishing recipe").font(.title2)
          Text(
            "Stores grain, dither, trim and export settings. Repair regions stay with each file."
          ).foregroundStyle(.secondary)
          TextField("Recipe name", text: $recipeName).textFieldStyle(.roundedBorder)
          HStack {
            Button("Cancel") { saveRecipe = false }
            Spacer()
            Button("Save recipe") {
              studio.saveRecipe(recipeName)
              recipeName = ""
              saveRecipe = false
            }.disabled(recipeName.trimmingCharacters(in: .whitespaces).isEmpty)
          }
        }.padding(28).frame(width: 440)
      }
  }
  var header: some View {
    HStack(spacing: 12) {
      BrandIcon()
      VStack(alignment: .leading, spacing: 2) {
        Text("CLEARFRAME").font(.system(size: 17, weight: .bold, design: .rounded)).tracking(2)
        Text("THE LOCAL FINISHING STUDIO").font(
          .system(size: 9, weight: .medium, design: .monospaced)
        ).tracking(1.6).foregroundStyle(.secondary)
      }
      Spacer()
      Label("ON YOUR MAC", systemImage: "lock.shield").font(
        .system(size: 10, weight: .semibold, design: .monospaced)
      ).foregroundStyle(Theme.cyan).padding(.horizontal, 12).padding(.vertical, 7).background(
        Theme.cyan.opacity(0.07), in: Capsule())
      Button {
        studio.choose()
      } label: {
        Label("Add files", systemImage: "plus")
      }.keyboardShortcut("o").buttonStyle(.bordered).disabled(studio.busy)
      Button {
        studio.export(all: true)
      } label: {
        Label("Export batch", systemImage: "square.and.arrow.up")
      }.keyboardShortcut("e", modifiers: [.command, .shift]).buttonStyle(.borderedProminent).tint(
        Theme.cobalt
      ).disabled(studio.busy || !studio.items.contains { $0.thumbnail != nil })
    }.padding(.horizontal, 24).padding(.top, 18).padding(.bottom, 16)
  }
  var sidebar: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 6) {
        ForEach(["Studio", "Text"], id: \.self) { name in
          Button {
            section = name
          } label: {
            Text(name).font(.system(size: 12, weight: .semibold)).frame(maxWidth: .infinity)
              .padding(.vertical, 9).background(
                section == name ? Theme.cobalt.opacity(0.23) : .clear,
                in: RoundedRectangle(cornerRadius: 8))
          }.buttonStyle(.plain)
        }
      }.padding(14)
      HStack {
        Text("MEDIA QUEUE").font(.system(size: 10, weight: .semibold, design: .monospaced))
          .tracking(1.2)
        Spacer()
        Text("\(studio.items.count)").font(.caption.monospacedDigit()).foregroundStyle(Theme.cyan)
      }.foregroundStyle(.secondary).padding(.horizontal, 18).padding(.vertical, 12)
      ScrollView {
        LazyVStack(spacing: 7) {
          ForEach(studio.items) { item in
            Button {
              studio.select(item.id)
              section = "Studio"
            } label: {
              HStack(spacing: 10) {
                ZStack {
                  RoundedRectangle(cornerRadius: 7).fill(.black.opacity(0.3))
                  if let img = item.thumbnail {
                    Image(nsImage: img).resizable().scaledToFill()
                  } else {
                    Image(systemName: "exclamationmark.triangle").foregroundStyle(.orange)
                  }
                }.frame(width: 46, height: 46).clipShape(RoundedRectangle(cornerRadius: 7))
                VStack(alignment: .leading, spacing: 5) {
                  Text(item.url.lastPathComponent).font(.system(size: 11, weight: .medium))
                    .lineLimit(1)
                  HStack(spacing: 5) {
                    Circle().fill(
                      item.state == "Done" ? .green : item.failure != nil ? .orange : Theme.cyan
                    ).frame(width: 4, height: 4)
                    Text(item.state).font(.system(size: 10))
                    if !item.regions.isEmpty {
                      Text("· \(item.regions.count) masks").font(.system(size: 9))
                    }
                  }
                }.foregroundStyle(.secondary)
              }.padding(9).frame(maxWidth: .infinity, alignment: .leading).background(
                studio.selection == item.id ? Theme.cobalt.opacity(0.16) : .clear,
                in: RoundedRectangle(cornerRadius: 10)
              ).overlay(
                RoundedRectangle(cornerRadius: 10).stroke(
                  studio.selection == item.id ? Theme.cobalt.opacity(0.5) : .clear))
            }.buttonStyle(.plain).disabled(studio.busy).help(item.failure ?? item.url.path)
          }
        }.padding(.horizontal, 9)
      }
      if studio.items.isEmpty {
        VStack(alignment: .leading, spacing: 8) {
          Image(systemName: "square.stack").font(.title2).foregroundStyle(Theme.cyan.opacity(0.5))
          Text("One file or a whole collection.").font(.caption)
          Text("Drop files into the canvas to build your queue.").font(.caption).foregroundStyle(
            .secondary)
        }.padding(18)
      }
      Spacer(minLength: 0)
      HStack {
        Button("Remove", systemImage: "minus.circle") { studio.removeSelected() }.disabled(
          studio.busy || studio.selection == nil)
        Spacer()
        Button {
          studio.items = []
          studio.selection = nil
          studio.original = nil
          studio.preview = nil
        } label: {
          Image(systemName: "trash")
        }.help("Clear queue; source files are kept.").disabled(studio.busy || studio.items.isEmpty)
      }.font(.caption).buttonStyle(.plain).foregroundStyle(.secondary).padding(18)
      VStack(alignment: .leading, spacing: 5) {
        Text("IMPERMANENT VISION").font(.system(size: 8, weight: .medium, design: .monospaced))
          .tracking(1.4)
        Text("A new finish. The original, untouched.").font(.system(size: 10))
      }.foregroundStyle(.secondary).padding(18)
    }.frame(width: 220).background(Theme.panel.opacity(0.6)).overlay(alignment: .trailing) {
      Rectangle().fill(Theme.line).frame(width: 1)
    }
  }
  var workspace: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 5) {
          Text(studio.selected?.url.lastPathComponent ?? "Make something unmistakable.").font(
            .system(size: 22, weight: .semibold)
          ).lineLimit(1)
          Text(
            studio.selected.map {
              "\($0.width) × \($0.height)   /   \($0.url.pathExtension.uppercased())"
            } ?? "Repair. Texture. Reduce. Refine."
          ).font(.system(size: 10, design: .monospaced)).tracking(1).foregroundStyle(.secondary)
        }
        Spacer()
      }
      HStack(spacing: 10) {
        Button {
          studio.drawRegion.toggle()
        } label: {
          Label("Repair mask", systemImage: "viewfinder")
        }.buttonStyle(.bordered).tint(studio.drawRegion ? Theme.cyan : .gray).disabled(
          studio.selected == nil || studio.busy)
        if studio.draft != nil { Button("Add mask") { studio.commitRegion() } }
        Spacer()
        Picker("View", selection: $studio.showOriginal) {
          Text("Original").tag(true)
          Text("Finished").tag(false)
        }.pickerStyle(.segmented).labelsHidden().frame(width: 160).disabled(studio.preview == nil)
      }.font(.caption)
      ZStack {
        RoundedRectangle(cornerRadius: 16).fill(.black.opacity(0.32))
        if let image = studio.showOriginal ? studio.original : (studio.preview ?? studio.original) {
          RegionCanvas(
            image: image, regions: studio.selected?.regions ?? [], draft: $studio.draft,
            enabled: studio.drawRegion && !studio.busy
          ).padding(16)
          VStack {
            Spacer()
            HStack {
              Text(studio.preview == nil || studio.showOriginal ? "ORIGINAL" : "FINISHED PREVIEW")
                .font(.system(size: 9, weight: .medium, design: .monospaced)).tracking(1).padding(8)
                .background(.black.opacity(0.65), in: Capsule())
              Spacer()
            }.padding(20)
          }.allowsHitTesting(false)
        } else {
          VStack(spacing: 20) {
            BrandIcon(size: 140).shadow(color: Theme.cobalt.opacity(0.2), radius: 35)
            VStack(spacing: 8) {
              Text("Bring your work into focus.").font(.system(size: 24, weight: .medium))
              Text(
                "Drop images, videos and GIFs here.\nEvery file gets a fresh, non-destructive finish."
              ).multilineTextAlignment(.center).font(.system(size: 13)).foregroundStyle(.secondary)
            }
            Button("Choose files…") { studio.choose() }.buttonStyle(.borderedProminent).tint(
              Theme.cobalt)
          }.padding(25)
        }
        if dropping {
          RoundedRectangle(cornerRadius: 16).stroke(Theme.cyan, lineWidth: 2).background(
            Theme.cyan.opacity(0.05))
        }
      }.frame(maxWidth: .infinity, maxHeight: .infinity).overlay(
        RoundedRectangle(cornerRadius: 16).stroke(Theme.line)
      )
      .onDrop(of: [.fileURL], isTargeted: $dropping) { providers in
        guard !studio.busy else { return false }
        Task {
          var urls: [URL] = []
          for provider in providers {
            let url: URL? = await withCheckedContinuation { continuation in
              _ = provider.loadObject(ofClass: URL.self) { url, _ in
                continuation.resume(returning: url)
              }
            }
            if let url { urls.append(url) }
          }
          studio.add(urls)
        }
        return true
      }
      if studio.drawRegion {
        Text(
          "Drag to draw a fixed region, then Add mask. Regions are per file; use “Apply masks to batch” for matching layouts."
        ).font(.caption).foregroundStyle(Theme.cyan)
      }
      if let item = studio.selected, item.duration > 0 {
        HStack {
          Image(systemName: "film").foregroundStyle(.secondary)
          Slider(
            value: $studio.previewTime,
            in: 0...max(0.01, item.duration - studio.settings.start - 0.05))
          Text(String(format: "%.1fs", studio.previewTime)).font(.caption.monospacedDigit()).frame(
            width: 46)
          Button("Motion preview") { studio.makePreview(animated: true) }.disabled(studio.busy)
        }.font(.caption).disabled(studio.busy)
      }
      if let player = studio.player {
        VideoPlayer(player: player).frame(height: 160).clipShape(RoundedRectangle(cornerRadius: 10))
      }
      if let message = studio.selected?.failure {
        Text(message).font(.caption).foregroundStyle(.orange).lineLimit(4).textSelection(.enabled)
      }
      HStack {
        if let output = studio.selected?.output {
          Button("Reveal export", systemImage: "folder") {
            NSWorkspace.shared.activateFileViewerSelecting([output])
          }
        }
        Spacer()
        Button("Preview finish", systemImage: "sparkles") { studio.makePreview() }.keyboardShortcut(
          "p", modifiers: [.command]
        ).disabled(studio.busy || studio.selected?.thumbnail == nil)
        Button("Export selected…") { studio.export(all: false) }.buttonStyle(.borderedProminent)
          .tint(Theme.cobalt).disabled(studio.busy || studio.selected?.thumbnail == nil)
      }
    }.padding(24)
  }
  var inspector: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 22) {
        HStack {
          Text("FINISHING RECIPE").font(.system(size: 10, weight: .semibold, design: .monospaced))
            .tracking(1.3)
          Spacer()
          Button {
            saveRecipe = true
          } label: {
            Image(systemName: "square.and.arrow.down")
          }.buttonStyle(.plain).help("Save current settings")
        }.foregroundStyle(.secondary)
        Menu {
          ForEach(FinishSettings.presets, id: \.self) { p in
            Button(p) { studio.settings = FinishSettings.preset(p) }
          }
          if !studio.recipes.isEmpty {
            Divider()
            ForEach(studio.recipes) { r in Button(r.name) { studio.settings = r.settings } }
            Menu("Delete saved recipe") {
              ForEach(studio.recipes) { r in
                Button(r.name, role: .destructive) { studio.removeRecipe(r.id) }
              }
            }
          }
        } label: {
          HStack {
            Image(systemName: "slider.horizontal.3")
            Text("Choose a recipe")
            Spacer()
            Image(systemName: "chevron.down").font(.caption2)
          }.padding(11).background(
            Theme.cobalt.opacity(0.12), in: RoundedRectangle(cornerRadius: 9))
        }.menuStyle(.borderlessButton)
        inspectorSection("01", "Repair & privacy", "viewfinder") {
          Toggle("Remove source metadata", isOn: $studio.settings.strip)
          Text("Source tags and chapters are removed. Technical encoder tags may remain.").font(
            .system(size: 10)
          ).foregroundStyle(.secondary)
          HStack {
            Text("\(studio.selected?.regions.count ?? 0) fixed masks").foregroundStyle(.secondary)
            Spacer()
            Button("Clear") { studio.clearRegions() }.disabled(
              studio.selected?.regions.isEmpty ?? true)
          }
          Button("Apply masks to batch") { studio.copyRegions() }.disabled(
            studio.selected?.regions.isEmpty ?? true)
        }
        inspectorSection("02", "Grain & noise", "aqi.medium") {
          slider("Strength", value: $studio.settings.noise, range: 0...40, suffix: "%")
          Toggle("Animate each frame", isOn: $studio.settings.animatedNoise)
          Toggle("Color noise", isOn: $studio.settings.colorNoise)
          Toggle("Uniform distribution", isOn: $studio.settings.uniformNoise)
          HStack {
            Text("Seed").foregroundStyle(.secondary)
            TextField("Seed", value: $studio.settings.seed, format: .number).textFieldStyle(
              .roundedBorder
            ).frame(width: 75)
            Spacer()
            Button {
              studio.settings.seed = Int.random(in: 1...999999)
            } label: {
              Image(systemName: "dice")
            }.help("New random seed")
          }
          Text(
            "Try 3–8% for subtle texture. Higher values make an intentional grain effect and can increase file size."
          ).font(.system(size: 10)).foregroundStyle(.secondary)
        }
        inspectorSection("03", "Dither lab", "circle.lefthalf.filled") {
          Picker("Algorithm", selection: $studio.settings.dither) {
            ForEach(DitherAlgorithm.allCases, id: \.self) { Text($0.rawValue).tag($0) }
          }.labelsHidden()
          Text(studio.settings.dither.hint).font(.system(size: 10)).foregroundStyle(.secondary)
          if studio.settings.dither != .off {
            Picker("Palette", selection: $studio.settings.palette) {
              ForEach(DitherPalette.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            slider("Ordered spread", value: $studio.settings.spread, range: 0...255, suffix: "")
            Text(
              "Fixed palettes keep colors consistent across frames. Dithered animation uses the frame rate below."
            ).font(.system(size: 10)).foregroundStyle(.secondary)
          }
        }
        inspectorSection("04", "Output", "square.and.arrow.up") {
          Picker("Format", selection: $studio.settings.format) {
            ForEach(["Auto", "PNG", "JPG", "MP4", "GIF"], id: \.self) { Text($0).tag($0) }
          }
          Picker("Long edge", selection: $studio.settings.maxEdge) {
            Text("Original").tag(0)
            ForEach([480, 720, 960, 1280, 1920, 2560], id: \.self) { Text("\($0) px").tag($0) }
          }
          Picker("Dither FPS", selection: $studio.settings.fps) {
            ForEach([10, 12, 15, 24, 25, 30, 60], id: \.self) { Text("\($0)").tag($0) }
          }
          Picker("MP4 quality", selection: $studio.settings.crf) {
            Text("High · CRF 18").tag(18)
            Text("Balanced · CRF 23").tag(23)
            Text("Small · CRF 28").tag(28)
          }
          Toggle("Mute audio", isOn: $studio.settings.mute)
          HStack {
            Text("Start (s)")
            Spacer()
            TextField("0", value: $studio.settings.start, format: .number).textFieldStyle(
              .roundedBorder
            ).frame(width: 75)
          }
          HStack {
            Text("Length (s)")
            Spacer()
            TextField("0", value: $studio.settings.duration, format: .number).textFieldStyle(
              .roundedBorder
            ).frame(width: 75)
          }
          Text(
            "Length 0 = to end. PNG/JPG exports one frame. Auto keeps the media type. Settings apply to the whole batch."
          ).font(.system(size: 10)).foregroundStyle(.secondary)
        }
        Button("Reset all settings") { studio.settings = FinishSettings() }.font(.caption)
          .foregroundStyle(.secondary)
        Text(
          "Visible repairs blend nearby pixels. Invisible watermarks and AI detector outcomes are not verified."
        ).font(.system(size: 9)).foregroundStyle(.secondary)
      }.font(.system(size: 11)).padding(20).disabled(studio.busy)
    }.frame(width: 280).background(Theme.panel.opacity(0.6))
  }
  func inspectorSection<Content: View>(
    _ n: String, _ title: String, _ icon: String, @ViewBuilder content: () -> Content
  ) -> some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Text(n).font(.system(size: 9, design: .monospaced)).foregroundStyle(Theme.cyan)
        Text(title).font(.system(size: 13, weight: .semibold))
        Spacer()
        Image(systemName: icon).foregroundStyle(.secondary)
      }
      content()
      Rectangle().fill(Theme.line).frame(height: 1).padding(.top, 7)
    }
  }
  func slider(_ title: String, value: Binding<Double>, range: ClosedRange<Double>, suffix: String)
    -> some View
  {
    VStack(spacing: 5) {
      HStack {
        Text(title)
        Spacer()
        Text("\(Int(value.wrappedValue))\(suffix)").monospacedDigit().foregroundStyle(Theme.cyan)
      }
      Slider(value: value, in: range)
    }
  }
  var footer: some View {
    HStack(spacing: 12) {
      Circle().fill(studio.busy ? Theme.cyan : .green).frame(width: 5, height: 5)
      Text(studio.status).lineLimit(1)
      if studio.frames > 0 {
        Text("\(studio.frames) frames").monospacedDigit().foregroundStyle(Theme.cyan)
      }
      Spacer()
      if studio.busy {
        ProgressView().controlSize(.small)
        if studio.total > 0 { Text("\(studio.completed) / \(studio.total)").monospacedDigit() }
        Button("Cancel") { studio.cancel() }
      } else {
        Text("CLEARFRAME 0.2  /  MLOW").font(.system(size: 9, design: .monospaced)).tracking(1)
      }
    }.font(.caption).foregroundStyle(.secondary).padding(.horizontal, 24).padding(.vertical, 12)
      .background(Theme.panel).overlay(alignment: .top) {
        Rectangle().fill(Theme.line).frame(height: 1)
      }
  }
}
struct RegionCanvas: View {
  let image: NSImage
  let regions: [RepairRegion]
  @Binding var draft: RepairRegion?
  let enabled: Bool
  var body: some View {
    GeometryReader { geo in
      let aspect = image.size.width / image.size.height
      let w = min(geo.size.width, geo.size.height * aspect)
      let h = w / aspect
      ZStack(alignment: .topLeading) {
        Image(nsImage: image).resizable().interpolation(.none).frame(width: w, height: h)
        if enabled {
          ForEach(Array(regions.enumerated()), id: \.offset) { index, r in
            mask(r, w: w, h: h, label: String(index + 1))
          }
          if let draft { mask(draft, w: w, h: h, label: "+") }
        }
      }.frame(width: w, height: h).contentShape(Rectangle()).gesture(
        DragGesture(minimumDistance: 3).onChanged { v in
          guard enabled else { return }
          let x1 = max(0, min(w, v.startLocation.x))
          let y1 = max(0, min(h, v.startLocation.y))
          let x2 = max(0, min(w, v.location.x))
          let y2 = max(0, min(h, v.location.y))
          draft = RepairRegion(
            x: min(x1, x2) / w, y: min(y1, y2) / h, width: abs(x2 - x1) / w,
            height: abs(y2 - y1) / h)
        }
      ).position(x: geo.size.width / 2, y: geo.size.height / 2)
    }
  }
  func mask(_ r: RepairRegion, w: Double, h: Double, label: String) -> some View {
    Rectangle().fill(Theme.cyan.opacity(0.12)).overlay(
      Rectangle().stroke(Theme.cyan, style: StrokeStyle(lineWidth: 1.5, dash: [5, 3]))
    ).overlay(alignment: .topLeading) {
      Text(label).font(.system(size: 9, weight: .bold, design: .monospaced)).padding(3).background(
        Theme.cyan
      ).foregroundStyle(.black)
    }.frame(width: r.width * w, height: r.height * h).offset(x: r.x * w, y: r.y * h)
      .allowsHitTesting(false)
  }
}
