import { tokenize } from "kuromojin";

const JSON_HEADERS = { "Content-Type": "application/json" };
const KANJI_REGEX = /[㐀-鿿々]/;

/**
 * 将片假名转为平假名
 * @param {string} text
 */
function katakanaToHiragana(text = "") {
    return text.replace(/[ァ-ン]/g, (char) =>
        String.fromCharCode(char.charCodeAt(0) - 0x60)
    );
}

/**
 * 将分词后的结果转换为 ruby 字符串
 * @param {string} text
 */
async function annotateLine(text) {
    const tokens = await tokenize(text);

    return tokens
        .map(({ surface_form = "", reading = "" }) => {
            if (!surface_form) return "";
            if (!KANJI_REGEX.test(surface_form)) return surface_form;
            const furigana = reading ? katakanaToHiragana(reading) : "";
            return `<ruby>${surface_form}<rt>${furigana}</rt></ruby>`;
        })
        .join("");
}

// Netlify function entry
export default async (req, context) => {
    try {
        const { str, mode, to, romajiSystem } = await req.json();

        if (typeof str !== "string" || !str.trim()) {
            return new Response(
                JSON.stringify({ error: "Missing or invalid 'str' field" }),
                { status: 400, headers: JSON_HEADERS }
            );
        }

        if (mode && mode !== "furigana") {
            return new Response(
                JSON.stringify({ error: "Unsupported mode" }),
                { status: 400, headers: JSON_HEADERS }
            );
        }

        if (to && to !== "hiragana") {
            return new Response(
                JSON.stringify({ error: "Unsupported target" }),
                { status: 400, headers: JSON_HEADERS }
            );
        }

        if (romajiSystem && romajiSystem !== "hepburn") {
            return new Response(
                JSON.stringify({ error: "Unsupported romaji system" }),
                { status: 400, headers: JSON_HEADERS }
            );
        }

        const lines = str.split("\n");
        const annotatedLines = await Promise.all(
            lines.map((line) => annotateLine(line))
        );
        const body = annotatedLines.join("\n");

        return new Response(JSON.stringify(body), {
            headers: JSON_HEADERS,
        });
    } catch (err) {
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: JSON_HEADERS }
        );
    }
};
