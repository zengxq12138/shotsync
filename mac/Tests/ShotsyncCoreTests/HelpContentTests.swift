import Testing
import Foundation
@testable import ShotsyncCore

@Suite struct HelpContentTests {
  private let expected = "/Users/me/Pictures/shotsync"

  private func health(location: String?, worker: String?) -> SyncHealth {
    SyncHealth(screenshotLocation: location, expectedLocation: expected, workerHost: worker)
  }

  // MARK: primaryAction

  @Test func allGreenOffersTheGallery() {
    let h = health(location: expected, worker: "shotsync.example.workers.dev")
    #expect(HelpContent.primaryAction(for: h) == .openGallery)
  }

  @Test func unconfiguredWorkerOffersSettings() {
    let h = health(location: expected, worker: nil)
    #expect(HelpContent.primaryAction(for: h) == .openSettings)
  }

  // Settings must win over Redirect: redirecting screenshots is pointless
  // while there is nowhere to upload them to.
  @Test func unconfiguredWorkerOutranksMissingRedirect() {
    let h = health(location: "/Users/me/Desktop", worker: nil)
    #expect(HelpContent.primaryAction(for: h) == .openSettings)
  }

  @Test func configuredButNotRedirectedOffersRedirect() {
    let h = health(location: "/Users/me/Desktop", worker: "shotsync.example.workers.dev")
    #expect(HelpContent.primaryAction(for: h) == .redirectNow)
  }

  // nil location means the system default (~/Desktop), i.e. not redirected.
  @Test func systemDefaultLocationCountsAsNotRedirected() {
    let h = health(location: nil, worker: "shotsync.example.workers.dev")
    #expect(HelpContent.primaryAction(for: h) == .redirectNow)
  }

  // MARK: body — shortcuts and steps

  @Test func bodyListsTheSystemScreenshotShortcuts() {
    let body = HelpContent.body(for: health(location: expected, worker: "h.example.com"))
    #expect(body.contains("⌘⇧3"))
    #expect(body.contains("⌘⇧4"))
    #expect(body.contains("⌘⇧5"))
  }

  @Test func bodyCarriesNoUploadCounts() {
    let body = HelpContent.body(for: health(location: expected, worker: "h.example.com"))
    #expect(!body.lowercased().contains("session"))
    #expect(!body.lowercased().contains("today"))
    #expect(!body.lowercased().contains("uploaded:"))
  }

  // MARK: body — status lines

  @Test func bodyMarksRedirectedLocationOK() {
    let body = HelpContent.body(for: health(location: expected, worker: "h.example.com"))
    #expect(body.contains("✓ /Users/me/Pictures/shotsync"))
    #expect(!body.contains("not redirected"))
  }

  @Test func bodyShowsActualLocationWhenNotRedirected() {
    let body = HelpContent.body(for: health(location: "/Users/me/Desktop", worker: "h.example.com"))
    #expect(body.contains("✗ /Users/me/Desktop"))
    #expect(body.contains("not redirected"))
  }

  @Test func bodyNamesTheSystemDefaultWhenLocationIsUnset() {
    let body = HelpContent.body(for: health(location: nil, worker: "h.example.com"))
    #expect(body.contains("system default"))
    #expect(body.contains("not redirected"))
  }

  @Test func bodyShowsWorkerHostWhenConfigured() {
    let body = HelpContent.body(for: health(location: expected, worker: "shotsync.example.workers.dev"))
    #expect(body.contains("✓ shotsync.example.workers.dev"))
  }

  @Test func bodyFlagsMissingWorker() {
    let body = HelpContent.body(for: health(location: expected, worker: nil))
    #expect(body.contains("✗ not configured"))
  }

  // Paths under the real home directory read better abbreviated.
  @Test func bodyAbbreviatesTheHomeDirectory() {
    let underHome = NSHomeDirectory() + "/Pictures/shotsync"
    let h = SyncHealth(screenshotLocation: underHome, expectedLocation: underHome, workerHost: "h.example.com")
    let body = HelpContent.body(for: h)
    #expect(body.contains("~/Pictures/shotsync"))
    #expect(!body.contains(NSHomeDirectory() + "/Pictures"))
  }

  // MARK: button order

  @Test func buttonOrderIsJustTheGalleryWhenHealthy() {
    let h = health(location: expected, worker: "shotsync.example.workers.dev")
    #expect(HelpContent.buttonOrder(for: h) == [.openGallery])
  }

  @Test func buttonOrderOffersTheGalleryAfterTheRedirectFix() {
    let h = health(location: "/Users/me/Desktop", worker: "shotsync.example.workers.dev")
    #expect(HelpContent.buttonOrder(for: h) == [.redirectNow, .openGallery])
  }

  // Nowhere to upload to means nowhere to browse either.
  @Test func buttonOrderOmitsTheGalleryWithoutAWorker() {
    let h = health(location: expected, worker: nil)
    #expect(HelpContent.buttonOrder(for: h) == [.openSettings])
  }

  // Pins the two APIs together: the panel's default button must be the same
  // action primaryAction names, whatever else the order gains later.
  @Test func buttonOrderLeadsWithThePrimaryAction() {
    for location in [expected, "/Users/me/Desktop", nil] {
      for worker in ["shotsync.example.workers.dev", nil] {
        let h = health(location: location, worker: worker)
        #expect(HelpContent.buttonOrder(for: h).first == HelpContent.primaryAction(for: h))
      }
    }
  }

  // MARK: menu lines

  @Test func menuLocationLineTicksTheRedirectedFolder() {
    let line = HelpContent.menuLocationLine(for: health(location: expected, worker: "h.example.com"))
    #expect(line == "Location: ✓ /Users/me/Pictures/shotsync")
  }

  @Test func menuLocationLineShowsWhereShotsActuallyGo() {
    let line = HelpContent.menuLocationLine(for: health(location: "/Users/me/Desktop", worker: "h.example.com"))
    #expect(line == "Location: ✗ /Users/me/Desktop")
  }

  @Test func menuLocationLineNamesTheSystemDefault() {
    let line = HelpContent.menuLocationLine(for: health(location: nil, worker: "h.example.com"))
    #expect(line == "Location: ✗ system default")
  }

  @Test func menuGalleryLineIsTheWorkerHost() {
    let line = HelpContent.menuGalleryLine(for: health(location: expected, worker: "shotsync.example.workers.dev"))
    #expect(line == "shotsync.example.workers.dev")
  }

  @Test func menuGalleryLineSaysNotConfiguredWithoutAWorker() {
    let line = HelpContent.menuGalleryLine(for: health(location: expected, worker: nil))
    #expect(line == "Not configured")
  }

  // MARK: button titles

  @Test func eachActionHasAButtonTitle() {
    #expect(HelpContent.buttonTitle(for: .openGallery) == "Open gallery")
    #expect(HelpContent.buttonTitle(for: .redirectNow) == "Redirect now")
    #expect(HelpContent.buttonTitle(for: .openSettings) == "Open settings…")
  }
}
