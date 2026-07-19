import { config } from "./config.mjs";
import { TOPICS } from "./topics.mjs";

export function pageMeta(page, data = {}) {
  const base = config.publicBaseUrl;
  let title = "arXiv-TML — 理论机器学习与量子机器学习学术资源";
  let description = "专注于理论机器学习与量子机器学习领域的学术资源整合平台，提供论文检索、AI解读、经典论文收藏等功能";
  let canonical = `${base}/`;
  switch (page) {
    case "home":
      title = "arXiv-TML — 理论机器学习与量子机器学习学术资源";
      description = "每日精选理论机器学习与量子机器学习领域最新论文，AI解读、主题策展、经典论文收藏";
      canonical = `${base}/`;
      break;
    case "topics":
      title = "主题策展 — arXiv-TML";
      description = "探索理论机器学习与量子机器学习的核心研究方向";
      canonical = `${base}/topics`;
      break;
    case "topic":
      title = `${data.topic?.name || "主题"} — arXiv-TML`;
      description = data.topic?.description || "探索该主题下的最新研究论文";
      canonical = `${base}/topics/${data.topic?.id}`;
      break;
    case "classics":
      title = "经典论文 — arXiv-TML";
      description = "理论机器学习与量子机器学习领域的经典论文收藏";
      canonical = `${base}/classics`;
      break;
    case "discover":
      title = "搜索发现 — arXiv-TML";
      description = "搜索理论机器学习与量子机器学习领域的学术论文";
      canonical = `${base}/discover`;
      break;
    case "search":
      title = `搜索结果: ${data.query || ""} — arXiv-TML`;
      description = `搜索「${data.query || ""}」的结果`;
      canonical = data.query ? `${base}/search?q=${encodeURIComponent(data.query)}` : `${base}/search`;
      break;
    case "paper":
      title = `${data.paper?.title || "论文"} — arXiv-TML`;
      description = data.paper?.summary?.slice(0, 150) || "论文详情";
      canonical = `${base}/paper/${data.paper?.id}`;
      break;
    case "favorites":
      title = "我的收藏 — arXiv-TML";
      description = "收藏的理论机器学习与量子机器学习论文";
      canonical = `${base}/favorites`;
      break;
  }
  return {
    title: `${title}`,
    description: description.replace(/\n/g, " ").slice(0, 200),
    canonical,
    ogTitle: title,
    ogDescription: description.replace(/\n/g, " ").slice(0, 200),
    ogUrl: canonical
  };
}

export function sitemapXml() {
  const base = config.publicBaseUrl;
  const entries = [
    { loc: "/", changefreq: "daily", priority: "1.0" },
    { loc: "/topics", changefreq: "weekly", priority: "0.9" },
    { loc: "/classics", changefreq: "monthly", priority: "0.8" },
    { loc: "/discover", changefreq: "weekly", priority: "0.8" },
    { loc: "/favorites", changefreq: "daily", priority: "0.6" }
  ];
  for (const topic of TOPICS) {
    entries.push({ loc: `/topics/${topic.id}`, changefreq: "daily", priority: "0.85" });
  }
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((e) => `  <url><loc>${base}${e.loc}</loc><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`),
    '</urlset>'
  ].join("\n");
  return xml;
}

export function robotsTxt() {
  const base = config.publicBaseUrl;
  return [
    "User-agent: *",
    "Allow: /",
    `Sitemap: ${base}/sitemap.xml`,
    "",
    "Disallow: /api/",
    "Disallow: /storage/"
  ].join("\n");
}