import Foundation

public protocol DefaultsBackend {
  func read() -> String?
  func write(_ value: String)
  func clear()
  func applyChange()
}

public final class ScreenshotDirManager {
  private let backend: DefaultsBackend
  private let savedOriginal: () -> String?
  private let setSavedOriginal: (String?) -> Void
  private var hasSaved: Bool = false

  public init(backend: DefaultsBackend,
              savedOriginal: @escaping () -> String?,
              setSavedOriginal: @escaping (String?) -> Void) {
    self.backend = backend
    self.savedOriginal = savedOriginal
    self.setSavedOriginal = setSavedOriginal
  }

  /// The location the system currently saves screenshots to.
  /// nil means the key is unset, i.e. the system default (~/Desktop).
  public func currentLocation() -> String? { backend.read() }

  /// Whether two paths name the same directory. The system screenshot
  /// location can come back tilde-form, with a trailing slash, or with
  /// repeated slashes, so raw string comparison would report "not
  /// redirected" while syncing actually works.
  ///
  /// Case is deliberately NOT normalized. A case-insensitive compare would
  /// call two genuinely different directories equal on a case-sensitive
  /// volume, and this answer drives a "✓ syncing" claim — a false ✓ is worse
  /// than a false ✗, which the user can clear with one click on Redirect now.
  public static func isSameDirectory(_ a: String?, _ b: String) -> Bool {
    guard let a else { return false }
    return (a as NSString).standardizingPath == (b as NSString).standardizingPath
  }

  public func redirect(to folder: String) {
    if !hasSaved {
      // Capture only when nothing is stored yet. `hasSaved` alone is not
      // enough: it tracks this process, while the stored value outlives it, so
      // a second redirect in a later session (the help panel's "Redirect now")
      // would otherwise recapture and overwrite a good original with whatever
      // the location had drifted to.
      if savedOriginal() == nil {
        let current = backend.read()
        // Never record the destination as the "original" either — that makes
        // restore a permanent no-op. Happens when the app is killed rather
        // than quit (launchctl unload, reboot, crash), since that skips
        // restore and leaves the location at `folder`. nil means "was the
        // default", so restore clears the key instead.
        setSavedOriginal(Self.isSameDirectory(current, folder) ? nil : current)
      }
      hasSaved = true
    }
    // Write the new folder path and apply the change.
    backend.write(folder)
    backend.applyChange()
  }

  public func restore() {
    // Restore the saved original, or clear if it was nil (the default).
    if let original = savedOriginal() {
      backend.write(original)
    } else {
      backend.clear()
    }
    // Apply the change and clear the saved state.
    backend.applyChange()
    setSavedOriginal(nil)
    hasSaved = false
  }
}
