import AppKit
import ClearframeCore
import SwiftUI
import UniformTypeIdentifiers

struct TextWorkspace: View {
  @State private var source = ""
  @State private var result = ""
  @State private var edits: [TextEdit] = []
  @State private var simplify = true
  @State private var spacing = true
  @State private var note = ""
  @State private var previous = ""
  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      Text("The text finishing desk.").font(.system(size: 28, weight: .semibold))
      Text("Conservative, reviewable edits for wordy phrasing and invisible spacing.")
        .foregroundStyle(.secondary)
      HStack {
        Toggle("Simplify stock phrases", isOn: $simplify)
        Toggle("Clean invisible spacing", isOn: $spacing)
        Spacer()
        Button("Import .txt…") {
          let p = NSOpenPanel()
          p.allowedContentTypes = [.plainText]
          if p.runModal() == .OK, let u = p.url {
            do { source = try String(contentsOf: u, encoding: .utf8) } catch {
              note = error.localizedDescription
            }
          }
        }
      }
      HStack(spacing: 16) {
        VStack(alignment: .leading) {
          Text("ORIGINAL · \(source.split { $0.isWhitespace }.count) WORDS").font(.caption)
            .foregroundStyle(.secondary)
          TextEditor(text: $source).font(.system(size: 15)).padding(8).background(
            .black.opacity(0.15)
          ).clipShape(RoundedRectangle(cornerRadius: 12))
        }
        VStack(alignment: .leading) {
          Text("EDITABLE RESULT · \(result.split { $0.isWhitespace }.count) WORDS").font(.caption)
            .foregroundStyle(Theme.cyan)
          TextEditor(text: $result).font(.system(size: 15)).padding(8).background(
            .black.opacity(0.15)
          ).clipShape(RoundedRectangle(cornerRadius: 12))
        }
      }
      HStack {
        Button("Clean up text") {
          previous = result
          let cleaned = TextCleaner.clean(source, simplify: simplify, punctuation: spacing)
          result = cleaned.0
          edits = cleaned.1
          note =
            edits.isEmpty ? "No matching phrases found." : "Review edits before using your text."
        }.buttonStyle(.borderedProminent).tint(Theme.cyan).disabled(source.isEmpty)
        Text(note).font(.caption).foregroundStyle(.secondary)
        Spacer()
        Button("Undo edit") { swap(&result, &previous) }.disabled(previous.isEmpty)
        Button("Copy result") {
          NSPasteboard.general.clearContents()
          NSPasteboard.general.setString(result, forType: .string)
          note = "Copied."
        }.disabled(result.isEmpty)
        Button("Save .txt…") {
          let p = NSSavePanel()
          p.allowedContentTypes = [.plainText]
          p.nameFieldStringValue = "cleaned.txt"
          if p.runModal() == .OK, let u = p.url {
            do {
              try result.write(to: u, atomically: true, encoding: .utf8)
              note = "Saved."
            } catch { note = error.localizedDescription }
          }
        }.disabled(result.isEmpty)
      }
      ScrollView {
        VStack(alignment: .leading, spacing: 7) {
          ForEach(edits) { e in
            HStack {
              Text(e.from).strikethrough().foregroundStyle(.secondary)
              Image(systemName: "arrow.right")
              Text(e.to.isEmpty ? "Removed" : e.to).foregroundStyle(Theme.cyan)
              Spacer()
              Text("×\(e.count)")
            }.font(.caption)
          }
        }
      }.frame(height: 110)
      HStack {
        Button("Batch clean .txt files…") { batchText() }
        Text("Uses the selected cleanup options. Writes new UTF-8 files.").font(.caption)
          .foregroundStyle(.secondary)
      }
      Text(
        "This is a transparent editing tool, not an AI detector. It cannot establish authorship or guarantee detector results."
      ).font(.caption).foregroundStyle(.secondary)
    }.padding(28)
  }
  func batchText() {
    let picker = NSOpenPanel()
    picker.allowedContentTypes = [.plainText]
    picker.allowsMultipleSelection = true
    guard picker.runModal() == .OK else { return }
    let files = picker.urls
    let folder = NSOpenPanel()
    folder.canChooseDirectories = true
    folder.canChooseFiles = false
    folder.prompt = "Export cleaned text"
    guard folder.runModal() == .OK, let destination = folder.url else { return }
    var done = 0
    var failures: [String] = []
    for file in files {
      do {
        let text = try String(contentsOf: file, encoding: .utf8)
        let output = TextCleaner.clean(text, simplify: simplify, punctuation: spacing).0
        let url = Pipeline.uniqueURL(
          folder: destination, name: file.deletingPathExtension().lastPathComponent + "-clean",
          ext: "txt")
        try output.write(to: url, atomically: true, encoding: .utf8)
        done += 1
      } catch { failures.append(file.lastPathComponent) }
    }
    note =
      "Saved \(done) / \(files.count) text files."
      + (failures.isEmpty ? "" : " Failed: " + failures.joined(separator: ", "))
  }
}
