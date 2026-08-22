import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import security from "../desktop/security.cjs";

test("desktop shell trusts only the packaged Living Field origin", () => {
  assert.equal(security.isTrustedAppUrl("living-field://app/"), true);
  assert.equal(security.isTrustedAppUrl("living-field://other/"), false);
  assert.equal(security.isTrustedAppUrl("https://app/"), false);
  assert.equal(security.isTrustedAppUrl("not a url"), false);
});

test("desktop asset resolver keeps requests inside the packaged bundle", () => {
  const root = path.resolve("dist", "client");
  assert.equal(security.resolveBundlePath(root, "living-field://app/"), path.join(root, "index.html"));
  assert.equal(security.resolveBundlePath(root, "living-field://app/assets/main.js"), path.join(root, "assets", "main.js"));
  assert.equal(security.resolveBundlePath(root, "living-field://other/assets/main.js"), null);
  assert.equal(security.resolveBundlePath(root, "living-field://app/%5c..%5csecret.txt"), null);
});

