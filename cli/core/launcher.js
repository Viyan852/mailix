/**
 * MAILIX Launcher Generator
 *
 * Generates platform-native launcher executables that reference
 * assets/icon.ico.
 *
 * IMPORTANT: launcher generation is TARGET-AWARE, not host-aware.
 * The caller passes the target platform explicitly. We do NOT inspect
 * the build host's OS — building a Windows release on a Linux CI
 * runner must still produce genuine Windows launchers.
 */

const fs = require('fs');
const path = require('path');
const { isWindows: hostIsWindows } = require('./platform');
const { validateIcon, runtimeIconPath } = require('./icon');

const LAUNCHER_TARGETS = ['mlx', 'mlx-install', 'mlx-run'];

/**
 * Returns true if the given target identifier is a Windows target.
 * Recognised forms: windows-x64, windows-arm64, win-x64, win32-x64, etc.
 */
function isWindowsTarget(target) {
  if (!target) return false;
  const t = String(target).toLowerCase();
  return t.startsWith('windows-') || t.startsWith('win-') || t.startsWith('win32-');
}

function isPosixTarget(target) {
  if (!target) return false;
  const t = String(target).toLowerCase();
  return t.startsWith('linux-') || t.startsWith('macos-') || t.startsWith('darwin-');
}

/**
 * Determine the binary extension for the target.
 * Windows: .exe; otherwise: empty.
 */
function targetExeExtension(target) {
  return isWindowsTarget(target) ? '.exe' : '';
}

/**
 * Determine the Node executable name for the target.
 * Windows: node.exe; otherwise: node.
 */
function targetNodeExe(target) {
  return isWindowsTarget(target) ? 'node.exe' : 'node';
}

/**
 * Write the launcher artifacts for the specified TARGET.
 *
 * @param {string} binDir  Directory to write launchers into
 * @param {string} appDir  MAILIX application root
 * @param {object} [opts]
 * @param {string} [opts.target]  Target platform identifier (e.g. 'windows-x64').
 *                                If omitted, falls back to the build host's OS.
 * @param {string} [opts.iconPath]   Override the icon path
 * @param {string} [opts.bundledNode] Path to bundled node (Windows only, for .exe production)
 */
function writeLaunchers(binDir, appDir, opts = {}) {
  if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });

  // Resolve the target. If none is provided, fall back to the build host.
  // This keeps the API convenient for local development while remaining
  // deterministic for cross-platform builds.
  const target = opts.target || (hostIsWindows() ? 'windows-x64' : 'linux-x64');

  const iconPath = opts.iconPath || runtimeIconPath(appDir);

  for (const targetName of LAUNCHER_TARGETS) {
    if (isWindowsTarget(target)) {
      writeWindowsLauncher(binDir, targetName, appDir, { iconPath, bundledNode: opts.bundledNode, target });
    } else if (isPosixTarget(target)) {
      writePosixLauncher(binDir, targetName, appDir, { iconPath, target });
    } else {
      throw new Error(`Unknown release target: ${target}`);
    }
  }
}

function writeWindowsLauncher(binDir, target, appDir, { iconPath, bundledNode, target: targetPlatform }) {
  // If we have a real bundled node.exe and a real icon, produce a real .exe.
  if (bundledNode && fs.existsSync(bundledNode) && iconPath && fs.existsSync(iconPath)) {
    try {
      const { buildWindowsLauncher } = require('./icon-builder');
      buildWindowsLauncher({
        iconPath,
        bundledNodeExe: bundledNode,
        outDir: binDir,
        appDir,
        scriptRelPath: `cli/bin/${target}.js`,
        label: target,
      });
      return;
    } catch (err) {
      // Fall through to .cmd shim
      console.warn(`Launcher .exe build failed for ${target}: ${err.message}`);
    }
  }

  // Fallback: .cmd shim that calls the bundled node.exe. The .exe build
  // requires rcedit; this fallback is what the build pipeline uses when
  // rcedit is unavailable. The shim still references the bundled runtime
  // and the icon — it does not use system Node.
  const cmd = `@echo off
setlocal
set "MAILIX_HOME=${appDir}"
set "MAILIX_ICON=${iconPath}"
"%MAILIX_HOME%\\runtime\\node.exe" "%MAILIX_HOME%\\app\\cli\\bin\\${target}.js" %*
exit /b %ERRORLEVEL%
`;
  fs.writeFileSync(path.join(binDir, `${target}.cmd`), cmd);
}

function writePosixLauncher(binDir, target, appDir, { iconPath, target: targetPlatform }) {
  const sh = `#!/bin/sh
# MAILIX launcher
MAILIX_HOME="${appDir}"
export MAILIX_ICON="${iconPath}"
exec "$MAILIX_HOME/runtime/node" "$MAILIX_HOME/app/cli/bin/${target}.js" "$@"
`;
  const dest = path.join(binDir, target);
  fs.writeFileSync(dest, sh);
  fs.chmodSync(dest, 0o755);
}

module.exports = {
  writeLaunchers,
  LAUNCHER_TARGETS,
  isWindowsTarget,
  isPosixTarget,
  targetExeExtension,
  targetNodeExe,
};
