const app = document.getElementById("app");
const toast = document.getElementById("toast");
const siteHeader = document.getElementById("siteHeader");
const headerSearch = document.getElementById("headerSearch");

let currentPath = "";
let favorites = new Set(JSON.parse(localStorage.getItem("favorites") || "[]"));

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, 3000);
}

function toggleFavorite(id, element) {
  if (favorites.has(id)) {
    favorites.delete(id);
    element.textContent = "收藏";
    showToast("已取消收藏");
  } else {
    favorites.add(id);
    element.textContent = "已收藏";
    showToast("已加入收藏");
  }
  localStorage.setItem("favorites", JSON.stringify([...favorites]));
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("已复制到剪贴板");
  }).catch(() => {
    showToast("复制失败");
  });
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function renderArxivId(id, version) {
  const fullId = `${id}${version || ""}`;
  return `<span class="arxiv-id" onclick="copyToClipboard('${fullId}')">${fullId}</span>`;
}

function renderCategory(cat) {
  return `<span class="paper-category">${cat}</span>`;
}

function renderAuthors(authors, more) {
  const html = authors.map(a => `<span>${a}</span>`).join("");
  if (more > 0) {
    return `${html}<span class="more-authors">等 ${more} 人</span>`;
  }
  return html;
}

function renderPaperRow(paper) {
  const isFavorite = favorites.has(paper.id);
  return `
    <div class="paper-row">
      <div class="paper-main">
        <h3 class="paper-title"><a href="/paper/${paper.id}" data-link>${paper.title}</a></h3>
        ${paper.titleZh ? `<p class="paper-title-zh">${paper.titleZh}</p>` : ""}
        <p class="paper-authors">${renderAuthors(paper.authors, paper.authorsMore)}</p>
        <p class="paper-summary">${paper.summary}</p>
        <div class="paper-meta">
          ${renderArxivId(paper.id, paper.version)}
          <span class="paper-date">${formatDate(paper.published)}</span>
          ${renderCategory(paper.primaryCategory)}
        </div>
      </div>
      <div class="paper-actions">
        <button class="action-btn primary" onclick="window.open('${paper.links?.pdf || `https://arxiv.org/pdf/${paper.id}`}', '_blank')">PDF</button>
        <button class="action-btn" onclick="toggleFavorite('${paper.id}', this)">${isFavorite ? "已收藏" : "收藏"}</button>
      </div>
    </div>
  `;
}

function renderFeaturedCard(item, isLead) {
  const paper = item.paper;
  const index = item.index || "";
  return `
    <article class="featured-card ${isLead ? "featured-lead" : ""}">
      <div class="featured-index">${index}</div>
      <h3 class="featured-headline">${item.headline}</h3>
      <p class="featured-title"><a href="/paper/${paper.id}" data-link>${paper.title}</a></p>
      <p class="featured-reason">${item.reason}</p>
      <div class="featured-meta">
        <span class="featured-audience">${item.audience}</span>
        <span class="featured-date">${formatDate(paper.published)}</span>
        ${renderCategory(paper.primaryCategory)}
      </div>
    </article>
  `;
}

function renderTopicCard(topic) {
  return `
    <a href="/topics/${topic.id}" data-link class="topic-card">
      <div class="topic-icon">${topic.icon}</div>
      <h3 class="topic-name">${topic.name}</h3>
      <p class="topic-name-en">${topic.nameEn}</p>
      <p class="topic-desc">${topic.description}</p>
    </a>
  `;
}

function renderClassicItem(item) {
  const typeMap = { paper: "论文", review: "综述", book: "书籍" };
  return `
    <div class="classic-item">
      <div class="classic-year">${item.year}</div>
      <div class="classic-content">
        <h3 class="classic-title">${item.title}<span class="classic-type">${typeMap[item.type] || item.type}</span></h3>
        <p class="classic-title-zh">${item.titleZh}</p>
        <p class="classic-authors">${item.authors.join(", ")}</p>
        <p class="classic-summary">${item.summaryZh}</p>
      </div>
    </div>
  `;
}

async function renderHome() {
  app.innerHTML = `<div class="page-loading"><span></span><span></span><span></span></div>`;
  
  const [featured, topics, latest] = await Promise.all([
    fetchJson("/api/featured"),
    fetchJson("/api/topics"),
    fetchJson("/api/latest?max=10")
  ]);

  let featuredHtml = "";
  if (featured.picks && featured.picks.length > 0) {
    featuredHtml = `
      <section class="featured-section">
        <div class="section-header">
          <h2 class="section-title">今日精选</h2>
        </div>
        <div class="featured-grid">
          ${renderFeaturedCard({ ...featured.picks[0], index: "01" }, true)}
          ${featured.picks.slice(1).map((item, i) => renderFeaturedCard({ ...item, index: String(i + 2).padStart(2, "0") })).join("")}
        </div>
      </section>
    `;
  }

  const topicsHtml = `
    <section class="topics-section">
      <div class="section-header">
        <h2 class="section-title">研究主题</h2>
        <a href="/topics" data-link class="section-more">查看全部 →</a>
      </div>
      <div class="topics-grid">
        ${topics.topics.slice(0, 6).map(renderTopicCard).join("")}
      </div>
    </section>
  `;

  const latestHtml = `
    <section class="latest-section">
      <div class="section-header">
        <h2 class="section-title">最新提交</h2>
      </div>
      <div class="papers-list">
        ${latest.entries.map(renderPaperRow).join("")}
      </div>
    </section>
  `;

  app.innerHTML = featuredHtml + topicsHtml + latestHtml;
}

async function renderTopics() {
  app.innerHTML = `<div class="page-loading"><span></span><span></span><span></span></div>`;
  const { topics } = await fetchJson("/api/topics");
  
  app.innerHTML = `
    <h1 class="page-title">研究主题</h1>
    <p class="page-subtitle">探索理论机器学习与量子机器学习的核心研究方向</p>
    <div class="topics-grid">
      ${topics.map(renderTopicCard).join("")}
    </div>
  `;
}

async function renderTopic(topicId) {
  app.innerHTML = `<div class="page-loading"><span></span><span></span><span></span></div>`;
  const { topic, entries, total } = await fetchJson(`/api/topic?id=${topicId}&max=20`);
  
  if (!topic) {
    app.innerHTML = `<p style="text-align:center;color:var(--ink-3);padding:40px">主题不存在</p>`;
    return;
  }

  app.innerHTML = `
    <div class="topic-header">
      <div class="topic-icon" style="font-size:48px">${topic.icon}</div>
      <h1 class="page-title">${topic.name}</h1>
      <p class="page-subtitle">${topic.nameEn} · ${topic.description}</p>
    </div>
    <div class="papers-list">
      ${entries.map(renderPaperRow).join("")}
    </div>
    ${total > 20 ? `<div class="pagination"><button onclick="loadMoreTopic('${topicId}', 20)">加载更多</button></div>` : ""}
  `;
}

async function renderClassics() {
  app.innerHTML = `<div class="page-loading"><span></span><span></span><span></span></div>`;
  const { entries } = await fetchJson("/api/classics");
  
  app.innerHTML = `
    <h1 class="page-title">经典论文</h1>
    <p class="page-subtitle">理论机器学习与量子机器学习领域的里程碑式著作</p>
    <div class="classics-timeline">
      ${entries.map(renderClassicItem).join("")}
    </div>
  `;
}

async function renderDiscover() {
  app.innerHTML = `
    <div class="discover-page">
      <h1 class="page-title">搜索发现</h1>
      <p class="page-subtitle">用自然语言描述你想找的论文，AI 帮你理解意图</p>
      <div class="discover-search">
        <input type="text" id="discoverInput" placeholder="例如：量子神经网络的最新理论进展...">
        <button onclick="performDiscover()">搜索</button>
        <div class="trend-terms" id="trendTerms"></div>
      </div>
      <div id="discoverResults"></div>
    </div>
  `;
  
  const { terms } = await fetchJson("/api/trends");
  const trendContainer = document.getElementById("trendTerms");
  trendContainer.innerHTML = terms.map(t => `<span class="trend-term" onclick="searchDiscover('${t}')">${t}</span>`).join("");
}

async function searchDiscover(query) {
  document.getElementById("discoverInput").value = query;
  await performDiscover();
}

async function performDiscover() {
  const query = document.getElementById("discoverInput").value.trim();
  if (!query) return;
  
  const resultsContainer = document.getElementById("discoverResults");
  resultsContainer.innerHTML = `<div class="page-loading"><span></span><span></span><span></span></div>`;
  
  const { entries } = await fetchJson(`/api/discover?q=${encodeURIComponent(query)}&max=20`);
  
  if (entries.length === 0) {
    resultsContainer.innerHTML = `<p style="text-align:center;color:var(--ink-3);padding:40px">未找到相关论文</p>`;
    return;
  }
  
  resultsContainer.innerHTML = `
    <h2 class="section-title">搜索结果：${query}</h2>
    <div class="papers-list">
      ${entries.map(renderPaperRow).join("")}
    </div>
  `;
}

async function renderSearch(query) {
  app.innerHTML = `<div class="page-loading"><span></span><span></span><span></span></div>`;
  
  const { entries } = await fetchJson(`/api/search?q=${encodeURIComponent(query)}&max=20`);
  
  app.innerHTML = `
    <h1 class="page-title">搜索结果</h1>
    <p class="page-subtitle">"${query}"</p>
    ${entries.length === 0 ? `<p style="text-align:center;color:var(--ink-3);padding:40px">未找到相关论文</p>` : `
      <div class="papers-list">
        ${entries.map(renderPaperRow).join("")}
      </div>
    `}
  `;
}

async function renderPaper(id) {
  app.innerHTML = `<div class="page-loading"><span></span><span></span><span></span></div>`;
  
  const paper = await fetchJson(`/api/paper?id=${id}`);
  
  if (!paper) {
    app.innerHTML = `<p style="text-align:center;color:var(--ink-3);padding:40px">论文不存在</p>`;
    return;
  }
  
  const isFavorite = favorites.has(paper.id);
  
  app.innerHTML = `
    <div class="paper-detail">
      <div class="paper-detail-main">
        <h1 class="paper-detail-title">${paper.title}</h1>
        ${paper.titleZh ? `<p class="paper-detail-title-zh">${paper.titleZh}</p>` : ""}
        <p class="paper-detail-authors">${paper.authors.join(", ")}</p>
        <div class="paper-detail-meta">
          ${renderArxivId(paper.id, paper.version)}
          <span class="paper-date">${formatDate(paper.published)}</span>
          ${paper.categories.map(renderCategory).join("")}
          ${paper.journalRef ? `<span class="paper-category">${paper.journalRef}</span>` : ""}
        </div>
        <p class="paper-detail-summary">${paper.summary}</p>
        <div class="paper-detail-links">
          <a href="${paper.links?.pdf || `https://arxiv.org/pdf/${paper.id}`}" target="_blank" class="primary">下载 PDF</a>
          <a href="${paper.links?.abs || `https://arxiv.org/abs/${paper.id}`}" target="_blank" class="secondary">arXiv 页面</a>
          <a href="${paper.links?.html || `https://arxiv.org/html/${paper.id}${paper.version || ""}`}" target="_blank" class="secondary">HTML 全文</a>
        </div>
      </div>
      <div class="ai-panel">
        <div class="ai-panel-header">
          <h3 class="ai-panel-title">AI 解读</h3>
          <button class="ai-panel-toggle" onclick="toggleExplain('${paper.id}')">生成解读</button>
        </div>
        <div class="ai-content" id="aiContent"></div>
        <div class="ai-chat">
          <input type="text" id="chatInput" placeholder="追问关于这篇论文的问题...">
          <button onclick="sendChat('${paper.id}')">发送</button>
        </div>
      </div>
    </div>
  `;
}

function toggleExplain(paperId) {
  const content = document.getElementById("aiContent");
  if (content.textContent.includes("AI 解读") || content.classList.contains("ai-loading")) return;
  
  content.textContent = "";
  content.classList.add("ai-loading");
  
  const eventSource = new EventSource(`/sse/explain?id=${paperId}`);
  
  eventSource.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === "delta") {
      content.textContent += data.text;
    } else if (data.type === "done") {
      content.classList.remove("ai-loading");
      eventSource.close();
    } else if (data.type === "error") {
      content.textContent = data.error;
      content.classList.add("ai-error");
      content.classList.remove("ai-loading");
      eventSource.close();
    }
  };
  
  eventSource.onerror = () => {
    content.textContent = "连接中断";
    content.classList.add("ai-error");
    content.classList.remove("ai-loading");
    eventSource.close();
  };
}

async function sendChat(paperId) {
  const input = document.getElementById("chatInput");
  const message = input.value.trim();
  if (!message) return;
  
  const content = document.getElementById("aiContent");
  content.textContent += `\n\nQ: ${message}\nA: `;
  content.classList.add("ai-loading");
  input.value = "";
  
  const turns = [{ role: "user", content: message }];
  
  const res = await fetch(`/sse/chat?id=${paperId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ turns })
  });
  
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") break;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "delta") {
          content.textContent += parsed.text;
        } else if (parsed.type === "done") {
          content.classList.remove("ai-loading");
        } else if (parsed.type === "error") {
          content.textContent += `\n${parsed.error}`;
          content.classList.add("ai-error");
          content.classList.remove("ai-loading");
        }
      } catch {}
    }
  }
  content.classList.remove("ai-loading");
}

