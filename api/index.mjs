import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { config } from "../server/config.mjs";
import { searchPapers, topicPapers, latestPapers, getPaper, getPapersByIds, slimPaper, recentPool } from "../server/arxiv.mjs";
import { TOPICS, TREND_TERMS } from "../server/topics.mjs";
import { getClassics, getClassicsTimeline } from "../server/classics.mjs";
import { aiEnabled, readFeatured, generateFeatured } from "../server/ai.mjs";
import { discoverPapers } from "../server/discover.mjs";
import { pageMeta, sitemapXml, robotsTxt } from "../server/seo.mjs";

const __dirname = path.dirname(import.meta.url).replace("file://", "");
const PUBLIC_DIR = path.join(__dirname, "../public");
const STORAGE_DIR = path.join("/tmp", config.storageDir);

let indexHtml = "";
let indexMtime = 0;

async function loadIndexHtml() {
  try {
    const info = await stat(path.join(PUBLIC_DIR, "index.html"));
    if (info.mtime.getTime() > indexMtime) {
      indexHtml = await readFile(path.join(PUBLIC_DIR, "index.html"), "utf8");
      indexMtime = info.mtime.getTime();
    }
  } catch {
    indexHtml = "";
  }
}

async function serveFile(res, filePath, contentType) {
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function html(res, content, meta) {
  let page = indexHtml;
  if (!page) {
    res.writeHead(503);
    res.end("Service unavailable");
    return;
  }
  meta = meta || pageMeta("home");
  page = page
    .replace("{{META_TITLE}}", meta.title)
    .replace("{{META_DESCRIPTION}}", meta.description)
    .replace("{{CANONICAL}}", meta.canonical)
    .replace(/property="og:title"/g, () => `content="${meta.ogTitle}" property="og:title"`)
    .replace(/property="og:description"/g, () => `content="${meta.ogDescription}" property="og:description"`)
    .replace(/property="og:url"/g, () => `content="${meta.ogUrl}" property="og:url"`);
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(page);
}

async function handleApiRequest(res, pathname, url) {
  if (pathname === "/api/search") {
    const q = url.searchParams.get("q") || "";
    const cat = url.searchParams.get("cat") || "";
    const sort = url.searchParams.get("sort") || "relevance";
    const start = Number(url.searchParams.get("start") || 0);
    const max = Number(url.searchParams.get("max") || 20);
    const result = await searchPapers({ q, cat, sort, start, max });
    json(res, { ...result, entries: result.entries.map(slimPaper) });
  } else if (pathname === "/api/discover") {
    const q = url.searchParams.get("q") || "";
    const sort = url.searchParams.get("sort") || "relevance";
    const start = Number(url.searchParams.get("start") || 0);
    const max = Number(url.searchParams.get("max") || 20);
    const result = await discoverPapers(q, { sort, start, max });
    json(res, { ...result, entries: result.entries.map(slimPaper) });
  } else if (pathname === "/api/topics") {
    json(res, { topics: TOPICS });
  } else if (pathname === "/api/topic") {
    const topicId = url.searchParams.get("id");
    const topic = TOPICS.find((t) => t.id === topicId);
    if (!topic) {
      json(res, { error: "Topic not found" }, 404);
      return;
    }
    const max = Number(url.searchParams.get("max") || 20);
    const start = Number(url.searchParams.get("start") || 0);
    const result = await topicPapers(topic, { max, start });
    json(res, { topic, ...result, entries: result.entries.map(slimPaper) });
  } else if (pathname === "/api/latest") {
    const cat = url.searchParams.get("cat") || "";
    const max = Number(url.searchParams.get("max") || 20);
    const result = await latestPapers(cat, { max });
    json(res, { ...result, entries: result.entries.map(slimPaper) });
  } else if (pathname === "/api/paper") {
    const id = url.searchParams.get("id");
    if (!id) {
      json(res, { error: "Missing id" }, 400);
      return;
    }
    const paper = await getPaper(id);
    if (paper) {
      json(res, paper);
    } else {
      json(res, { error: "Paper not found" }, 404);
    }
  } else if (pathname === "/api/papers") {
    const ids = url.searchParams.get("ids") || "";
    const result = await getPapersByIds(ids.split(",").filter(Boolean));
    json(res, { entries: result.map(slimPaper) });
  } else if (pathname === "/api/classics") {
    const entries = await getClassics();
    json(res, { entries });
  } else if (pathname === "/api/trends") {
    json(res, { terms: TREND_TERMS });
  } else if (pathname === "/api/featured") {
    let featured = await readFeatured();
    if (!featured) {
      if (!aiEnabled()) {
        json(res, { picks: [], aiEnabled: false });
        return;
      }
      try {
        const pool = await recentPool(["cs.LG", "stat.ML", "quant-ph", "cs.AI"], { perCategory: 12 });
        featured = await generateFeatured(pool);
      } catch {
        json(res, { picks: [], aiEnabled: true });
        return;
      }
    }
    if (!featured) {
      json(res, { picks: [], aiEnabled: aiEnabled() });
      return;
    }
    json(res, { ...featured, picks: featured.picks.map((p) => ({ ...p, paper: slimPaper(p.paper) })), aiEnabled: true });
  } else {
    json(res, { error: "Not found" }, 404);
  }
}

export default async function handler(req, res) {
  await loadIndexHtml();
  
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;
  const method = req.method.toUpperCase();

  if (pathname.startsWith("/api/")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      await handleApiRequest(res, pathname, url);
    } catch (error) {
      console.error("API error:", error);
      json(res, { error: "Internal server error" }, 500);
    }
    return;
  }

  if (pathname === "/sse/explain" || pathname === "/sse/chat") {
    res.writeHead(501);
    res.end("SSE not supported on this platform");
    return;
  }

  if (pathname === "/sitemap.xml") {
    res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
    res.end(sitemapXml());
    return;
  }

  if (pathname === "/robots.txt") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(robotsTxt());
    return;
  }

  if (pathname.startsWith("/styles.css")) {
    await serveFile(res, path.join(PUBLIC_DIR, "styles.css"), "text/css");
    return;
  }

  if (pathname.startsWith("/app.js")) {
    await serveFile(res, path.join(PUBLIC_DIR, "app.js"), "application/javascript");
    return;
  }

  if (pathname.startsWith("/icons/")) {
    const iconPath = path.join(PUBLIC_DIR, "icons", pathname.replace("/icons/", ""));
    try {
      const content = await readFile(iconPath);
      res.writeHead(200, { "Content-Type": "image/svg+xml" });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
    return;
  }

  html(res, "", pageMeta("home"));
}
