import Foundation

/// A snapshot of everything the help panel reports on. Deliberately holds no
/// upload counts — the panel answers "is this wired up correctly", not "how
/// much did it move".
public struct SyncHealth: Equatable {
  /// Where the system currently saves screenshots (nil = system default).
  public let screenshotLocation: String?
  /// Where shotsync watches for new screenshots.
  public let expectedLocation: String
  /// Host of the configured Worker (nil = not configured yet).
  public let workerHost: String?

  public init(screenshotLocation: String?, expectedLocation: String, workerHost: String?) {
    self.screenshotLocation = screenshotLocation
    self.expectedLocation = expectedLocation
    self.workerHost = workerHost
  }

  public var isRedirected: Bool {
    ScreenshotDirManager.isSameDirectory(screenshotLocation, expectedLocation)
  }

  public var hasWorker: Bool { workerHost != nil }
}

/// What the panel's primary button should do, given the current health.
public enum HelpAction: Equatable {
  case openGallery
  case redirectNow
  case openSettings
}

/// Text and button decisions for the menu-bar help panel. Pure so it can be
/// tested; the AppKit layer only renders what it returns.
public enum HelpContent {
  public static let title = "shotsync — How it works"
  public static let subtitle = "Screenshots use the system shortcuts. shotsync handles the rest."

  /// The panel's action buttons in the order they are shown, so the AppKit
  /// layer can map a button index straight back onto an action instead of
  /// hand-keeping a parallel switch. Never empty. The renderer appends its own
  /// dismiss button after these.
  ///
  /// Settings outranks Redirect: redirecting screenshots is pointless while
  /// there is nowhere to upload them to — and so is browsing, hence no gallery
  /// button in that state.
  public static func buttonOrder(for health: SyncHealth) -> [HelpAction] {
    if !health.hasWorker { return [.openSettings] }
    if !health.isRedirected { return [.redirectNow, .openGallery] }
    return [.openGallery]
  }

  /// The default button. Always the head of `buttonOrder`.
  public static func primaryAction(for health: SyncHealth) -> HelpAction {
    buttonOrder(for: health).first ?? .openGallery
  }

  public static func buttonTitle(for action: HelpAction) -> String {
    switch action {
    case .openGallery: return "Open gallery"
    case .redirectNow: return "Redirect now"
    case .openSettings: return "Open settings…"
    }
  }

  /// The panel's body. Rendered in a monospaced font, so the columns line up.
  public static func body(for health: SyncHealth) -> String {
    """
        ⌘⇧3    whole screen
        ⌘⇧4    drag a selection
        ⌘⇧5    capture panel / screen recording

        1.  Shots land in \(display(health.expectedLocation))
        2.  shotsync sends each new one automatically
        3.  Open the gallery on any device to grab them

        \(locationLine(health))
        \(workerLine(health))
    """
  }

  /// Compact form of the location status, for the menu itself.
  public static func menuLocationLine(for health: SyncHealth) -> String {
    let state = locationState(health)
    return "Location: \(state.ok ? "✓" : "✗") \(state.text)"
  }

  /// Title of the menu item that opens the gallery.
  public static func menuGalleryLine(for health: SyncHealth) -> String {
    health.workerHost ?? "Not configured"
  }

  /// The screenshot location is in one of three states: pointed at the folder
  /// we watch, pointed somewhere else, or never set (the system default).
  private static func locationState(_ health: SyncHealth) -> (ok: Bool, text: String) {
    if health.isRedirected { return (true, display(health.expectedLocation)) }
    guard let actual = health.screenshotLocation else { return (false, "system default") }
    return (false, display(actual))
  }

  private static func locationLine(_ health: SyncHealth) -> String {
    let state = locationState(health)
    let mark = state.ok ? "✓" : "✗"
    let suffix = state.ok ? "" : " — not redirected"
    return "\(padded("Screenshot location")) \(mark) \(state.text)\(suffix)"
  }

  private static func workerLine(_ health: SyncHealth) -> String {
    let label = padded("Worker")
    guard let host = health.workerHost else { return "\(label) ✗ not configured" }
    return "\(label) ✓ \(host)"
  }

  /// Pads status labels to a fixed width so the marks line up under each other
  /// in the monospaced panel.
  private static func padded(_ label: String) -> String {
    label.padding(toLength: 21, withPad: " ", startingAt: 0)
  }

  private static func display(_ path: String) -> String {
    (path as NSString).abbreviatingWithTildeInPath
  }
}
