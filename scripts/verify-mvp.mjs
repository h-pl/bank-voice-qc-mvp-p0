import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const indicators = read("lib/official-indicators.ts").match(
  /id: ['"]6\.[23]\.\d+['"]/g,
);
assert.equal(indicators.length, 16, "完整指标目录必须为 16 项");
const pkg = JSON.parse(read("package.json"));
assert.ok(
  pkg.scripts.dev.endsWith("-p 6001") && pkg.scripts.start.endsWith("-p 6001"),
  "使用独立 6001 端口",
);
for (const file of [
  "app/globals.css",
  "public/audio/privacy-demo.m4a",
  "docs/reviews/PRD-银行语音质检-MVP-P0.md",
  "docs/reviews/实现与验收记录-MVP-P0.md",
])
  assert.ok(fs.statSync(path.join(root, file)).size > 100, `${file} 不能为空`);
const prd = read("docs/reviews/PRD-银行语音质检-MVP-P0.md");
assert.ok(prd.includes("D01—D05") && prd.includes("已采纳"));
assert.ok(!prd.includes("当前新目录包含早期四页面工作稿"));
for (const file of fs
  .readdirSync(path.join(root, "docs/reviews/流程图"))
  .filter((x) => x.endsWith(".mmd")))
  assert.ok(!read("docs/reviews/流程图/" + file).includes("待确认"));
const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--test", "scripts/workflow.test.mjs", "scripts/refinement.test.mjs", "scripts/lifecycle.test.mjs", "scripts/report-visuals.test.mjs", "scripts/resource-publication.test.mjs"],
  { cwd: root, stdio: "inherit" },
);
assert.equal(result.status, 0, "工作流回归必须通过");
console.log(
  "MVP-P0 verification passed: port, indicator catalog, core artifacts and workflow invariants.",
);
