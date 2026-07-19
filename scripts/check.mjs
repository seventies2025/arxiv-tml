import { readFileSync } from "node:fs";
import path from "node:path";

const base = process.cwd();
const errors = [];

function checkFileExists(file) {
  try {
    readFileSync(path.join(base, file));
    return true;
  } catch {
    errors.push(`Missing file: ${file}`);
    return false;
  }
}

const requiredFiles = [
  "package.json",
  ".env.example",
  ".gitignore",
  "server/index.mjs",
  "server/config.mjs",
  "server/arxiv.mjs",
  "server/topics.mjs",
  "server/classics.mjs",
  "server/ai.mjs",
  "server/discover.mjs",
  "server/seo.mjs",
  "server/data/classics.json",
  "public/index.html",
  "public/styles.css",
  "public/app.js",
  "public/icons/favicon.svg"
];

for (const file of requiredFiles) {
  checkFileExists(file);
}

const packageJson = JSON.parse(readFileSync(path.join(base, "package.json"), "utf8"));
if (!packageJson.type || packageJson.type !== "module") {
  errors.push("package.json must have type: module");
}

if (!packageJson.scripts || !packageJson.scripts.dev) {
  errors.push("package.json must have dev script");
}

if (errors.length > 0) {
  console.error("❌ Check failed:\n");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
} else {
  console.log("✅ All checks passed");
  process.exit(0);
}