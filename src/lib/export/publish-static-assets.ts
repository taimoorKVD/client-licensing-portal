import fs from "node:fs";
import path from "node:path";

/**
 * Hostinger serves the exported HTML, then denies `/_next/` (403) and 404s
 * every file under `/_next/static/`. The role switcher never hydrates and the
 * page stays unstyled. Next always emits that prefix, so the static export
 * moves the tree and rewrites the references before anything is uploaded.
 */
export const BLOCKED_ASSET_PREFIX = "/_next/";
export const PUBLIC_ASSET_DIR = "next-assets";
export const PUBLIC_ASSET_PREFIX = `/${PUBLIC_ASSET_DIR}/`;

const TEXT_EXTENSIONS = new Set([".html", ".txt", ".js", ".css", ".json", ".map", ".svg"]);

export function publishStaticAssets(outDir: string): void {
  const blockedDir = path.join(outDir, "_next");
  const publicDir = path.join(outDir, PUBLIC_ASSET_DIR);

  if (!fs.existsSync(blockedDir)) {
    throw new Error(
      `Static export is missing ${blockedDir}. Run next build with output: "export" before publishing assets.`,
    );
  }

  fs.rmSync(publicDir, { recursive: true, force: true });
  fs.renameSync(blockedDir, publicDir);
  rewriteReferences(outDir);
}

function rewriteReferences(outDir: string): void {
  for (const file of walkFiles(outDir)) {
    if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    const raw = fs.readFileSync(file);
    if (raw.includes(0)) continue;
    const text = raw.toString("utf8");
    if (!text.includes(BLOCKED_ASSET_PREFIX)) continue;
    fs.writeFileSync(file, text.replaceAll(BLOCKED_ASSET_PREFIX, PUBLIC_ASSET_PREFIX));
  }
}

function walkFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}
