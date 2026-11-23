import axios from "axios";
import Parser from "rss-parser";
import mongoose from "mongoose";
import { News } from "../models/newsModel.js";

const clean = (value) =>
  String(value || "")
    .trim()
    .replace(/^"|"$/g, "");

const NEWS_FALLBACK_IMAGES = {
  AI: [
    "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800&q=80",
    "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&q=80",
    "https://images.unsplash.com/photo-1655720828018-edd2daec9349?w=800&q=80"
  ],
  ML: [
    "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800&q=80",
    "https://images.unsplash.com/photo-1527474305487-b87b222841cc?w=800&q=80",
    "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&q=80"
  ],
  Cybersecurity: [
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80",
    "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=800&q=80",
    "https://images.unsplash.com/photo-1563206767-5b18f218e8de?w=800&q=80"
  ],
  Cloud: [
    "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&q=80",
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80",
    "https://images.unsplash.com/photo-1560732488-6b0df240254a?w=800&q=80"
  ],
  "Web Development": [
    "https://images.unsplash.com/photo-1547658719-da2b51169166?w=800&q=80",
    "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80",
    "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80"
  ],
  Programming: [
    "https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800&q=80",
    "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=800&q=80",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80"
  ],
  Startups: [
    "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&q=80",
    "https://images.unsplash.com/photo-1556761175-4b46a572b786?w=800&q=80",
    "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&q=80"
  ],
  "Data Science": [
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
    "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&q=80"
  ],
  Robotics: [
    "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80",
    "https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=800&q=80",
    "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=800&q=80"
  ],
  _default: [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
    "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&q=80",
    "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80",
    "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80"
  ]
};

function simpleHash(str = "", seed = 0) {
  let hash = seed;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getFallbackImage(category = "", title = "", url = "", index = 0) {
  const normalizedCategory = normalizeCategory(category);
  const pool = NEWS_FALLBACK_IMAGES[normalizedCategory] || NEWS_FALLBACK_IMAGES._default;
  const seed = `${normalizedCategory}|${title}|${url}|${index}`;
  return pool[simpleHash(seed, index) % pool.length];
}

const GNEWS_API_URL =
  clean(process.env.GNEWS_API_URL) || "https://gnews.io/api/v4/search";
const NEWSAPI_URL =
  clean(process.env.NEWSAPI_URL) || "https://newsapi.org/v2/top-headlines";
const HACKER_NEWS_TOPSTORIES_URL =
  "https://hacker-news.firebaseio.com/v0/topstories.json";
const HACKER_NEWS_ITEM_URL =
  "https://hacker-news.firebaseio.com/v0/item";
const TECHCRUNCH_RSS_URL = "https://techcrunch.com/feed/";

let memoryNewsCache = [];
let lastLiveFetchAt = 0;
const NEWS_LIVE_COOLDOWN_MS = 10 * 60 * 1000;
const FEED_CACHE_TTL_MS = 10 * 60 * 1000;
const sourceFeedCache = new Map();

const rssParser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8"
  },
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
      ["content:encoded", "contentEncoded"]
    ]
  }
});

const ALLOWED_TECH_CATEGORIES = new Set([
  "AI",
  "ML",
  "Software Engineering",
  "Programming",
  "Developer Tools",
  "Cloud",
  "Cybersecurity",
  "Web Development",
  "Startups",
  "React",
  "Node.js",
  "Full Stack",
  "Java",
  "C++",
  "Data Science",
  "Data Analytics",
  "Robotics",
  "Open Source"
]);

const TECH_KEYWORDS = [
  "ai",
  "artificial intelligence",
  "machine learning",
  "developer",
  "software",
  "programming",
  "cloud",
  "cybersecurity",
  "react",
  "node",
  "typescript",
  "javascript",
  "open source",
  "startup",
  "kubernetes",
  "docker",
  "api",
  "framework"
];

const EXCLUSION_KEYWORDS = [
  "election",
  "parliament",
  "senate",
  "president",
  "war",
  "celebrity",
  "crime"
];

const CATEGORY_ALIAS = {
  ai: "AI",
  "artificial intelligence": "AI",
  ml: "ML",
  "machine learning": "ML",
  robotics: "Robotics",
  react: "React",
  "node.js": "Node.js",
  nodejs: "Node.js",
  "full stack": "Full Stack",
  fullstack: "Full Stack",
  java: "Java",
  "c++": "C++",
  cpp: "C++",
  "data analytics": "Data Analytics",
  "web development": "Web Development",
  programming: "Programming",
  "data science": "Data Science",
  cloud: "Cloud",
  cybersecurity: "Cybersecurity",
  startups: "Startups",
  "developer tools": "Developer Tools",
  "open source": "Open Source",
  "software engineering": "Software Engineering"
};

