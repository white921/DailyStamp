import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const sourceDirs = ["src", "scripts"];

function collectJsFiles(directory) {
  const entries = readdirSync(directory);
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...collectJsFiles(fullPath));
      continue;
    }

    if (fullPath.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = sourceDirs.flatMap((dir) => collectJsFiles(join(projectRoot, dir)));

for (const filePath of files) {
  const result = spawnSync(process.execPath, ["--check", filePath], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Checked ${files.length} JavaScript files.`);