function renderFavorites() {
  if (favorites.size === 0) {
    app.innerHTML = `
      <div class="favorites-empty">
        <h2>暂无收藏</h2>
        <p>浏览论文时点击「收藏」按钮添加到这里</p>
      </div>
    `;
    return;
  }
  
  app.innerHTML = `<div class="page-loading"><span></span><span></span><span></span></div>`;
  
  fetchJson(`/api/papers?ids=${[...favorites].join(",")}`).then(({ entries }) => {
    app.innerHTML = `
      <h1 class="page-title">我的收藏</h1>
      <p class="page-subtitle">共 ${entries.length} 篇论文</p>
      <div class="papers-list">
        ${entries.map(renderPaperRow).join("")}
      </div>
    `;
  });
}

function updateNav(path) {
  document.querySelectorAll(".main-nav a").forEach(a => {
    const nav = a.getAttribute("data-nav");
    let active = false;
    
    if (nav === "home" && path === "/") active = true;
    if (nav === "topics" && (path === "/topics" || path.startsWith("/topics/"))) active = true;
    if (nav === "classics" && path === "/classics") active = true;
    if (nav === "discover" && path === "/discover") active = true;
    if (nav === "favorites" && path === "/favorites") active = true;
    
    a.setAttribute("data-nav-active", active ? "true" : "false");
  });
}