const TRUNCATION_MARKER_REGEX = /\s*\[(?:\+)?\d+\s+chars\]\s*$/i;
const TRAILING_ELLIPSIS_REGEX = /\s*(?:\.\.\.|…)\s*$/;
const HTML_ENTITY_MAP = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>'
};

function normalizeCategory(category) {
  if (!category) return "Programming";
  const key = String(category).trim().toLowerCase();
  return CATEGORY_ALIAS[key] || category;
}

function decodeHtmlEntities(text = "") {
  return text.replace(
    /&nbsp;|&amp;|&quot;|&#39;|&lt;|&gt;/g,
    (entity) => HTML_ENTITY_MAP[entity] || entity
  );
}

function stripHtml(text = "") {
  return decodeHtmlEntities(
    text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<\/p>|<\/div>|<\/li>|<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanArticleText(text = "") {
  return String(text || "")
    .replace(TRUNCATION_MARKER_REGEX, "")
    .replace(TRAILING_ELLIPSIS_REGEX, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function getCachedFeed(key) {
  const cached = sourceFeedCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) return null;
  return cached.articles;
}

function setCachedFeed(key, articles) {
  sourceFeedCache.set(key, {
    expiresAt: Date.now() + FEED_CACHE_TTL_MS,
    articles: Array.isArray(articles) ? articles : []
  });
}

function getStaleFeed(key) {
  return sourceFeedCache.get(key)?.articles || [];
}

function canonicalUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "guccounter",
      "ref",
      "fbclid",
      "gclid"
    ].forEach((param) => parsed.searchParams.delete(param));
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return raw.replace(/\/$/, "").toLowerCase();
  }
}

function normalizeTitleForDedupe(title = "") {
  return String(title || "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|and|or|to|of|for|in|on|with|from|by|at)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractImageFromRssItem(item = {}) {
  const candidates = [
    item.enclosure?.url,
    item.mediaContent?.$?.url,
    item.mediaContent?.url,
    item.mediaThumbnail?.$?.url,
    item.mediaThumbnail?.url
  ].filter(Boolean);

  if (candidates[0]) return candidates[0];

  const html = String(item.contentEncoded || item.content || item.summary || "");
  const imageMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imageMatch?.[1] || "";
}

function buildReadableContent(article = {}) {
  const description = cleanArticleText(article.description || "");
  const content = cleanArticleText(article.content || "");

  if (!description) return content;
  if (!content) return description;
  if (content.includes(description)) return content;
  if (description.includes(content)) return description;
  return `${description}\n\n${content}`;
}

function isTruncatedArticleContent(text = "") {
  const cleaned = String(text || "").trim();
  return (
    !cleaned ||
    TRUNCATION_MARKER_REGEX.test(cleaned) ||
    TRAILING_ELLIPSIS_REGEX.test(cleaned)
  );
}

function extractArticleTextFromHtml(html = "") {
  const articleMatch =
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);

  if (articleMatch?.[1]) {
    const articleText = stripHtml(articleMatch[1]);
    if (articleText.length >= 500) return articleText;
  }

  const paragraphMatches = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  const paragraphText = paragraphMatches
    .map((match) => stripHtml(match[1]))
    .filter((text) => text.length >= 80);

  return paragraphText.join("\n\n").trim();
}

async function fetchOriginalArticleContent(url) {
  if (!url) return "";

  let directExtracted = "";
  try {
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      responseType: "text"
    });

    directExtracted = extractArticleTextFromHtml(response.data || "");
    if (directExtracted.length >= 500) return directExtracted;
  } catch {
    /* fall through to reader mirror */
  }

  try {
    const readerResponse = await axios.get(`https://r.jina.ai/${url}`, {
      timeout: 10000,
      headers: {
        Accept: "text/plain"
      },
      responseType: "text"
    });

    const readerText = String(readerResponse.data || "")
      .replace(/^Title:.*$/im, "")
      .replace(/^URL Source:.*$/im, "")
      .replace(/^Published Time:.*$/im, "")
      .replace(/^Markdown Content:\s*/im, "")
      .trim();

    const cleanedReaderText = cleanArticleText(readerText);
    if (cleanedReaderText.length > directExtracted.length) {
      return cleanedReaderText;
    }
  } catch {
    /* non-fatal fallback miss */
  }

  return directExtracted;
}

