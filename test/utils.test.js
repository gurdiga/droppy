"use strict";

const {tmpdir} = require("./helpers.js"); // seeds paths before utils binds them
const {describe, test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const utils = require("../server/utils.js");
const realFiles = require("../server/paths.js").get().files;

// The path-traversal guard. These cases lock in the behaviour the recent
// security fixes depend on (validation in the /!/type/ and /!/zip/ handlers,
// and in validatePaths for every mutating WebSocket message).
describe("isPathSane (URL mode)", () => {
  const sane = ["/", "/foo/bar", "/a/b.txt", "/foo%20bar", "/a-b_c.d~e", "/a/..b"];
  for (const p of sane) {
    test(`accepts ${JSON.stringify(p)}`, () => {
      assert.equal(utils.isPathSane(p, true), true);
    });
  }

  const traversal = ["..", "../x", "/..", "/../etc/passwd", "/foo/../bar", "/foo/.."];
  for (const p of traversal) {
    test(`rejects traversal ${JSON.stringify(p)}`, () => {
      assert.equal(utils.isPathSane(p, true), false);
    });
  }

  const badChars = ["/foo bar", "/foo\\bar", "/foo<bar", "/foo\u0000bar"];
  for (const p of badChars) {
    test(`rejects invalid char ${JSON.stringify(p)}`, () => {
      assert.equal(utils.isPathSane(p, true), false);
    });
  }
});

describe("isPathSane (filename mode)", () => {
  const sane = ["foo", "foo/bar", "/foo/bar", "a/b/c.txt", "foo bar", "foo/"];
  for (const p of sane) {
    test(`accepts ${JSON.stringify(p)}`, () => {
      assert.equal(utils.isPathSane(p), true);
    });
  }

  const insane = ["foo/../bar", "../x", "..", ".", "foo/.", "foo\u0000bar", "con", "a/con/b"];
  for (const p of insane) {
    test(`rejects ${JSON.stringify(p)}`, () => {
      assert.equal(utils.isPathSane(p), false);
    });
  }
});

describe("normalizePath", () => {
  test("collapses backslashes and slash runs to single slash", () => {
    assert.equal(utils.normalizePath("a\\b"), "a/b");
    assert.equal(utils.normalizePath("a//b"), "a/b");
    assert.equal(utils.normalizePath("a\\\\b//c"), "a/b/c");
  });
  test("also collapses pipe characters (documented quirk)", () => {
    assert.equal(utils.normalizePath("a|b"), "a/b");
  });
});

describe("addFilesPath / removeFilesPath", () => {
  test("root maps to the files dir and back", () => {
    assert.equal(utils.addFilesPath("/"), realFiles);
    assert.equal(utils.removeFilesPath(realFiles), "/");
  });
  test("round-trips a nested path", () => {
    assert.equal(utils.removeFilesPath(utils.addFilesPath("/foo/bar")), "/foo/bar");
  });
});

describe("sanitizePathsInString", () => {
  test("strips the absolute files dir", () => {
    assert.equal(utils.sanitizePathsInString(`${realFiles}/secret`), "/secret");
  });
  test("tolerates falsy input", () => {
    assert.equal(utils.sanitizePathsInString(null), "");
  });
});

describe("addUploadTempExt / removeUploadTempExt", () => {
  test("tags the root segment only", () => {
    assert.equal(utils.addUploadTempExt("/foo/bar"), "/foo.droppy-upload/bar");
    assert.equal(utils.addUploadTempExt("foo/bar"), "foo.droppy-upload/bar");
  });
  test("round-trips", () => {
    assert.equal(utils.removeUploadTempExt(utils.addUploadTempExt("/foo/bar")), "/foo/bar");
    assert.equal(utils.removeUploadTempExt(utils.addUploadTempExt("foo/bar")), "foo/bar");
  });
});

describe("rootname", () => {
  test("returns first non-empty segment", () => {
    assert.equal(utils.rootname("/foo/bar"), "foo");
    assert.equal(utils.rootname("foo/bar"), "foo");
  });
  test("returns undefined for root", () => {
    assert.equal(utils.rootname("/"), undefined);
  });
});

describe("formatBytes", () => {
  const cases = [
    [0, "0 B"],
    [1, "1.00 B"],
    [1000, "1.00 kB"],
    [1500, "1.50 kB"],
    [1234567, "1.23 MB"],
  ];
  for (const [input, expected] of cases) {
    test(`${input} -> ${expected}`, () => {
      assert.equal(utils.formatBytes(input), expected);
    });
  }
});

describe("naturalSort", () => {
  test("orders numeric suffixes numerically", () => {
    assert.deepEqual(["file10", "file2", "file1"].sort(utils.naturalSort), ["file1", "file2", "file10"]);
    assert.deepEqual(["img12", "img1", "img2"].sort(utils.naturalSort), ["img1", "img2", "img12"]);
  });
  test("falls back to lexical order", () => {
    assert.deepEqual(["b", "a", "c"].sort(utils.naturalSort), ["a", "b", "c"]);
  });
});

describe("countOccurences", () => {
  test("counts non-overlapping occurrences", () => {
    assert.equal(utils.countOccurences("a/b/c", "/"), 2);
    assert.equal(utils.countOccurences("a/b/c/", "/"), 3);
    assert.equal(utils.countOccurences("aaaa", "aa"), 2);
    assert.equal(utils.countOccurences("abc", "x"), 0);
  });
});

describe("extensionRe", () => {
  test("matches listed extensions case-insensitively, anchored", () => {
    const re = utils.extensionRe(["jpg", "png"]);
    assert.equal(re.test("a.JPG"), true);
    assert.equal(re.test("a.png"), true);
    assert.equal(re.test("a.gif"), false);
    assert.equal(re.test("a.jpg.txt"), false);
  });
  test("escapes regex metacharacters in extensions", () => {
    const re = utils.extensionRe(["c++"]);
    assert.equal(re.test("file.c++"), true);
    assert.equal(re.test("filexcxx"), false);
  });
});

describe("arrify", () => {
  test("wraps non-arrays", () => {
    assert.deepEqual(utils.arrify(5), [5]);
    assert.deepEqual(utils.arrify("x"), ["x"]);
  });
  test("passes arrays through", () => {
    const arr = [1, 2];
    assert.equal(utils.arrify(arr), arr);
  });
});

describe("getLink", () => {
  const linkChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";
  test("returns a string of the requested length from the link alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const link = utils.getLink({}, 5);
      assert.equal(link.length, 5);
      assert.ok([...link].every(c => linkChars.includes(c)), `unexpected char in ${link}`);
    }
  });
});

