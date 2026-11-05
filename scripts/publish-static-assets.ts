import path from "node:path";
import { publishStaticAssets } from "../src/lib/export/publish-static-assets";
import { verifyStaticExport } from "../src/lib/export/verify-static-export";

const outDir = path.resolve("out");
publishStaticAssets(outDir);
verifyStaticExport(outDir);
