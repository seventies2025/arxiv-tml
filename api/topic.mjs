export const config = {
  runtime: "edge"
};

import { TOPICS } from "../server/topics.mjs";

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

export default async function handler(req) {
  const url = new URL(req.url);
  const topicId = url.searchParams.get("id");
  const start = Number(url.searchParams.get("start") || 0);
  const max = Number(url.searchParams.get("max") || 20);

  const topic = TOPICS.find((t) => t.id === topicId);
  if (!topic) {
    return new Response(JSON.stringify({ error: "Topic not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const query = new URLSearchParams({
      search_query: topic.query,
      start: String(Math.max(0, start)),
      max_results: String(Math.min(50, Math.max(1, max))),
      sortBy: topic.sort || "submittedDate",
      sortOrder: "descending"
    }).toString();

    const res = await fetch(`${ARXIV_API}?${query}`, {
      headers: { "User-Agent": "arxiv-tml/1.0 (+https://arxiv-tml.vercel.app)" },
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const xml = await res.text();
    const result = parseFeed(xml);

    return new Response(JSON.stringify({
      topic,
      ...result,
      entries: result.entries.map(slimPaper)
    }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Service unavailable",
      message: error.message
    }), {
      status: 503,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}