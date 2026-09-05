import Testing
import Foundation
@testable import ShotsyncCore

final class FakeBackend: DefaultsBackend {
  var current: String?
  var applied = 0
  func read() -> String? { current }
  func write(_ value: String) { current = value }
  func clear() { current = nil }
  func applyChange() { applied += 1 }
}

@Suite struct ScreenshotDirTests {
  @Test func redirectSavesOriginalOnce() {
    let be = FakeBackend(); be.current = "/Users/me/Desktop"
    var saved: String?? = nil // outer optional = "has been set"
    let mgr = ScreenshotDirManager(
      backend: be,
      savedOriginal: { saved ?? nil },
      setSavedOriginal: { saved = .some($0) })

    mgr.redirect(to: "/Users/me/Pictures/shotsync")
    #expect(be.current == "/Users/me/Pictures/shotsync")
    #expect((saved ?? nil) == "/Users/me/Desktop") // original captured
    #expect(be.applied == 1)

    // second redirect must NOT overwrite the saved original
    be.current = "/Users/me/Pictures/shotsync"
    mgr.redirect(to: "/Users/me/Pictures/other")
    #expect((saved ?? nil) == "/Users/me/Desktop")
  }

  @Test func restoreWritesBackOriginalAndClears() {
    let be = FakeBackend(); be.current = "/Users/me/Pictures/shotsync"
    var saved: String?? = .some("/Users/me/Desktop")
    let mgr = ScreenshotDirManager(
      backend: be,
      savedOriginal: { saved ?? nil },
      setSavedOriginal: { saved = .some($0) })

    mgr.restore()
    #expect(be.current == "/Users/me/Desktop")
    #expect((saved ?? nil) == nil)            // saved cleared after restore
    #expect(be.applied == 1)
  }

  @Test func restoreWithDefaultOriginalClearsBackend() {
    let be = FakeBackend(); be.current = "/Users/me/Pictures/shotsync"
    var saved: String?? = .some(nil)      // original WAS the default (no explicit value)
    let mgr = ScreenshotDirManager(
      backend: be,
      savedOriginal: { saved ?? nil },
      setSavedOriginal: { saved = .some($0) })

    mgr.restore()
    #expect(be.current == nil)            // cleared back to default
    #expect(be.applied == 1)
  }

  // Being killed (launchctl unload, reboot, crash) skips restore, so the
  // location stays pointed at the shotsync folder. On the next launch redirect
  // must NOT record that as the "original": doing so makes restore a no-op and
  // loses the real location permanently.
  @Test func redirectRefusesToRecordItsOwnDestinationAsOriginal() {
    let be = FakeBackend(); be.current = "/Users/me/Pictures/shotsync"
    var saved: String?? = nil
    let mgr = ScreenshotDirManager(
      backend: be,
      savedOriginal: { saved ?? nil },
      setSavedOriginal: { saved = .some($0) })

    mgr.redirect(to: "/Users/me/Pictures/shotsync")

    #expect(saved != nil)             // it was written...
    #expect((saved ?? nil) == nil)    // ...as "was the system default"
  }

  // The help panel's "Redirect now" calls redirect() directly, without the
  // "have we captured yet" gate that guards the launch-time prompt. If the
  // location drifted away from the shotsync folder by any route other than our
  // own restore(), that click must not clobber an original we already hold —
  // hasSaved only tracks the current process, so this IS its first capture.
  @Test func redirectKeepsAnOriginalCapturedInAnEarlierSession() {
    let be = FakeBackend(); be.current = "/Users/me/SomewhereElse"
    var saved: String?? = .some("/Users/me/Desktop")
    let mgr = ScreenshotDirManager(
      backend: be,
      savedOriginal: { saved ?? nil },
      setSavedOriginal: { saved = .some($0) })

    mgr.redirect(to: "/Users/me/Pictures/shotsync")

    #expect((saved ?? nil) == "/Users/me/Desktop")   // real original survives
    #expect(be.current == "/Users/me/Pictures/shotsync")
  }

  // Same protection when the two paths name one directory in different shapes.
  @Test func redirectRefusesItsDestinationInAnotherPathShape() {
    let be = FakeBackend(); be.current = "/Users/me/Pictures/shotsync/"
    var saved: String?? = nil
    let mgr = ScreenshotDirManager(
      backend: be,
      savedOriginal: { saved ?? nil },
      setSavedOriginal: { saved = .some($0) })

    mgr.redirect(to: "/Users/me/Pictures/shotsync")

    #expect((saved ?? nil) == nil)
  }

  @Test func currentLocationReadsThroughToTheBackend() {
    let be = FakeBackend()
    let mgr = ScreenshotDirManager(backend: be, savedOriginal: { nil }, setSavedOriginal: { _ in })

    #expect(mgr.currentLocation() == nil)   // unset means the system default
    be.current = "/Users/me/Pictures/shotsync"
    #expect(mgr.currentLocation() == "/Users/me/Pictures/shotsync")
  }

  // The system screenshot location can come back in shapes that differ
  // textually but name the same directory. Comparing raw strings would
  // report "not redirected" while syncing works fine.
  @Test func isSameDirectoryIgnoresTrailingSlashes() {
    #expect(ScreenshotDirManager.isSameDirectory("/Users/me/Pictures/shotsync/",
                                                 "/Users/me/Pictures/shotsync"))
  }

  @Test func isSameDirectoryIgnoresRepeatedSlashes() {
    #expect(ScreenshotDirManager.isSameDirectory("/Users/me//Pictures/shotsync",
                                                 "/Users/me/Pictures/shotsync"))
  }

  @Test func isSameDirectoryExpandsTilde() {
    #expect(ScreenshotDirManager.isSameDirectory("~/Pictures/shotsync",
                                                 NSHomeDirectory() + "/Pictures/shotsync"))
  }

  @Test func isSameDirectoryRejectsDifferentDirectories() {
    #expect(!ScreenshotDirManager.isSameDirectory("/Users/me/Desktop",
                                                  "/Users/me/Pictures/shotsync"))
  }

  // A nil left side means the location was never set (system default),
  // which is never the same as an explicit folder.
  @Test func isSameDirectoryTreatsNilAsNoMatch() {
    #expect(!ScreenshotDirManager.isSameDirectory(nil, "/Users/me/Pictures/shotsync"))
  }
}
