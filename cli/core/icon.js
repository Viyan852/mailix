/**
 * MAILIX Icon Module
 *
 * Single source of truth: assets/icon.ico
 *
 * - Validates the icon file exists during the release build.
 * - Provides the icon path to:
 *     - The Windows launcher .exe builder (postject / rcedit)
 *     - The Windows shortcut generator (.lnk files via PowerShell)
 *     - The Start Menu / Add/Remove Programs registration
 *     - The installer banner
 *
 * The icon is NEVER auto-generated. If the file is missing, the build fails
 * with a clear error. The user must supply assets/icon.ico.
 */

const fs = require('fs');
const path = require('path');
const { isWindows } = require('./platform');

const ICON_RELATIVE_PATH = ['assets', 'icon.ico'];
const ICON_FILENAME = 'icon.ico';

/**
 * Returns the absolute path to the canonical icon file.
 * The path is resolved relative to the repository root, regardless of CWD.
 */
function iconPath(repoRoot) {
  const root = repoRoot || path.resolve(__dirname, '..', '..');
  return path.join(root, ...ICON_RELATIVE_PATH);
}

/**
 * Validates that the icon exists and is non-empty. Returns the resolved
 * path on success, or throws with a clear error message on failure.
 */
function validateIcon(repoRoot) {
  const p = iconPath(repoRoot);
  if (!fs.existsSync(p)) {
    const err = new Error(`MAILIX icon missing:\n${p}`);
    err.code = 'ICON_MISSING';
    throw err;
  }
  const stat = fs.statSync(p);
  if (!stat.isFile() || stat.size === 0) {
    const err = new Error(`MAILIX icon is empty or not a file:\n${p}`);
    err.code = 'ICON_INVALID';
    throw err;
  }
  // Verify it has the ICO magic number
  const fd = fs.openSync(p, 'r');
  const buf = Buffer.alloc(8);
  fs.readSync(fd, buf, 0, 8, 0);
  fs.closeSync(fd);
  // ICO files start with: 00 00 01 00 (reserved, type=icon)
  if (buf[0] !== 0 || buf[1] !== 0 || buf[2] !== 0x01 || buf[3] !== 0x00) {
    const err = new Error(`MAILIX icon is not a valid .ico file:\n${p}\nExpected ICO magic bytes 00 00 01 00`);
    err.code = 'ICON_INVALID';
    throw err;
  }
  return p;
}

/**
 * Returns icon metadata — useful for diagnostics.
 */
function inspect(repoRoot) {
  const p = iconPath(repoRoot);
  if (!fs.existsSync(p)) return { exists: false, path: p };
  const stat = fs.statSync(p);
  return {
    exists: true,
    path: p,
    size: stat.size,
  };
}

/**
 * For the launchers: the build script calls this to obtain a path that
 * the launcher knows about. The release zip places the icon at:
 *   <app>/assets/icon.ico
 * so launchers can resolve it at runtime by walking up from their location.
 */
function runtimeIconPath(installAppDir) {
  return path.join(installAppDir, ...ICON_RELATIVE_PATH);
}

module.exports = {
  ICON_RELATIVE_PATH,
  ICON_FILENAME,
  iconPath,
  validateIcon,
  inspect,
  runtimeIconPath,
};
