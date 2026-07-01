"use strict";

// Test support shared by all test files.
//
// IMPORTANT: several server modules bind paths as load-time constants
// (utils.js, db.js, cfg.js all call `require("./paths.js").get()` at module
// load). Re-seeding after they are required has no effect. So this module
// seeds paths to a throwaway temp root *on require*, and every test file must
// require it before requiring any server module. The Node test runner executes
// each test file in its own process, so the seeded singleton stays isolated
// per file. (The runner also picks this file up on its own — anything under
// test/ matches the default glob — and runs it as a no-op suite with 0 tests.)

const fs = require("fs");
const os = require("os");
const path = require("path");

const paths = require("../server/paths.js");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "droppy-test-"));
const configDir = path.join(root, "config");
const filesDir = path.join(root, "files");
fs.mkdirSync(configDir, {recursive: true});
fs.mkdirSync(filesDir, {recursive: true});
paths.seed(configDir, filesDir);

// A unique temp subdirectory under the seeded root, for a single test.
function tmpdir(prefix = "case-") {
  return fs.mkdtempSync(path.join(root, prefix));
}

process.on("exit", () => {
  try {
    fs.rmSync(root, {recursive: true, force: true});
  } catch {}
});

module.exports = {root, configDir, filesDir, tmpdir};
