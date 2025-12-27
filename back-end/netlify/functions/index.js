import { getTokenizer } from "kuromojin";

// ============================================
// 优化 1: 全局缓存 Tokenizer（最关键优化）
// ============================================
// kuromoji/kuromojin 的字典很大，每次函数冷启动都要加载和解压
// 全局缓存可以避免每次调用都重复加载字典
let tokenizerPromise = null;

async function getCachedTokenizer() {
    if (!tokenizerPromise) {
        // 优化 2: 使用 CDN 托管字典（可选，减少函数包体积）
        // 如果使用 CDN，取消下面的注释并配置 dicPath
        // tokenizerPromise = getTokenizer({
        //     dicPath: "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict"
        // });
        
        // 默认使用本地字典（如果已打包在函数中）
        tokenizerPromise = getTokenizer();
    }
    return tokenizerPromise;
}

// ============================================
// 优化 3: 文本缓存（避免重复 tokenize 同样文本）
// ============================================
const textCache = new Map();
const MAX_CACHE_SIZE = 1000; // 限制缓存大小，避免内存无限增长

function getCachedResult(text) {
    return textCache.get(text);
}

function setCachedResult(text, result) {
    // 简单的 LRU：如果缓存过大，删除最旧的条目
    if (textCache.size >= MAX_CACHE_SIZE) {
        const firstKey = textCache.keys().next().value;
        textCache.delete(firstKey);
    }
    textCache.set(text, result);
}

/**
 * 给句子的汉字加注音（返回 surface 和 reading）
 * @param {string} text
 * @returns {Promise<Array<{surface: string, reading: string}>>}
 */
async function annotateReading(text) {
    // 检查缓存
    const cached = getCachedResult(text);
    if (cached) {
        return cached;
    }

    // 使用缓存的 tokenizer
    const tokenizer = await getCachedTokenizer();
    const tokens = tokenizer.tokenize(text);

    const result = tokens.map(t => ({
        surface: t.surface_form,
        reading: t.reading || ""
    }));

    // 保存到缓存
    setCachedResult(text, result);
    return result;
}

// Netlify function entry
export default async (req, context) => {
    try {
        const { text } = await req.json();

        if (!text) {
            return new Response(
                JSON.stringify({ error: "Missing 'text' field" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // 优化 4: 文本预处理（去除无用字符，降低内存占用）
        const cleanedText = text.trim();

        if (!cleanedText) {
            return new Response(
                JSON.stringify({ error: "Text cannot be empty" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const result = await annotateReading(cleanedText);

        return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (err) {
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
};
