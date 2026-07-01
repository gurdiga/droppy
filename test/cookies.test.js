"use strict";

require("./helpers.js"); // cookies.js loads db.js + utils.js, which bind paths
const {describe, test} = require("node:test");
const assert = require("node:assert/strict");

const cookies = require("../server/cookies.js");

describe("cookies.parse", () => {
  test("parses a cookie header into an object", () => {
    assert.deepEqual(cookies.parse("s=abc; foo=bar"), {s: "abc", foo: "bar"});
  });
  test("parses a single pair", () => {
    assert.deepEqual(cookies.parse("s=abc"), {s: "abc"});
  });
  test("returns an empty object for empty or non-string input", () => {
    assert.deepEqual(cookies.parse(""), {});
    assert.deepEqual(cookies.parse(undefined), {});
    assert.deepEqual(cookies.parse(null), {});
  });
});
