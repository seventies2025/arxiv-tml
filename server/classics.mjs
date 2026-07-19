import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.mjs";

const DATA_FILE = path.join(path.dirname(import.meta.url).replace("file://", ""), "data", "classics.json");

let cachedData = null;

export async function getClassics() {
  if (cachedData) return cachedData;
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    cachedData = JSON.parse(raw);
    return cachedData;
  } catch {
    return [];
  }
}

export async function getClassicById(id) {
  const classics = await getClassics();
  return classics.find((c) => c.id === id);
}

export async function getClassicsByCategory(category) {
  const classics = await getClassics();
  return classics.filter((c) => c.category === category);
}

export async function getClassicsTimeline() {
  const classics = await getClassics();
  return classics.sort((a, b) => a.year - b.year);
}