async function enrichArticleContent(article) {
  if (!article) return article;

  const mergedContent = buildReadableContent(article);
  const needsOriginalFetch =
    article.forceOriginalFetch === true ||
    isTruncatedArticleContent(article.content) ||
    mergedContent.length < 1200;

  if (!needsOriginalFetch || !article.url) {
    return {
      ...article,
      forceOriginalFetch: undefined,
      content: mergedContent
    };
  }

  const originalContent = await fetchOriginalArticleContent(article.url);
  const finalContent =
    originalContent.length > mergedContent.length ? originalContent : mergedContent;

  if (
    article._id &&
    finalContent &&
    finalContent !== article.content &&
    mongoose.Types.ObjectId.isValid(String(article._id))
  ) {
    try {
      await News.findByIdAndUpdate(article._id, { $set: { content: finalContent } });
    } catch {
      /* non-fatal */
    }
  }

  return {
    ...article,
    forceOriginalFetch: undefined,
    content: finalContent || mergedContent
  };
}

function isTechArticle(article) {
  const category = normalizeCategory(article.category);
  if (ALLOWED_TECH_CATEGORIES.has(category)) return true;

  const text = `${article.title || ""} ${article.description || ""} ${article.content || ""}`.toLowerCase();
  if (EXCLUSION_KEYWORDS.some((kw) => text.includes(kw))) return false;
  return TECH_KEYWORDS.some((kw) => text.includes(kw));
}

function filterArticlesByCategory(articles, category) {
  const techOnly = articles.filter(isTechArticle);
  if (!category || String(category).toLowerCase() === "all") {
    return techOnly;
  }
  const requested = normalizeCategory(category);
  return techOnly.filter((a) => normalizeCategory(a.category) === requested);
}

function dedupeByUrl(articles) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const out = [];
  for (const a of articles) {
    const u = canonicalUrl(a.url);
    const titleKey = normalizeTitleForDedupe(a.title);
    const titlePrefix = titleKey.split(" ").slice(0, 12).join(" ");
    if ((u && seenUrls.has(u)) || (titlePrefix && seenTitles.has(titlePrefix))) continue;
    if (u) seenUrls.add(u);
    if (titlePrefix) seenTitles.add(titlePrefix);
    out.push(a);
  }
  return out;
}

function categorizeNews(text) {
  const lower = text.toLowerCase();

  if (lower.includes("open source") || lower.includes("opensource")) return "Open Source";
  if (lower.includes("github") || lower.includes("gitlab") || lower.includes("copilot") || lower.includes("sdk") || lower.includes("developer tool")) return "Developer Tools";
  if (lower.includes("software engineering") || lower.includes("distributed system") || lower.includes("microservice") || lower.includes("architecture")) return "Software Engineering";
  if (lower.includes("c++") || lower.includes(" cpp") || lower.includes("cplusplus")) return "C++";
  if (lower.includes("node.js") || lower.includes("nodejs") || lower.includes(" express") || lower.includes("nestjs")) return "Node.js";
  if (lower.includes("react")) return "React";
  if (lower.includes("full stack") || lower.includes("fullstack") || lower.includes("mern") || lower.includes("mean stack")) return "Full Stack";
  if (lower.includes("robot") || lower.includes("humanoid") || lower.includes("drone")) return "Robotics";
  if (lower.includes("machine learning") || lower.includes(" deep learning") || lower.includes("neural net") || lower.includes(" llm")) return "ML";
  if (lower.includes("artificial intelligence") || lower.includes("openai") || lower.includes("chatgpt") || lower.includes("generative ai") || lower.includes(" ai ")) return "AI";
  if (lower.includes("java ") || lower.includes(" spring") || lower.includes("kotlin")) return "Java";
  if (lower.includes("data analytic") || lower.includes("business intelligence") || lower.includes("bi ") || lower.includes("dashboard")) return "Data Analytics";
  if (lower.includes("javascript") || lower.includes("typescript") || lower.includes("frontend") || lower.includes("html") || lower.includes("css")) return "Web Development";
  if (lower.includes("security") || lower.includes("vulnerability") || lower.includes("cybersecurity") || lower.includes(" zero-day")) return "Cybersecurity";
  if (lower.includes("startup") || lower.includes("founder") || lower.includes("investor") || lower.includes("unicorn")) return "Startups";
  if (lower.includes("python") || lower.includes("golang") || lower.includes("rust") || lower.includes("programming language") || lower.includes("developer")) return "Programming";
  if (lower.includes("cloud") || lower.includes("aws") || lower.includes("kubernetes") || lower.includes("docker") || lower.includes("azure")) return "Cloud";
  if (lower.includes("big data") || lower.includes("data science") || lower.includes("database")) return "Data Science";

  return "Programming";
}