async function navigate(path) {
  currentPath = path;
  updateNav(path);
  
  window.history.pushState({ path }, "", path);
  
  if (path === "/") {
    await renderHome();
  } else if (path === "/topics") {
    await renderTopics();
  } else if (path.startsWith("/topics/")) {
    const topicId = path.split("/")[2];
    await renderTopic(topicId);
  } else if (path === "/classics") {
    await renderClassics();
  } else if (path === "/discover") {
    await renderDiscover();
  } else if (path.startsWith("/search")) {
    const url = new URL(path, window.location.origin);
    const q = url.searchParams.get("q") || "";
    await renderSearch(q);
  } else if (path.startsWith("/paper/")) {
    const id = path.split("/")[2];
    await renderPaper(id);
  } else if (path === "/favorites") {
    renderFavorites();
  } else {
    await renderHome();
  }
}

document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-link]");
  if (link) {
    e.preventDefault();
    navigate(link.getAttribute("href"));
  }
});

headerSearch.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = headerSearch.querySelector("input").value.trim();
  if (q) {
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }
});

window.addEventListener("popstate", (e) => {
  if (e.state?.path) {
    navigate(e.state.path);
  }
});

navigate(window.location.pathname + window.location.search);

window.toggleFavorite = toggleFavorite;
window.copyToClipboard = copyToClipboard;
window.searchDiscover = searchDiscover;
window.performDiscover = performDiscover;
window.toggleExplain = toggleExplain;
window.sendChat = sendChat;