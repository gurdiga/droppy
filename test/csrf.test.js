"use strict";

require("./helpers.js");
const {describe, test} = require("node:test");
const assert = require("node:assert/strict");

const csrf = require("../server/csrf.js");

describe("csrf", () => {
  test("create returns a 32-char hex token that validates", () => {
    const token = csrf.create();
    assert.match(token, /^[0-9a-f]{32}$/);
    assert.equal(csrf.validate(token), true);
  });

  test("rejects unknown tokens", () => {
    assert.equal(csrf.validate("not-a-real-token"), false);
  });

  test("retains at most 500 tokens (oldest evicted)", () => {
    const first = csrf.create();
    for (let i = 0; i < 500; i++) csrf.create(); // pushes `first` past the 500-token window
    assert.equal(csrf.validate(first), false);
  });
});
