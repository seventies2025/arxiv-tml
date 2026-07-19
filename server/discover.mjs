import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { config } from "./config.mjs";
import { searchPapers as arxivSearch } from "./arxiv.mjs";

const translateDir = path.join(config.storageDir, "translate");

export function aiEnabled() {
  return Boolean(config.deepseekApiKey);
}

function chatUrl() {
  return `${config.deepseekBaseUrl}/v1/chat/completions`;
}

async function deepseekRequest(payload, { timeoutMs = 30000 } = {}) {
  const res = await fetch(chatUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.deepseekApiKey}`
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const error = new Error(`deepseek_http_${res.status}`);
    error.detail = text.slice(0, 300);
    throw error;
  }
  return res;
}

const INTENT_SYSTEM = [
  "你是一个 arXiv 搜索意图理解器。",
  "用户输入中文描述他们想找的论文，你把它转成 arXiv API 的 search_query 语法。",
  "输出规则：",
  "1. 只输出 search_query，不要任何解释、前缀或后缀",
  "2. 用 AND/OR/NOT 组合条件，支持 all:/title:/author:/cat:/",
  "3. 对于理论机器学习和量子机器学习领域，自动包含相关分类（cs.LG, stat.ML, quant-ph, cs.AI）",
  "4. 中文关键词直接用于 all: 字段",
  "5. 如果用户输入的是 arXiv ID，直接输出 id:<id>",
  "示例输入：量子神经网络的最新进展",
  "示例输出：(all:\"quantum neural network\" OR all:\"量子神经网络\") AND (cat:quant-ph OR cat:cs.LG)"
].join("\n");

export async function interpretIntent(query) {
  if (!aiEnabled()) return null;
  try {
    const res = await deepseekRequest({
      model: config.deepseekModel,
      thinking: { type: "disabled" },
      messages: [
        { role: "system", content: INTENT_SYSTEM },
        { role: "user", content: query }
      ],
      max_tokens: 200,
      temperature: 0.1
    });
    const body = await res.json();
    return body.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

const TRANSLATE_SYSTEM = [
  "你是一个学术论文标题翻译器，将英文标题翻译成中文。",
  "要求：",
  "1. 只输出中文翻译，不要任何额外文字",
  "2. 术语准确，保留英文原词（如 Transformer, Neural Network）",
  "3. 翻译要自然流畅，符合中文学术表达习惯",
  "4. 保持标题的专业感和严谨性"
].join("\n");

function translateCacheKey(title) {
  return createHash("sha1").update(String(title)).digest("hex");
}

function translateCacheFile(title) {
  return path.join(translateDir, `${translateCacheKey(title)}.json`);
}

export async function translateTitle(title) {
  if (!aiEnabled()) return null;
  const cacheFile = translateCacheFile(title);
  try {
    const cached = JSON.parse(await readFile(cacheFile, "utf8"));
    if (cached.translation) return cached.translation;
  } catch {}
  try {
    const res = await deepseekRequest({
      model: config.deepseekModel,
      thinking: { type: "disabled" },
      messages: [
        { role: "system", content: TRANSLATE_SYSTEM },
        { role: "user", content: title }
      ],
      max_tokens: 150,
      temperature: 0.1
    });
    const body = await res.json();
    const translation = body.choices?.[0]?.message?.content?.trim() || null;
    if (translation) {
      await mkdir(translateDir, { recursive: true });
      await writeFile(cacheFile, JSON.stringify({ translation }), "utf8").catch(() => {});
    }
    return translation;
  } catch {
    return null;
  }
}

export async function discoverPapers(query, options = {}) {
  const intentQuery = await interpretIntent(query);
  const searchQuery = intentQuery || query;
  const result = await arxivSearch({ q: searchQuery, ...options });
  if (result.entries.length > 0 && aiEnabled()) {
    for (const paper of result.entries) {
      paper.titleZh = await translateTitle(paper.title);
    }
  }
  return { ...result, originalQuery: query, searchQuery };
}