describe("getDispo", () => {
  test("attachment vs inline", () => {
    assert.equal(utils.getDispo("/a/b/file.txt", true), 'attachment; filename="file.txt"');
    assert.equal(utils.getDispo("/a/b/file.txt", false), 'inline; filename="file.txt"');
  });
});

describe("contentType", () => {
  test("appends charset for text types", () => {
    assert.equal(utils.contentType("a.txt"), "text/plain; charset=UTF-8");
    assert.equal(utils.contentType("a.html"), "text/html; charset=UTF-8");
  });
  test("omits charset for binary types", () => {
    assert.equal(utils.contentType("a.png"), "image/png");
  });
  test("applies the matroska override", () => {
    assert.equal(utils.contentType("a.mkv"), "video/webm");
  });
});

describe("ip / port", () => {
  test("ip prefers x-forwarded-for, first hop", () => {
    assert.equal(utils.ip({headers: {"x-forwarded-for": "1.2.3.4, 5.6.7.8"}}), "1.2.3.4");
  });
  test("ip falls back to x-real-ip then connection", () => {
    assert.equal(utils.ip({headers: {"x-real-ip": "9.9.9.9"}}), "9.9.9.9");
    assert.equal(utils.ip({headers: {}, connection: {remoteAddress: "127.0.0.1"}}), "127.0.0.1");
  });
  test("port prefers x-real-port then connection", () => {
    assert.equal(utils.port({headers: {"x-real-port": "8080"}}), "8080");
    assert.equal(utils.port({headers: {}, connection: {remotePort: 1234}}), 1234);
  });
});

// image-size dispatches on magic bytes, so its ICNS parser is reachable through
// any of droppy's image extensions. In 0.8.3 that parser looped forever on a
// zero-length entry (CVE-2025-71330); 2.0.4 rejects it, and utils keeps its own
// guard in front. Either rejection satisfies the assertion below. Should both
// ever fail, this suite hangs rather than fails: the loop was synchronous, so
// node:test's own timeout timer never got a turn.
describe("imageDimensions", () => {
  test("reads the dimensions of an image", async () => {
    const p = path.join(tmpdir(), "real.png");
    fs.writeFileSync(p, png(3, 7));
    const dims = await dimensions(p);
    assert.equal(dims.width, 3);
    assert.equal(dims.height, 7);
  });

  test("refuses ICNS bytes whatever the file is named", async () => {
    const p = path.join(tmpdir(), "photo.png");
    fs.writeFileSync(p, icnsWithZeroLengthEntry());
    await assert.rejects(dimensions(p), /ICNS/);
  });

  function dimensions(p) {
    return new Promise((resolve, reject) => {
      utils.imageDimensions(p, (err, dims) => (err ? reject(err) : resolve(dims)));
    });
  }

  function png(width, height) {
    const buf = Buffer.alloc(24);
    buf.write("\x89PNG\r\n\x1a\n", 0, "binary");
    buf.writeUInt32BE(13, 8); // IHDR chunk length
    buf.write("IHDR", 12, "ascii");
    buf.writeUInt32BE(width, 16);
    buf.writeUInt32BE(height, 20);
    return buf;
  }

  function icnsWithZeroLengthEntry() {
    const buf = Buffer.alloc(64);
    buf.write("icns", 0, "ascii");
    buf.writeUInt32BE(buf.length, 4);
    buf.write("ic08", 8, "ascii"); // entry type
    buf.writeUInt32BE(0, 12);      // entry length — the payload
    return buf;
  }
});
