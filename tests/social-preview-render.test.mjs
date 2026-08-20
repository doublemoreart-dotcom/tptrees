import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, unlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const renderer = await readFile(new URL("../scripts/render-social-preview-png.sh", import.meta.url), "utf8");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

async function createFixture(t) {
  const root = await mkdtemp(join(tmpdir(), "tptrees-social-preview-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const scripts = join(root, "scripts");
  const publicDir = join(root, "public");
  const script = join(scripts, "render-social-preview-png.sh");
  const source = join(publicDir, "social-preview.svg");
  const target = join(publicDir, "social-preview.png");
  const fakeChrome = join(root, "fake-chrome.sh");
  const chromeLog = join(root, "fake-chrome.log");

  await mkdir(scripts, { recursive: true });
  await mkdir(publicDir, { recursive: true });
  await writeFile(script, renderer);
  await writeFile(source, "<svg>original</svg>\n");
  await writeFile(target, "original-png\n");
  await writeFile(chromeLog, "");
  await writeFile(fakeChrome, `#!/usr/bin/env bash
set -euo pipefail
target=""
for argument in "$@"; do
  case "$argument" in
    --screenshot=*) target="\${argument#--screenshot=}" ;;
  esac
done
[[ -n "$target" ]]
printf 'called\\n' >> "$FAKE_CHROME_LOG"
printf 'rendered-png\\n' > "$target"
`);
  await chmod(fakeChrome, 0o755);

  run("git", ["init", "-q"], { cwd: root });
  run("git", ["add", "scripts/render-social-preview-png.sh", "public/social-preview.svg", "public/social-preview.png"], { cwd: root });
  run("git", ["-c", "user.name=TP Trees Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture"], { cwd: root });

  return { root, script, source, target, fakeChrome, chromeLog };
}

function render(fixture) {
  return run("bash", [fixture.script], {
    cwd: fixture.root,
    env: {
      ...process.env,
      CHROME: fixture.fakeChrome,
      FAKE_CHROME_LOG: fixture.chromeLog,
    },
  });
}

test("fresh-checkout mtime inversion preserves a tracked PNG when the SVG content is unchanged", async (t) => {
  const fixture = await createFixture(t);
  const now = Date.now();
  await utimes(fixture.target, new Date(now - 20_000), new Date(now - 20_000));
  await utimes(fixture.source, new Date(now), new Date(now));

  const result = render(fixture);

  assert.match(result.stdout, /tracked SVG matches HEAD/);
  assert.equal(await readFile(fixture.target, "utf8"), "original-png\n");
  assert.equal(await readFile(fixture.chromeLog, "utf8"), "");
});

test("changed SVG content rebuilds the PNG even when the target mtime is newer", async (t) => {
  const fixture = await createFixture(t);
  const now = Date.now();
  await writeFile(fixture.source, "<svg>changed</svg>\n");
  await utimes(fixture.source, new Date(now - 20_000), new Date(now - 20_000));
  await utimes(fixture.target, new Date(now), new Date(now));

  const result = render(fixture);

  assert.match(result.stdout, /Rendered public\/social-preview\.png/);
  assert.equal(await readFile(fixture.target, "utf8"), "rendered-png\n");
  assert.equal(await readFile(fixture.chromeLog, "utf8"), "called\n");
});

test("a missing tracked PNG is rebuilt", async (t) => {
  const fixture = await createFixture(t);
  await unlink(fixture.target);

  render(fixture);

  assert.equal(await readFile(fixture.target, "utf8"), "rendered-png\n");
  assert.equal(await readFile(fixture.chromeLog, "utf8"), "called\n");
});
