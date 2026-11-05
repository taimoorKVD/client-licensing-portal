import fs from "node:fs";
import path from "node:path";
import { BLOCKED_ASSET_PREFIX, PUBLIC_ASSET_DIR, PUBLIC_ASSET_PREFIX } from "./publish-static-assets";

export const CLIENT_ROUTES = [
  {
    name: "Harbor & Pine Pharmacy",
    href: "/organizations/org_harbor/",
    html: "organizations/org_harbor/index.html",
    flight: "organizations/org_harbor/index.txt",
  },
  {
    name: "Mesa Verde Rx",
    href: "/organizations/org_mesa/",
    html: "organizations/org_mesa/index.html",
    flight: "organizations/org_mesa/index.txt",
  },
] as const;

const TEXT_EXTENSIONS = new Set([".html", ".txt", ".js", ".css", ".json", ".map", ".svg"]);

export function verifyStaticExport(outDir: string): void {
  const problems: string[] = [];

  if (fs.existsSync(path.join(outDir, "_next"))) {
    problems.push("out/_next still exists. Hostinger denies that directory, so the asset tree was not published.");
  }
  if (!fs.existsSync(path.join(outDir, PUBLIC_ASSET_DIR, "static"))) {
    problems.push(`out/${PUBLIC_ASSET_DIR}/static is missing.`);
  }

  const homePath = path.join(outDir, "index.html");
  const home = readText(homePath);
  if (home === null) {
    problems.push("out/index.html is missing.");
  } else {
    for (const route of CLIENT_ROUTES) {
      if (!home.includes(`href="${route.href}"`)) {
        problems.push(`Homepage is missing the ${route.name} entry link ${route.href}.`);
      }
      const page = readText(path.join(outDir, route.html));
      const flight = readText(path.join(outDir, route.flight));
      if (page === null) problems.push(`Client route HTML is missing: ${route.html}`);
      else if (!page.includes(route.name) && !page.includes(route.name.replaceAll("&", "&amp;"))) {
        problems.push(`Client route ${route.html} does not render ${route.name}.`);
      }
      if (flight === null) problems.push(`Client route flight payload is missing: ${route.flight}`);
    }

    const homeAssets = assetReferences(home, homePath, outDir);
    const kinds = { css: 0, js: 0, woff2: 0 };
    for (const asset of homeAssets) {
      if (asset.pathname.endsWith(".css")) kinds.css += 1;
      if (asset.pathname.endsWith(".js")) kinds.js += 1;
      if (asset.pathname.endsWith(".woff2")) kinds.woff2 += 1;
    }
    if (kinds.css === 0) problems.push("Homepage does not reference a CSS file.");
    if (kinds.js === 0) problems.push("Homepage does not reference a JS file.");
    if (kinds.woff2 === 0) problems.push("Homepage does not reference a font file.");
  }

  for (const file of walkFiles(outDir)) {
    const ext = path.extname(file).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    const text = fs.readFileSync(file, "utf8");
    if (text.includes(BLOCKED_ASSET_PREFIX)) {
      problems.push(`${path.relative(outDir, file)} still references ${BLOCKED_ASSET_PREFIX}`);
    }
    if (ext === ".html" || ext === ".txt" || ext === ".css" || ext === ".js") {
      for (const asset of assetReferences(text, file, outDir)) {
        if (asset.pathname.includes("/_next/")) {
          problems.push(`${path.relative(outDir, file)} references blocked asset ${asset.pathname}`);
          continue;
        }
        if (!asset.pathname.startsWith(PUBLIC_ASSET_PREFIX) && !asset.pathname.startsWith("/")) continue;
        if (!fs.existsSync(asset.file)) {
          problems.push(
            `${path.relative(outDir, file)} references ${asset.pathname}, but ${path.relative(outDir, asset.file)} is not in the export.`,
          );
        }
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(problems.join("\n"));
  }
}

function readText(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8");
}

function assetReferences(
  text: string,
  fromFile: string,
  outDir: string,
): { pathname: string; file: string }[] {
  const found: { pathname: string; file: string }[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    const asset = resolveAsset(raw, fromFile, outDir);
    if (!asset || seen.has(asset.pathname)) return;
    if (!/\.(?:css|js|woff2?)(?:$)/.test(asset.pathname)) return;
    seen.add(asset.pathname);
    found.push(asset);
  };

  for (const match of text.matchAll(/(?:src|href)=["']([^"']+)["']/g)) add(match[1]);
  for (const match of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) add(match[1]);
  for (const match of text.matchAll(/["'](\/[^"']+\.(?:css|js|woff2?))["']/g)) add(match[1]);
  return found;
}

function resolveAsset(
  raw: string,
  fromFile: string,
  outDir: string,
): { pathname: string; file: string } | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("http:") || trimmed.startsWith("https:")) {
    return null;
  }
  const withoutQuery = trimmed.split(/[?#]/, 1)[0];
  if (!withoutQuery) return null;

  if (withoutQuery.startsWith("/")) {
    return { pathname: withoutQuery, file: path.join(outDir, withoutQuery.slice(1)) };
  }

  const file = path.normalize(path.join(path.dirname(fromFile), withoutQuery));
  const relative = path.relative(outDir, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return { pathname: `/${relative.split(path.sep).join("/")}`, file };
}

function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}
