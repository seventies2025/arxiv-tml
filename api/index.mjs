import { TOPICS, TREND_TERMS } from "../server/topics.mjs";
import { pageMeta, sitemapXml, robotsTxt } from "../server/seo.mjs";

const ARXIV_API = "https://export.arxiv.org/api/query";

function decodeEntities(text) {
  return String(text || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return match ? decodeEntities(match[1]) : "";
}

function normalizeArxivId(rawId) {
  const value = String(rawId || "").trim().replace(/^https?:\/\/arxiv\.org\/abs\//, "");
  const match = value.match(/^([\w.-]+?)(v\d+)?$/);
  if (!match) return null;
  return { id: match[1], version: match[2] || "" };
}

function parseEntry(entryXml) {
  const rawId = tag(entryXml, "id");
  const parsed = normalizeArxivId(rawId);
  if (!parsed) return null;
  const authors = [];
  const authorRe = /<author>([\s\S]*?)<\/author>/g;
  let authorMatch;
  while ((authorMatch = authorRe.exec(entryXml))) {
    const name = tag(authorMatch[1], "name");
    if (name) authors.push(name);
  }
  const links = {};
  const linkRe = /<link\b([^>]*)\/*>/g;
  let linkMatch;
  while ((linkMatch = linkRe.exec(entryXml))) {
    const attrs = linkMatch[1];
    const hrefMatch = attrs.match(/href="([^"]*)"/);
    const relMatch = attrs.match(/rel="([^"]*)"/);
    const typeMatch = attrs.match(/type="([^"]*)"/);
    const titleMatch = attrs.match(/title="([^"]*)"/);
    const href = hrefMatch ? decodeEntities(hrefMatch[1]) : "";
    const rel = relMatch ? relMatch[1] : "";
    const type = typeMatch ? typeMatch[1] : "";
    const title = titleMatch ? decodeEntities(titleMatch[1]) : "";
    if (!href) continue;
    if (title === "pdf" || type === "application/pdf") links.pdf = href;
    else if (rel === "alternate") links.abs = href;
  }
  const categories = [];
  const catRe = /<category\b([^>]*)\/*>/g;
  let catMatch;
  while ((catMatch = catRe.exec(entryXml))) {
    const attrs = catMatch[1];
    const termMatch = attrs.match(/term="([^"]*)"/);
    if (termMatch) categories.push(termMatch[1]);
  }
  return {
    id: parsed.id,
    version: parsed.version,
    title: tag(entryXml, "title"),
    summary: tag(entryXml, "summary"),
    authors,
    authorsMore: 0,
    published: tag(entryXml, "published"),
    updated: tag(entryXml, "updated"),
    primaryCategory: categories[0] || "",
    categories,
    comment: tag(entryXml, "comment"),
    links: {
      abs: links.abs || `https://arxiv.org/abs/${parsed.id}`,
      pdf: links.pdf || `https://arxiv.org/pdf/${parsed.id}`
    }
  };
}

function parseFeed(xml) {
  const totalMatch = xml.match(/<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/);
  const total = totalMatch ? Number(totalMatch[1]) : 0;
  const entries = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRe.exec(xml))) {
    const paper = parseEntry(match[1]);
    if (paper && paper.title) entries.push(paper);
  }
  return { total, entries };
}

function slimPaper(paper) {
  return {
    id: paper.id,
    version: paper.version,
    title: paper.title,
    summary: paper.summary,
    authors: paper.authors.slice(0, 3),
    authorsMore: Math.max(0, paper.authors.length - 3),
    published: paper.published,
    primaryCategory: paper.primaryCategory,
    comment: paper.comment
  };
}

async function fetchArxiv(params) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${ARXIV_API}?${query}`, {
    headers: { "User-Agent": "arxiv-tml/1.0 (+https://arxiv-tml.vercel.app)" },
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  return parseFeed(xml);
}

const CLASSICS_DATA = [
  { id: "1003.0358", title: "Statistical Learning Theory", titleZh: "统计学习理论", year: 1998, authors: ["Vladimir Vapnik"], summary: "Foundational work on statistical learning theory, introducing VC dimension and structural risk minimization.", summaryZh: "统计学习理论的奠基性工作，引入了VC维数和结构风险最小化。", category: "theory-ml", type: "book" },
  { id: "1606.05908", title: "Understanding deep learning requires rethinking generalization", titleZh: "理解深度学习需要重新思考泛化", year: 2016, authors: ["Chiyuan Zhang", "Samy Bengio", "Moritz Hardt", "Benjamin Recht", "Oriol Vinyals"], summary: "Shows that deep neural networks can fit random labels, challenging traditional views on generalization.", summaryZh: "展示深度神经网络能够拟合随机标签，挑战了传统的泛化观点。", category: "deep-learning-theory", type: "paper" },
  { id: "1902.04623", title: "Neural Tangent Kernel: Convergence and Generalization in Neural Networks", titleZh: "神经切线核：神经网络的收敛与泛化", year: 2019, authors: ["Arthur Jacot", "Franck Gabriel", "Clément Hongler"], summary: "Develops the neural tangent kernel theory for analyzing wide neural networks.", summaryZh: "发展神经切线核理论用于分析宽神经网络。", category: "deep-learning-theory", type: "paper" },
  { id: "1803.08375", title: "Quantum Machine Learning", titleZh: "量子机器学习", year: 2018, authors: ["Jacob Biamonte", "Peter Wittek", "Nicolas Pancotti", "Patrick Rebentrost", "Nathan Wiebe", "Seth Lloyd"], summary: "Comprehensive review of quantum machine learning algorithms and applications.", summaryZh: "量子机器学习算法与应用的全面综述。", category: "quantum-ml", type: "review" },
  { id: "2301.04104", title: "Quantum Advantage in Machine Learning", titleZh: "机器学习中的量子优势", year: 2023, authors: ["Hsin-Yuan Huang", "Richard Kueng", "John Preskill"], summary: "Discusses the theoretical foundations of quantum advantage in ML tasks.", summaryZh: "讨论机器学习任务中量子优势的理论基础。", category: "quantum-ml", type: "paper" }
];

const INDEX_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{META_TITLE}}</title>
  <meta name="description" content="{{META_DESCRIPTION}}">
  <link rel="canonical" href="{{CANONICAL}}">
  <meta property="og:title" content="{{META_TITLE}}">
  <meta property="og:description" content="{{META_DESCRIPTION}}">
  <meta property="og:url" content="{{CANONICAL}}">
  <meta property="og:type" content="website">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header id="siteHeader" class="site-header">
    <div class="header-inner">
      <a href="/" data-link class="brand">
        <span class="brand-mark">∀</span>
        <span class="brand-name">arXiv<em>-TML</em></span>
      </a>
      <nav class="main-nav">
        <a href="/" data-link data-nav="home">首页</a>
        <a href="/topics" data-link data-nav="topics">主题</a>
        <a href="/classics" data-link data-nav="classics">经典论文</a>
        <a href="/discover" data-link data-nav="discover">搜索发现</a>
        <a href="/favorites" data-link data-nav="favorites">收藏</a>
      </nav>
      <form id="headerSearch" class="header-search">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="搜论文、作者、arXiv ID…" autocomplete="off">
        <button type="submit" class="search-submit">→</button>
      </form>
    </div>
  </header>
  <main id="app" class="app"></main>
  <div id="toast" class="toast" hidden></div>
  <script src="/app.js"></script>
</body>
</html>`;

function html(content, meta) {
  meta = meta || pageMeta("home");
  return INDEX_HTML
    .replace("{{META_TITLE}}", meta.title)
    .replace("{{META_DESCRIPTION}}", meta.description)
    .replace("{{CANONICAL}}", meta.canonical)
    .replace(/property="og:title"/g, () => `content="${meta.ogTitle}" property="og:title"`)
    .replace(/property="og:description"/g, () => `content="${meta.ogDescription}" property="og:description"`)
    .replace(/property="og:url"/g, () => `content="${meta.ogUrl}" property="og:url"`);
}

export default async function handler(req, res) {
  const { url, method = "GET" } = req;
  const parsedUrl = new URL(url, `https://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const methodUpper = method.toUpperCase();

  if (pathname.startsWith("/api/")) {
    if (methodUpper === "OPTIONS") {
      return res.status(204).setHeader("Access-Control-Allow-Origin", "*")
        .setHeader("Access-Control-Allow-Methods", "GET, POST")
        .setHeader("Access-Control-Allow-Headers", "Content-Type").end();
    }

    try {
      if (pathname === "/api/topics") {
        return res.status(200).setHeader("Content-Type", "application/json")
          .setHeader("Access-Control-Allow-Origin", "*").json({ topics: TOPICS });
      }

      if (pathname === "/api/topic") {
        const topicId = parsedUrl.searchParams.get("id");
        const topic = TOPICS.find((t) => t.id === topicId);
        if (!topic) {
          return res.status(404).setHeader("Content-Type", "application/json")
            .setHeader("Access-Control-Allow-Origin", "*").json({ error: "Topic not found" });
        }
        const start = Number(parsedUrl.searchParams.get("start") || 0);
        const max = Number(parsedUrl.searchParams.get("max") || 20);
        const result = await fetchArxiv({
          search_query: topic.query,
          start: String(Math.max(0, start)),
          max_results: String(Math.min(50, Math.max(1, max))),
          sortBy: topic.sort || "submittedDate",
          sortOrder: "descending"
        });
        return res.status(200).setHeader("Content-Type", "application/json")
          .setHeader("Access-Control-Allow-Origin", "*").json({
            topic,
            ...result,
            entries: result.entries.map(slimPaper)
          });
      }

      if (pathname === "/api/latest") {
        const start = Number(parsedUrl.searchParams.get("start") || 0);
        const max = Number(parsedUrl.searchParams.get("max") || 20);
        const result = await fetchArxiv({
          search_query: "cat:cs.LG OR cat:stat.ML OR cat:quant-ph",
          start: String(Math.max(0, start)),
          max_results: String(Math.min(50, Math.max(1, max))),
          sortBy: "submittedDate",
          sortOrder: "descending"
        });
        return res.status(200).setHeader("Content-Type", "application/json")
          .setHeader("Access-Control-Allow-Origin", "*").json({
            ...result,
            entries: result.entries.map(slimPaper)
          });
      }

      if (pathname === "/api/search") {
        const q = parsedUrl.searchParams.get("q") || "";
        const cat = parsedUrl.searchParams.get("cat") || "";
        const sort = parsedUrl.searchParams.get("sort") || "relevance";
        const start = Number(parsedUrl.searchParams.get("start") || 0);
        const max = Number(parsedUrl.searchParams.get("max") || 20);
        const keyword = String(q || "").trim();
        if (!keyword) {
          return res.status(200).setHeader("Content-Type", "application/json")
            .setHeader("Access-Control-Allow-Origin", "*").json({ total: 0, entries: [] });
        }
        const phrase = keyword.length > 2 && !/\s/.test(keyword) ? `all:"${keyword}"` : `all:${keyword}`;
        const searchQuery = cat ? `(${phrase}) AND cat:${cat}` : phrase;
        const result = await fetchArxiv({
          search_query: searchQuery,
          start: String(Math.max(0, start)),
          max_results: String(Math.min(50, Math.max(1, max))),
          sortBy: sort === "date" ? "submittedDate" : sort === "updated" ? "lastUpdatedDate" : "relevance",
          sortOrder: "descending"
        });
        return res.status(200).setHeader("Content-Type", "application/json")
          .setHeader("Access-Control-Allow-Origin", "*").json({
            ...result,
            entries: result.entries.map(slimPaper)
          });
      }

      if (pathname === "/api/paper") {
        const id = parsedUrl.searchParams.get("id");
        if (!id) {
          return res.status(400).setHeader("Content-Type", "application/json")
            .setHeader("Access-Control-Allow-Origin", "*").json({ error: "Missing paper ID" });
        }
        const result = await fetchArxiv({
          id_list: id
        });
        if (!result.entries || result.entries.length === 0) {
          return res.status(404).setHeader("Content-Type", "application/json")
            .setHeader("Access-Control-Allow-Origin", "*").json({ error: "Paper not found" });
        }
        return res.status(200).setHeader("Content-Type", "application/json")
          .setHeader("Access-Control-Allow-Origin", "*").json(result.entries[0]);
      }

      if (pathname === "/api/classics") {
        return res.status(200).setHeader("Content-Type", "application/json")
          .setHeader("Access-Control-Allow-Origin", "*").json({ entries: CLASSICS_DATA });
      }

      if (pathname === "/api/trends") {
        return res.status(200).setHeader("Content-Type", "application/json")
          .setHeader("Access-Control-Allow-Origin", "*").json({ terms: TREND_TERMS });
      }

      if (pathname === "/api/ai-enabled") {
        return res.status(200).setHeader("Content-Type", "application/json")
          .setHeader("Access-Control-Allow-Origin", "*").json({ enabled: false });
      }

      if (pathname === "/api/featured") {
        return res.status(200).setHeader("Content-Type", "application/json")
          .setHeader("Access-Control-Allow-Origin", "*").json({ picks: [], aiEnabled: false });
      }

      return res.status(404).setHeader("Content-Type", "application/json")
        .setHeader("Access-Control-Allow-Origin", "*").json({ error: "Not found" });
    } catch (error) {
      return res.status(503).setHeader("Content-Type", "application/json")
        .setHeader("Access-Control-Allow-Origin", "*").json({
          error: "Service unavailable",
          message: error.message
        });
    }
  }

  if (pathname === "/sitemap.xml") {
    return res.status(200).setHeader("Content-Type", "application/xml; charset=utf-8").send(sitemapXml());
  }

  if (pathname === "/robots.txt") {
    return res.status(200).setHeader("Content-Type", "text/plain; charset=utf-8").send(robotsTxt());
  }

  if (pathname === "/styles.css" || pathname === "/app.js") {
    const staticUrl = `https://raw.githubusercontent.com/seventies2025/arxiv-tml/main/public${pathname}`;
    const staticRes = await fetch(staticUrl);
    if (!staticRes.ok) {
      return res.status(404).send("Not found");
    }
    const content = await staticRes.text();
    const contentType = pathname.endsWith(".css") ? "text/css; charset=utf-8" : "application/javascript; charset=utf-8";
    return res.status(200).setHeader("Content-Type", contentType)
      .setHeader("Cache-Control", "public, max-age=3600").send(content);
  }

  if (pathname.startsWith("/icons/")) {
    const staticUrl = `https://raw.githubusercontent.com/seventies2025/arxiv-tml/main/public${pathname}`;
    const staticRes = await fetch(staticUrl);
    if (!staticRes.ok) {
      return res.status(404).send("Not found");
    }
    const buffer = await staticRes.buffer();
    return res.status(200).setHeader("Content-Type", "image/svg+xml")
      .setHeader("Cache-Control", "public, max-age=86400").send(buffer);
  }

  let pageMetaInfo;
  if (pathname === "/") {
    pageMetaInfo = pageMeta("home");
  } else if (pathname === "/topics") {
    pageMetaInfo = pageMeta("topics");
  } else if (pathname.startsWith("/topics/")) {
    const topicId = pathname.split("/")[2];
    const topic = TOPICS.find((t) => t.id === topicId);
    pageMetaInfo = pageMeta("topic", { topic });
  } else if (pathname === "/classics") {
    pageMetaInfo = pageMeta("classics");
  } else if (pathname === "/discover") {
    pageMetaInfo = pageMeta("discover");
  } else if (pathname === "/search") {
    const q = parsedUrl.searchParams.get("q") || "";
    pageMetaInfo = pageMeta("search", { query: q });
  } else if (pathname.startsWith("/paper/")) {
    const id = pathname.split("/")[2];
    pageMetaInfo = pageMeta("paper", { paper: { id } });
  } else if (pathname === "/favorites") {
    pageMetaInfo = pageMeta("favorites");
  } else {
    pageMetaInfo = pageMeta("home");
  }

  return res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(html("", pageMetaInfo));
}
