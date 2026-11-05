import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { publishStaticAssets, PUBLIC_ASSET_PREFIX } from "./publish-static-assets";
import { CLIENT_ROUTES, verifyStaticExport } from "./verify-static-export";

describe("static export assets", () => {
  it("publishes CSS, JS, and fonts beside the Harbor and Mesa client routes", () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "cml-export-"));
    fs.mkdirSync(path.join(outDir, "_next/static/chunks"), { recursive: true });
    fs.mkdirSync(path.join(outDir, "_next/static/media"), { recursive: true });
    fs.writeFileSync(path.join(outDir, "_next/static/chunks/app.js"), 'const base="/_next/";\n');
    fs.writeFileSync(
      path.join(outDir, "_next/static/chunks/app.css"),
      '@font-face{src:url(../media/font.woff2)format("woff2")}',
    );
    fs.writeFileSync(path.join(outDir, "_next/static/media/font.woff2"), "woff");

    const home = [
      '<link rel="stylesheet" href="/_next/static/chunks/app.css"/>',
      '<script src="/_next/static/chunks/app.js"></script>',
      '<link rel="preload" href="/_next/static/media/font.woff2" as="font"/>',
      ...CLIENT_ROUTES.map(
        (route) => `<a href="${route.href}">${route.name.replaceAll("&", "&amp;")}</a>`,
      ),
    ].join("");
    fs.writeFileSync(path.join(outDir, "index.html"), home);
    for (const route of CLIENT_ROUTES) {
      fs.mkdirSync(path.dirname(path.join(outDir, route.html)), { recursive: true });
      fs.writeFileSync(path.join(outDir, route.html), `<h1>${route.name}</h1>`);
      fs.writeFileSync(path.join(outDir, route.flight), `1:"/_next/static/chunks/app.js"\n`);
    }

    publishStaticAssets(outDir);
    verifyStaticExport(outDir);

    const publishedJs = fs.readFileSync(path.join(outDir, "next-assets/static/chunks/app.js"), "utf8");
    assert.equal(publishedJs.includes(PUBLIC_ASSET_PREFIX), true);
    assert.equal(fs.existsSync(path.join(outDir, "_next")), false);
    assert.equal(
      fs.existsSync(path.join(outDir, "next-assets/static/media/font.woff2")),
      true,
    );
  });

});
