/**
 * ko.ts를 유일한 원본으로 두고 en/zh/ja 사전을 만든다.
 *
 * 소스 텍스트를 그대로 복사하고 문자열·템플릿 리터럴 안의 한국어만 바꾼다.
 * 구조·주석·타입 주석·함수 본문은 손대지 않으므로 생성물은 ko.ts와 같은 모양이고,
 * 새 문구를 추가할 때 고칠 파일은 ko.ts 하나다.
 *
 * ponytail: TS 파서 대신 리터럴 스캐너를 쓴다 — ko.ts에는 이스케이프·작은따옴표·주석·
 * 중첩 백틱이 없다. 그 전제가 깨지면 assertScannable()이 생성 전에 멈춘다.
 *
 *   GOOGLE_TRANSLATE_API_KEY=... npm run i18n
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const DICTIONARIES = new URL("../src/shared/lib/i18n/dictionaries/", import.meta.url);
const TARGETS = { en: "en", zh: "zh-CN", ja: "ja" };
const HANGUL = /[가-힣]/;
/** Google v2가 한 요청에 받는 q 개수 상한보다 넉넉히 낮게 끊는다. */
const BATCH = 100;

/** 소스에서 문자열/템플릿 리터럴 구간을 찾는다. `${...}` 안은 코드이므로 건너뛴다. */
export function literals(source) {
  const found = [];
  for (let index = 0; index < source.length; index += 1) {
    const quote = source[index];
    if (quote !== '"' && quote !== "`") continue;
    let end = index + 1;
    let depth = 0;
    while (end < source.length) {
      const char = source[end];
      if (quote === "`" && depth === 0 && char === "$" && source[end + 1] === "{") {
        depth += 1;
        end += 2;
        continue;
      }
      if (depth > 0) {
        if (char === "}") depth -= 1;
        end += 1;
        continue;
      }
      if (char === quote) break;
      end += 1;
    }
    found.push({ start: index, end, quote, body: source.slice(index + 1, end) });
    index = end;
  }
  return found;
}

/** `${...}`를 {0},{1}로 빼낸다 — 번역기가 자리표시자를 문장 안에서 옮길 수 있어야 어순이 산다. */
export function toMessage(body) {
  const holes = [];
  const text = body.replace(/\$\{[^}]*\}/g, (hole) => `{${holes.push(hole) - 1}}`);
  return { text, holes };
}

export function fromMessage(text, holes) {
  return text.replace(/\{(\d+)\}/g, (whole, index) => holes[Number(index)] ?? whole);
}

/** 스캐너가 감당하는 소스인지 확인한다. 어긋나면 잘못된 사전을 쓰기 전에 멈춘다. */
export function assertScannable(source) {
  if (source.includes("\\")) throw new Error("ko.ts에 이스케이프가 생겼습니다. 스캐너를 손봐야 합니다.");
  if (/(^|[^:])\/\//.test(source)) throw new Error("ko.ts에 // 주석이 생겼습니다. 스캐너를 손봐야 합니다.");
  for (const { body, quote } of literals(source)) {
    if (quote === "`" && body.includes("`")) throw new Error("중첩 백틱은 지원하지 않습니다.");
  }
}

/** 번역 대상 리터럴만 고른다 — 한국어가 없으면 코드나 기호라 그대로 둔다. */
export function translatable(source) {
  return literals(source).filter(({ body }) => HANGUL.test(body));
}

/** 번역된 텍스트를 원래 자리에 끼워 넣는다. 뒤에서부터 바꿔야 앞쪽 offset이 밀리지 않는다. */
export function rewrite(source, targets, translations) {
  let output = source;
  for (let index = targets.length - 1; index >= 0; index -= 1) {
    const { start, end, holes } = targets[index];
    const body = fromMessage(translations[index], holes);
    output = output.slice(0, start + 1) + body + output.slice(end);
  }
  return output;
}

export function header(locale, koHash) {
  return `// 이 파일은 생성물입니다. 고치지 말고 ko.ts를 고친 뒤 \`npm run i18n\`을 실행하세요.\n`
    + `// ko.ts sha256: ${koHash}\n`
    + `import type { ko } from "./ko";\n\n`
    + `export const ${locale}: typeof ko = {`;
}

export function build(source, locale, translations, targets, koHash) {
  const body = rewrite(source, targets, translations);
  return body.replace("export const ko = {", header(locale, koHash));
}

async function googleTranslate(texts, target) {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_TRANSLATE_API_KEY가 없습니다.");
  const output = [];
  for (let index = 0; index < texts.length; index += BATCH) {
    const chunk = texts.slice(index, index + BATCH);
    const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: chunk, source: "ko", target, format: "text" }),
    });
    if (!response.ok) throw new Error(`Google Translate ${response.status}: ${await response.text()}`);
    const { data } = await response.json();
    output.push(...data.translations.map((item) => item.translatedText));
  }
  return output;
}

export async function generate(translate = googleTranslate) {
  const koPath = new URL("ko.ts", DICTIONARIES);
  const source = await readFile(koPath, "utf8");
  assertScannable(source);

  const koHash = createHash("sha256").update(source).digest("hex").slice(0, 16);
  const targets = translatable(source).map((literal) => ({ ...literal, ...toMessage(literal.body) }));
  const texts = targets.map((target) => target.text);

  for (const [locale, googleCode] of Object.entries(TARGETS)) {
    const translations = await translate(texts, googleCode);
    if (translations.length !== texts.length) throw new Error(`${locale}: 번역 개수가 원문과 다릅니다.`);
    await writeFile(new URL(`${locale}.ts`, DICTIONARIES), build(source, locale, translations, targets, koHash));
    console.log(`${locale}.ts — 문구 ${texts.length}개`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await generate();
