"use strict";

require("./helpers.js"); // cfg.js binds the config file path at load
const {describe, test} = require("node:test");
const assert = require("node:assert/strict");

const cfg = require("../server/cfg.js");

function init(config) {
  return new Promise((resolve, reject) => {
    cfg.init(config, (err, merged) => (err ? reject(err) : resolve(merged)));
  });
}

describe("cfg.init (object input)", () => {
  test("merges supplied values over defaults", async () => {
    const config = await init({public: true});
    assert.equal(config.public, true);     // overridden
    assert.equal(config.linkLength, 5);    // default preserved
    assert.equal(config.maxFileSize, 0);   // default preserved
    assert.deepEqual(config.listeners, [
      {host: ["0.0.0.0", "::"], port: 8989, protocol: "http"},
    ]);
  });

  // The object branch returns early, before the file branch's validation and
  // unknown-key pruning. Documented here so the coverage boundary is explicit:
  // pruning/validation need a seeded-file (Tier 2) test, not this path.
  test("does not prune unknown keys", async () => {
    const config = await init({nope: 123});
    assert.equal(config.nope, 123);
  });
});
