import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { assertScannable, build, fromMessage, literals, rewrite, toMessage, translatable }
  from "../scripts/build-dictionaries.mjs";

const dictionary = (name) => new URL(`../src/shared/lib/i18n/dictionaries/${name}.ts`, import.meta.url);
const ko = await readFile(dictionary("ko"), "utf8");

test("스캐너는 문자열·템플릿 리터럴만 집고 ${...} 안의 코드는 건너뛴다", () => {
  const source = 'a: "값", b: (n: number) => `${n + 1}개 남음`,';
  assert.deepEqual(literals(source).map((item) => item.body), ["값", "${n + 1}개 남음"]);
});

test("자리표시자는 번역에 넘길 때 빠지고 어순이 바뀌어도 되돌아온다", () => {
  const { text, holes } = toMessage("총 ${minutes}분 · ${title}");
  assert.equal(text, "총 {0}분 · {1}");
  assert.equal(fromMessage("{1} takes {0} minutes", holes), "${title} takes ${minutes} minutes");
});

test("ko.ts는 스캐너가 감당하는 형태다", () => {
  assertScannable(ko);
});

// 번역기만 빼고 전 과정을 돌린다 — 원문을 그대로 돌려주면 ko.ts가 한 글자도 달라지면 안 된다.
test("원문을 그대로 번역하면 ko.ts가 byte 단위로 복원된다", () => {
  const targets = translatable(ko).map((literal) => ({ ...literal, ...toMessage(literal.body) }));
  assert.ok(targets.length > 300, `번역 대상이 너무 적습니다: ${targets.length}`);
  assert.equal(rewrite(ko, targets, targets.map((target) => target.text)), ko);
});

test("생성물 헤더는 typeof ko로 묶여 키 누락이 컴파일 단계에서 걸린다", () => {
  const targets = translatable(ko).map((literal) => ({ ...literal, ...toMessage(literal.body) }));
  const output = build(ko, "en", targets.map((target) => target.text), targets, "deadbeef");
  assert.match(output, /export const en: typeof ko = \{/);
  assert.match(output, /import type \{ ko \} from "\.\/ko";/);
  assert.doesNotMatch(output, /export const ko = \{/);
});

// ko.ts만 고치고 `npm run i18n`을 잊으면 en/zh/ja가 조용히 낡는다. 그 상태를 여기서 깬다.
test("생성된 사전은 현재 ko.ts에서 나온 것이다", async () => {
  const expected = createHash("sha256").update(ko).digest("hex").slice(0, 16);
  for (const locale of ["en", "zh", "ja"]) {
    const source = await readFile(dictionary(locale), "utf8");
    const recorded = source.match(/ko\.ts sha256: ([0-9a-f]+)/)?.[1];
    assert.equal(recorded, expected, `${locale}.ts가 낡았습니다. \`npm run i18n\`을 실행하세요.`);
  }
});
