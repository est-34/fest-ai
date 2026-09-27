import type { Locale } from "./locale";

// 문자 종류로 언어를 가른다. 가나가 있으면 일본어, 한글은 한국어, 가나 없는 한자는 중국어.
// ponytail: 음성인식기는 한 번에 한 언어만 듣기 때문에 첫 발화가 다른 언어의 문자로 받아써질 때만 맞는다.
// 정확도가 문제가 되면 서버 언어감지(Google Translate detect)나 다국어 ASR로 올린다.
const SCRIPTS: [RegExp, Locale][] = [
  [/[぀-ヿ]/, "ja"],
  [/[가-힣]/, "ko"],
  [/[一-鿿]/, "zh"],
  [/[a-z]/i, "en"],
];

/** 인식된 첫 발화의 언어. 판별 실패나 미지원 언어면 null — 호출부는 기존 언어를 유지한다. */
export function detectLocale(transcript: string, supported: Locale[]): Locale | null {
  const detected = SCRIPTS.find(([script]) => script.test(transcript))?.[1];
  return detected && supported.includes(detected) ? detected : null;
}
