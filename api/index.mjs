export const config = {
  runtime: "edge"
};

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
    signal: AbortSignal.timeout(8000)
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
      <div class="header-left">
        <a href="/" data-link class="site-logo">arXiv-TML</a>
      </div>
      <nav class="header-nav">
        <a href="/" data-link>首页</a>
        <a href="/topics" data-link>主题</a>
        <a href="/classics" data-link>经典论文</a>
        <a href="/discover" data-link>搜索发现</a>
        <a href="/favorites" data-link>收藏</a>
      </nav>
      <form id="headerSearch" class="header-search">
        <input type="text" placeholder="搜论文、作者、arXiv ID…" autocomplete="off">
        <button type="submit">搜索</button>
      </form>
      <a href="https://arxiv.org" target="_blank" class="header-arxiv">arXiv.org</a>
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

export default async function handler(req) {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = (req.method || "GET").toUpperCase();

  if (pathname.startsWith("/api/")) {
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    try {
      if (pathname === "/api/topics") {
        return new Response(JSON.stringify({ topics: TOPICS }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      if (pathname === "/api/topic") {
        const topicId = url.searchParams.get("id");
        const topic = TOPICS.find((t) => t.id === topicId);
        if (!topic) {
          return new Response(JSON.stringify({ error: "Topic not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }
        const start = Number(url.searchParams.get("start") || 0);
        const max = Number(url.searchParams.get("max") || 20);
        const result = await fetchArxiv({
          search_query: topic.query,
          start: String(Math.max(0, start)),
          max_results: String(Math.min(50, Math.max(1, max))),
          sortBy: topic.sort || "submittedDate",
          sortOrder: "descending"
        });
        return new Response(JSON.stringify({
          topic,
          ...result,
          entries: result.entries.map(slimPaper)
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      if (pathname === "/api/latest") {
        const start = Number(url.searchParams.get("start") || 0);
        const max = Number(url.searchParams.get("max") || 20);
        const result = await fetchArxiv({
          search_query: "cat:cs.LG OR cat:stat.ML OR cat:quant-ph",
          start: String(Math.max(0, start)),
          max_results: String(Math.min(50, Math.max(1, max))),
          sortBy: "submittedDate",
          sortOrder: "descending"
        });
        return new Response(JSON.stringify({
          ...result,
          entries: result.entries.map(slimPaper)
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      if (pathname === "/api/search") {
        const q = url.searchParams.get("q") || "";
        const cat = url.searchParams.get("cat") || "";
        const sort = url.searchParams.get("sort") || "relevance";
        const start = Number(url.searchParams.get("start") || 0);
        const max = Number(url.searchParams.get("max") || 20);
        const keyword = String(q || "").trim();
        if (!keyword) {
          return new Response(JSON.stringify({ total: 0, entries: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
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
        return new Response(JSON.stringify({
          ...result,
          entries: result.entries.map(slimPaper)
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      if (pathname === "/api/paper") {
        const id = url.searchParams.get("id");
        if (!id) {
          return new Response(JSON.stringify({ error: "Missing paper ID" }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }
        const result = await fetchArxiv({
          id_list: id
        });
        if (!result.entries || result.entries.length === 0) {
          return new Response(JSON.stringify({ error: "Paper not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }
        return new Response(JSON.stringify(result.entries[0]), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      if (pathname === "/api/classics") {
        return new Response(JSON.stringify({ entries: CLASSICS_DATA }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      if (pathname === "/api/trends") {
        return new Response(JSON.stringify({ terms: TREND_TERMS }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      if (pathname === "/api/ai-enabled") {
        return new Response(JSON.stringify({ enabled: false }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      if (pathname === "/api/featured") {
        return new Response(JSON.stringify({ picks: [], aiEnabled: false }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: "Service unavailable",
        message: error.message
      }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  }

  if (pathname === "/sitemap.xml") {
    return new Response(sitemapXml(), {
      status: 200,
      headers: { "Content-Type": "application/xml; charset=utf-8" }
    });
  }

  if (pathname === "/robots.txt") {
    return new Response(robotsTxt(), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }

  if (pathname === "/styles.css" || pathname === "/app.js") {
    const staticUrl = `https://raw.githubusercontent.com/seventies2025/arxiv-tml/main/public${pathname}`;
    const res = await fetch(staticUrl);
    if (!res.ok) {
      return new Response("Not found", { status: 404 });
    }
    const content = await res.text();
    const contentType = pathname.endsWith(".css") ? "text/css; charset=utf-8" : "application/javascript; charset=utf-8";
    return new Response(content, {
      status: 200,
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=3600" }
    });
  }

  if (pathname.startsWith("/icons/")) {
    const staticUrl = `https://raw.githubusercontent.com/seventies2025/arxiv-tml/main/public${pathname}`;
    const res = await fetch(staticUrl);
    if (!res.ok) {
      return new Response("Not found", { status: 404 });
    }
    const content = await res.blob();
    return new Response(content, {
      status: 200,
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" }
    });
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
    const q = url.searchParams.get("q") || "";
    pageMetaInfo = pageMeta("search", { query: q });
  } else if (pathname.startsWith("/paper/")) {
    const id = pathname.split("/")[2];
    pageMetaInfo = pageMeta("paper", { paper: { id } });
  } else if (pathname === "/favorites") {
    pageMetaInfo = pageMeta("favorites");
  } else {
    pageMetaInfo = pageMeta("home");
  }

  return new Response(html("", pageMetaInfo), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}