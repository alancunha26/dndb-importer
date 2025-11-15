import * as esbuild from "esbuild";
import { copyFile, mkdir } from "fs/promises";
import { join } from "path";

const sharedConfig = {
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  sourcemap: true,
  packages: "external", // Don't bundle node_modules
};

try {
  // Build CLI
  await esbuild.build({
    ...sharedConfig,
    entryPoints: ["src/cli/index.ts"],
    outfile: "dist/cli.js",
    minify: true,
  });

  // Build utils for testing
  await esbuild.build({
    ...sharedConfig,
    entryPoints: ["src/utils/index.ts"],
    outfile: "dist/utils/config.js",
    minify: false,
  });

  // Copy config files
  await mkdir("dist/config", { recursive: true });
  await copyFile(
    join("src", "config", "default.json"),
    join("dist", "config", "default.json"),
  );

  console.log("✓ Build complete!");
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
