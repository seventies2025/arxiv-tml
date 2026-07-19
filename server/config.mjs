import { readFileSync } from "node:fs";
import path from "node:path";

const env = {};
const envFile = path.join(process.cwd(), ".env.local");

try {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
} catch {}

const isVercel = !!process.env.VERCEL;

export const config = {
  deepseekApiKey: env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || "",
  deepseekBaseUrl: env.DEEPSEEK_BASE_URL || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  deepseekModel: env.DEEPSEEK_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
  port: Number(env.PORT || process.env.PORT || 4174),
  host: env.HOST || process.env.HOST || (isVercel ? "0.0.0.0" : "127.0.0.1"),
  publicBaseUrl: env.PUBLIC_BASE_URL || process.env.PUBLIC_BASE_URL || "https://arxiv-tml.example.com",
  storageDir: env.STORAGE_DIR || process.env.STORAGE_DIR || (isVercel ? "/tmp/storage" : "storage")
};