function normalizeArticle(article) {
  const category = normalizeCategory(article.category);
  return {
    ...article,
    category,
    image: article.image || getFallbackImage(category, article.title || "", article.url || ""),
    description: cleanArticleText(article.description || ""),
    content: cleanArticleText(article.content || "")
  };
}

export const fetchGTechNews = async (query = "technology", page = 1) => {
  try {
    const apiKey = clean(process.env.GNEWS_API_KEY);
    if (!apiKey) return [];

    const response = await axios.get(GNEWS_API_URL, {
      params: {
        q: query,
        page,
        max: 25,
        lang: "en",
        token: apiKey
      },
      timeout: 8000
    });

    const articles = response.data.articles || [];

    return articles
      .map((article) =>
        normalizeArticle({
          title: article.title,
          description: article.description,
          content: article.content || article.description,
          author: article.source?.name || "Unknown",
          source: {
            name: article.source?.name || "GNews",
            id: article.source?.name?.toLowerCase().replace(/\s+/g, "-")
          },
          image: article.image,
          url: article.url,
          category: categorizeNews(`${article.title} ${article.description || ""}`),
          publishedAt: new Date(article.publishedAt),
          apiSource: "GNews"
        })
      )
      .filter(isTechArticle);
  } catch {
    return [];
  }
};

export const fetchNewsAPI = async (category = "technology", page = 1) => {
  try {
    const apiKey = clean(process.env.NEWSAPI_KEY);
    if (!apiKey) return [];

    const response = await axios.get(NEWSAPI_URL, {
      params: {
        category,
        page,
        pageSize: 25,
        language: "en",
        apiKey
      },
      timeout: 8000
    });

    const articles = response.data.articles || [];

    return articles
      .map((article) =>
        normalizeArticle({
          title: article.title,
          description: article.description,
          content: article.content || article.description,
          author: article.author || "Unknown",
          source: {
            name: article.source?.name || "NewsAPI",
            id: article.source?.id || ""
          },
          image: article.urlToImage,
          url: article.url,
          category: categorizeNews(`${article.title} ${article.description || ""}`),
          publishedAt: new Date(article.publishedAt),
          apiSource: "NewsAPI"
        })
      )
      .filter(isTechArticle);
  } catch {
    return [];
  }
};

export const fetchHackerNews = async () => {
  const cacheKey = "hacker-news";
  const cached = getCachedFeed(cacheKey);
  if (cached) return cached;

  try {
    const idsResponse = await axios.get(HACKER_NEWS_TOPSTORIES_URL, {
      timeout: 8000
    });

    const storyIds = Array.isArray(idsResponse.data)
      ? idsResponse.data.slice(0, 20)
      : [];

    const stories = await Promise.all(
      storyIds.map(async (id) => {
        try {
          const response = await axios.get(`${HACKER_NEWS_ITEM_URL}/${id}.json`, {
            timeout: 6000
          });
          return response.data;
        } catch {
          return null;
        }
      })
    );

    const articles = stories
      .filter((story) => story?.title && story?.url && story?.time)
      .map((story) => {
        const category = categorizeNews(story.title);
        const hnArticle = {
          id: `hn-${story.id}`,
          title: story.title,
          description: story.text
            ? stripHtml(story.text)
            : `Hacker News: ${story.title}. Discussion with ${story.score || 0} points and ${story.descendants || 0} comments.`,
          content: story.text ? stripHtml(story.text) : story.title,
          author: story.by || "Hacker News",
          source: {
            name: "Hacker News",
            id: "hacker-news"
          },
          image: "",
          url: story.url,
          category,
          publishedAt: new Date(story.time * 1000),
          apiSource: "Hacker News"
        };
        
        return normalizeArticle(hnArticle);
      })
      .filter(isTechArticle);

    setCachedFeed(cacheKey, articles);
    return articles;
  } catch {
    console.error("HN failed:", e.message);
    return getStaleFeed(cacheKey);
  }
};

