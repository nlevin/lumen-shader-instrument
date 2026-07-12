import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the LUMEN shader instrument", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>LUMEN — Shader Instrument<\/title>/i);
  assert.match(html, /LUMEN/);
  assert.match(html, /SHADER INSTRUMENT/);
  assert.match(html, /Interactive procedural shader canvas/);
  assert.match(html, /Mutate/);
  assert.match(html, /Export/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships the shader engine, creative controls, and bespoke share card", async () => {
  const [studio, shader, page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/ShaderStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/shader.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(studio, /getContext\("webgl2"/);
  assert.match(studio, /readPixels/);
  assert.match(studio, /Fragment shader source/);
  assert.match(studio, /navigator\.clipboard/);
  assert.match(shader, /uniform float uWarp/);
  assert.match(shader, /float voronoi/);
  assert.match(shader, /float fbm/);
  assert.match(page, /LUMEN — Shader Instrument/);
  assert.match(layout, /\/og\.png/);
  assert.match(packageJson, /"name": "lumen-shader-instrument"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
});
