import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.mjs";
import { searchPapers, topicPapers, latestPapers, getPaper, getPapersByIds, recentPool, slimPaper, normalizeArxivId } from "./arxiv.mjs";
import { TOPICS, TREND_TERMS } from "./topics.mjs";
import { getClassics, getClassicsTimeline } from "./classics.mjs";
import { aiEnabled, streamExplain, streamChat, readFeatured, generateFeatured } from "./ai.mjs";
import { discoverPapers } from "./discover.mjs";
import { pageMeta, sitemapXml, robotsTxt } from "./seo.mjs";

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

async function handleRequest(req, res) {
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
        const start = Number(url.searchParams.get("start") || 0);
        const max = Number(url.searchParams.get("max") || 20);
        const result = await topicPapers(topic, { start, max });
        json(res, { topic, ...result, entries: result.entries.map(slimPaper) });
      } else if (pathname === "/api/latest") {
        const start = Number(url.searchParams.get("start") || 0);
        const max = Number(url.searchParams.get("max") || 20);
        const result = await latestPapers({ start, max });
        json(res, { ...result, entries: result.entries.map(slimPaper) });
      } else if (pathname === "/api/paper") {
        const id = url.searchParams.get("id");
        if (!id) {
          json(res, { error: "Missing paper ID" }, 400);
          return;
        }
        const paper = await getPaper(id);
        if (!paper) {
          json(res, { error: "Paper not found" }, 404);
          return;
        }
        json(res, paper);
      } else if (pathname === "/api/papers") {
        const ids = url.searchParams.get("ids")?.split(",") || [];
        const papers = await getPapersByIds(ids);
        json(res, { entries: papers.map(slimPaper) });
      } else if (pathname === "/api/classics") {
        const classics = await getClassicsTimeline();
        json(res, { entries: classics });
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
      } else if (pathname === "/api/trends") {
        json(res, { terms: TREND_TERMS });
      } else if (pathname === "/api/ai-enabled") {
        json(res, { enabled: aiEnabled() });
      } else {
        json(res, { error: "Not found" }, 404);
      }
    } catch (error) {
      console.error("API error:", error);
      json(res, { error: "Internal server error" }, 500);
    }
    return;
  }

  if (pathname === "/sse/explain") {
    const id = url.searchParams.get("id");
    if (!id) {
      res.writeHead(400);
      res.end("Missing paper ID");
      return;
    }
    const paper = await getPaper(id);
    if (!paper) {
      res.writeHead(404);
      res.end("Paper not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });
    await streamExplain(res, paper);
    res.end();
    return;
  }

  if (pathname === "/sse/chat") {
    const id = url.searchParams.get("id");
    if (!id) {
      res.writeHead(400);
      res.end("Missing paper ID");
      return;
    }
    const paper = await getPaper(id);
    if (!paper) {
      res.writeHead(404);
      res.end("Paper not found");
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    let turns;
    try {
      turns = JSON.parse(body).turns;
    } catch {
      res.writeHead(400);
      res.end("Invalid request body");
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });
    await streamChat(res, paper, turns);
    res.end();
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

  if (pathname.startsWith("/icons/")) {
    const iconPath = path.join(PUBLIC_DIR, pathname);
    await serveFile(res, iconPath, "image/svg+xml");
    return;
  }

  if (pathname === "/styles.css") {
    await serveFile(res, path.join(PUBLIC_DIR, "styles.css"), "text/css; charset=utf-8");
    return;
  }

  if (pathname === "/app.js") {
    await serveFile(res, path.join(PUBLIC_DIR, "app.js"), "application/javascript; charset=utf-8");
    return;
  }

  if (pathname === "/") {
    html(res, "", pageMeta("home"));
    return;
  }

  if (pathname === "/topics") {
    html(res, "", pageMeta("topics"));
    return;
  }

  if (pathname.startsWith("/topics/")) {
    const topicId = pathname.split("/")[2];
    const topic = TOPICS.find((t) => t.id === topicId);
    html(res, "", pageMeta("topic", { topic }));
    return;
  }

  if (pathname === "/classics") {
    html(res, "", pageMeta("classics"));
    return;
  }

  if (pathname === "/discover") {
    html(res, "", pageMeta("discover"));
    return;
  }

  if (pathname === "/search") {
    const q = url.searchParams.get("q") || "";
    html(res, "", pageMeta("search", { query: q }));
    return;
  }

  if (pathname.startsWith("/paper/")) {
    const id = pathname.split("/")[2];
    if (id) {
      const paper = await getPaper(id);
      html(res, "", pageMeta("paper", { paper }));
    } else {
      html(res, "", pageMeta("home"));
    }
    return;
  }

  if (pathname === "/favorites") {
    html(res, "", pageMeta("favorites"));
    return;
  }

  html(res, "", pageMeta("home"));
}

const server = createServer(handleRequest);

if (process.env.NODE_ENV !== "production" || process.argv.includes("--dev")) {
  server.listen(config.port, config.host, () => {
    console.log(`arXiv-TML server running at http://${config.host}:${config.port}`);
  });

  process.on("SIGTERM", () => {
    server.close(() => process.exit(0));
  });

  process.on("SIGINT", () => {
    server.close(() => process.exit(0));
  });
}

export default handleRequest;