export const fetchTechCrunchRSS = async () => {
  const cacheKey = "techcrunch-rss";
  const cached = getCachedFeed(cacheKey);
  if (cached) return cached;

  try {
    const feed = await rssParser.parseURL(TECHCRUNCH_RSS_URL);
    const articles = (feed.items || [])
      .slice(0, 15)
      .filter((item) => item?.title && item?.link && (item.pubDate || item.isoDate))
      .map((item) => {
        const rawDescription =
          item.contentSnippet ||
          item.summary ||
          item.content ||
          item.contentEncoded ||
          "";
        const description = cleanArticleText(stripHtml(rawDescription));
        const publishedAt = new Date(item.isoDate || item.pubDate);
        return normalizeArticle({
          id: `techcrunch-${encodeURIComponent(item.guid || item.link)}`,
          title: item.title,
          description,
          content: description,
          author: item.creator || item.author || "TechCrunch",
          source: {
            name: "TechCrunch",
            id: "techcrunch"
          },
          image: extractImageFromRssItem(item),
          url: item.link,
          category: categorizeNews(`${item.title} ${description}`),
          publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
          apiSource: "TechCrunch"
        });
      })
      .filter(isTechArticle);

    setCachedFeed(cacheKey, articles);
    return articles;
    } catch (e) {
    console.error("TechCrunch failed:", e.message);
    return getStaleFeed(cacheKey);
  }
};

export const cacheNewsInDB = async (articles) => {
  if (!articles?.length) return;
  try {
    const operations = articles
      .filter((article) => article?.url)
      .map((article) => ({
        updateOne: {
          filter: { url: article.url },
          update: { $set: normalizeArticle(article) },
          upsert: true
        }
      }));

    if (operations.length > 0) {
      await News.bulkWrite(operations, { ordered: false });
    }
  } catch {
    /* non-fatal */
  }
};

export const getAllNews = async (category = null, limit = 40, skip = 0) => {
  try {
    const query = {};
    // Only show articles from the last 7 days to keep content fresh
    query.publishedAt = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
    if (category && String(category).toLowerCase() !== "all") {
      query.category = normalizeCategory(category);
    }

    const articles = await News.find(query)
      .select('title description content author source image url category publishedAt apiSource')
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit * 2) // Fetch more to allow for filtering
      .lean();

    let filtered = filterArticlesByCategory(articles.map(normalizeArticle), category).slice(0, limit);

    // If fewer than 10 articles, relax the date filter to 30 days as fallback
    if (filtered.length < 10) {
      const relaxedQuery = { publishedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } };
      if (category && String(category).toLowerCase() !== "all") {
        relaxedQuery.category = normalizeCategory(category);
      }
      const relaxed = await News.find(relaxedQuery)
        .select('title description content author source image url category publishedAt apiSource')
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit * 2)
        .lean();
      filtered = filterArticlesByCategory(relaxed.map(normalizeArticle), category).slice(0, limit);
    }

    return filtered;
  } catch {
    return [];
  }
};

export const searchNews = async (searchQuery) => {
  try {
    const articles = await News.find({
      $or: [
        { title: { $regex: searchQuery, $options: "i" } },
        { description: { $regex: searchQuery, $options: "i" } }
      ]
    })
      .select('title description content author source image url category publishedAt apiSource')
      .sort({ publishedAt: -1 })
      .limit(30)
      .lean();

    return articles.map(normalizeArticle).filter(isTechArticle).slice(0, 20);
  } catch {
    return [];
  }
};

