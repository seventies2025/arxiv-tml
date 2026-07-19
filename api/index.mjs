import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { config } from "../server/config.mjs";
import { searchPapers, topicPapers, latestPapers, getPaper, getPapersByIds, slimPaper, recentPool } from "../server/arxiv.mjs";
import { TOPICS, TREND_TERMS } from "../server/topics.mjs";
import { getClassics, getClassicsTimeline } from "../server/classics.mjs";
import { aiEnabled, streamExplain, streamChat, readFeatured, generateFeatured } from "../server/ai.mjs";
import { discoverPapers } from "../server/discover.mjs";
import { pageMeta, sitemapXml, robotsTxt } from "../server/seo.mjs";

const __dirname = path.dirname(import.meta.url).replace("file://", "");
const PUBLIC_DIR = path.join(__dirname, "../public");
const STORAGE_DIR = path.join(__dirname, "../", config.storageDir);

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
    return { statusCode: 200, headers: { "Content-Type": contentType }, body: content };
  } catch {
    return { statusCode: 404, body: "Not found" };
  }
}

function json(data, status = 200) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(data)
  };
}

function html(content, meta) {
  let page = indexHtml;
  if (!page) {
    return { statusCode: 503, body: "Service unavailable" };
  }
  meta = meta || pageMeta("home");
  page = page
    .replace("{{META_TITLE}}", meta.title)
    .replace("{{META_DESCRIPTION}}", meta.description)
    .replace("{{CANONICAL}}", meta.canonical)
    .replace(/property="og:title"/g, () => `content="${meta.ogTitle}" property="og:title"`)
    .replace(/property="og:description"/g, () => `content="${meta.ogDescription}" property="og:description"`)
    .replace(/property="og:url"/g, () => `content="${meta.ogUrl}" property="og:url"`);
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: page
  };
}

async function handleApiRequest(pathname, url) {
  if (pathname === "/api/search") {
    const q = url.searchParams.get("q") || "";
    const cat = url.searchParams.get("cat") || "";
    const sort = url.searchParams.get("sort") || "relevance";
    const start = Number(url.searchParams.get("start") || 0);
    const max = Number(url.searchParams.get("max") || 20);
    const result = await searchPapers({ q, cat, sort, start, max });
    return json({ ...result, entries: result.entries.map(slimPaper) });
  } else if (pathname === "/api/discover") {
    const q = url.searchParams.get("q") || "";
    const sort = url.searchParams.get("sort") || "relevance";
    const start = Number(url.searchParams.get("start") || 0);
    const max = Number(url.searchParams.get("max") || 20);
    const result = await discoverPapers(q, { sort, start, max });
    return json({ ...result, entries: result.entries.map(slimPaper) });
  } else if (pathname === "/api/topics") {
    return json({ topics: TOPICS });
  } else if (pathname === "/api/topic") {
    const topicId = url.searchParams.get("id");
    const topic = TOPICS.find((t) => t.id === topicId);
    if (!topic) {
      return json({ error: "Topic not found" }, 404);
    }
    const max = Number(url.searchParams.get("max") || 20);
    const start = Number(url.searchParams.get("start") || 0);
    const result = await topicPapers(topic, { max, start });
    return json({ topic, ...result, entries: result.entries.map(slimPaper) });
  } else if (pathname === "/api/latest") {
    const cat = url.searchParams.get("cat") || "";
    const max = Number(url.searchParams.get("max") || 20);
    const result = await latestPapers(cat, { max });
    return json({ ...result, entries: result.entries.map(slimPaper) });
  } else if (pathname === "/api/paper") {
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "Missing id" }, 400);
    const paper = await getPaper(id);
    return paper ? json(paper) : json({ error: "Paper not found" }, 404);
  } else if (pathname === "/api/papers") {
    const ids = url.searchParams.get("ids") || "";
    const result = await getPapersByIds(ids.split(",").filter(Boolean));
    return json({ entries: result.map(slimPaper) });
  } else if (pathname === "/api/classics") {
    const entries = await getClassics();
    return json({ entries });
  } else if (pathname === "/api/trends") {
    return json({ terms: TREND_TERMS });
  } else if (pathname === "/api/featured") {
    let featured = await readFeatured();
    if (!featured) {
      if (!aiEnabled()) {
        return json({ picks: [], aiEnabled: false });
      }
      try {
        const pool = await recentPool(["cs.LG", "stat.ML", "quant-ph", "cs.AI"], { perCategory: 12 });
        featured = await generateFeatured(pool);
      } catch {
        return json({ picks: [], aiEnabled: true });
      }
    }
    if (!featured) {
      return json({ picks: [], aiEnabled: aiEnabled() });
    }
    return json({ ...featured, picks: featured.picks.map((p) => ({ ...p, paper: slimPaper(p.paper) })), aiEnabled: true });
  } else {
    return json({ error: "Not found" }, 404);
  }
}

export default async function handler(request, response) {
  await loadIndexHtml();
  
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();

  if (pathname.startsWith("/api/")) {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (method === "OPTIONS") {
      return { statusCode: 204, headers };
    }

    try {
      const result = await handleApiRequest(pathname, url);
      return { ...result, headers: { ...result.headers, ...headers } };
    } catch (error) {
      return {
        statusCode: 500,
        headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "Internal server error" })
      };
    }
  }

  if (pathname === "/sitemap.xml") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/xml; charset=utf-8" },
      body: sitemapXml()
    };
  }

  if (pathname === "/robots.txt") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: robotsTxt()
    };
  }

  if (pathname.startsWith("/styles.css")) {
    return serveFile(response, path.join(PUBLIC_DIR, "styles.css"), "text/css");
  }

  if (pathname.startsWith("/app.js")) {
    return serveFile(response, path.join(PUBLIC_DIR, "app.js"), "application/javascript");
  }

  if (pathname.startsWith("/icons/")) {
    const iconPath = path.join(PUBLIC_DIR, "icons", pathname.replace("/icons/", ""));
    const result = await serveFile(response, iconPath, "image/svg+xml");
    if (result.statusCode === 404) {
      return serveFile(response, iconPath, "image/png");
    }
    return result;
  }

  return html("", pageMeta("home"));
}