export const getNewsById = async (id) => {
  try {
    if (!id) return null;

    let article = null;
    if (String(id).startsWith("url-")) {
      const decodedUrl = decodeURIComponent(String(id).slice(4));
      article = await News.findOne({ url: decodedUrl }).lean();
    } else if (String(id).startsWith("hn-")) {
      const hnId = String(id).slice(3);
      // For Hacker News, we might not have it in DB, so we should fetch it if missing
      article = await News.findOne({ id: id }).lean();
      if (!article) {
        try {
          const response = await axios.get(`${HACKER_NEWS_ITEM_URL}/${hnId}.json`, {
            timeout: 6000
          });
          const story = response.data;
          if (story && story.title) {
            article = normalizeArticle({
              id: `hn-${story.id}`,
              title: story.title,
              description: story.text
                ? stripHtml(story.text)
                : `Hacker News discussion with ${story.score || 0} points.`,
              content: story.text ? stripHtml(story.text) : story.title,
              author: story.by || "Hacker News",
              source: {
                name: "Hacker News",
                id: "hacker-news"
              },
              image: "",
              url: story.url || `https://news.ycombinator.com/item?id=${hnId}`,
              category: categorizeNews(story.title),
              publishedAt: new Date(story.time * 1000),
              apiSource: "Hacker News"
            });
          }
        } catch {
          /* fail through */
        }
      }
    } else if (mongoose.Types.ObjectId.isValid(String(id))) {
      article = await News.findById(id).lean();
    }

    if (!article) return null;
    const hadTruncationMarker =
      TRUNCATION_MARKER_REGEX.test(String(article.content || "")) ||
      TRUNCATION_MARKER_REGEX.test(String(article.description || ""));

    const normalized = normalizeArticle(article);
    if (!isTechArticle(normalized)) return null;
    return enrichArticleContent({
      ...normalized,
      forceOriginalFetch: hadTruncationMarker
    });
  } catch {
    return null;
  }
};

export const mergeNewsFeeds = async (limit = 80) => {
  const [gNews, apiNews, techCrunch, hackerNews] = await Promise.all([
    fetchGTechNews("technology"),
    fetchNewsAPI("technology"),
    fetchTechCrunchRSS(),
    fetchHackerNews()
  ]);

  console.log("News sources → GNews:", gNews.length, "NewsAPI:", apiNews.length, "TechCrunch:", techCrunch.length, "HN:", hackerNews.length);

  return dedupeByUrl([...gNews, ...apiNews, ...techCrunch, ...hackerNews])
    .filter((a) => a.title && a.url && a.publishedAt)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, limit);
};

async function fetchLiveNewsMerged() {
  return mergeNewsFeeds(60);
}

export const getNewsWithFallback = async (
  category = null,
  limit = 40,
  forceLive = false,
  skip = 0
) => {
  const normalizedCat =
    category && String(category).toLowerCase() !== "all"
      ? normalizeCategory(String(category))
      : null;

  const now = Date.now();
  const withinCooldown =
    !forceLive &&
    now - lastLiveFetchAt < NEWS_LIVE_COOLDOWN_MS &&
    memoryNewsCache.length >= 10;

  if (withinCooldown) {
    const filtered = filterArticlesByCategory(memoryNewsCache, normalizedCat);
    if (filtered.length >= Math.min(limit, 5)) {
      return {
        articles: filtered.slice(skip, skip + limit),
        source: "memory",
        rateLimited: false,
        message: null,
        usedFallback: false
      };
    }
  }

  try {
    const live = await fetchLiveNewsMerged();

    if (live.length > 0) {
      lastLiveFetchAt = now;
      await cacheNewsInDB(live);
      memoryNewsCache = live.slice(0, 200);
      const filtered = filterArticlesByCategory(live, normalizedCat);
      return {
        articles: filtered.slice(skip, skip + limit),
        source: "live",
        rateLimited: false,
        message: null,
        usedFallback: false
      };
    }
  } catch {
    /* fall through to cache */
  }

  const dbArticles = await getAllNews(normalizedCat, limit * 3, skip);
  if (dbArticles.length > 0) {
    memoryNewsCache = dbArticles.slice(0, 200);
    return {
      articles: dbArticles.slice(0, limit),
      source: "mongodb",
      rateLimited: true,
      message: null,
      usedFallback: true
    };
  }

  if (memoryNewsCache.length > 0) {
    const filtered = filterArticlesByCategory(memoryNewsCache, normalizedCat);
    if (filtered.length > 0) {
      return {
        articles: filtered.slice(skip, skip + limit),
        source: "memory",
        rateLimited: true,
        message: null,
        usedFallback: true
      };
    }
  }

  return {
    articles: [],
    source: "empty",
    rateLimited: true,
    message: "News temporarily unavailable due to API limit. Please try later.",
    usedFallback: false
  };
};

export const fetchAndCacheNews = async () => {
  try {
    const live = await fetchLiveNewsMerged();
    if (live.length > 0) {
      lastLiveFetchAt = Date.now();
      await cacheNewsInDB(live);
      memoryNewsCache = live.slice(0, 200);
    }
    return { success: true, total: live.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
