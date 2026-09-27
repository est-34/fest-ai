import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";

/**
 * 오픈소스 고지 화면.
 *
 * 배포물에 함께 나가는 서드파티 저작물만 적는다 — 방문객 브라우저로 내려가는 face-api.js
 * 모델 가중치(MIT 고지 의무). 번들에 들어가지 않는 개발 의존성은 여기 대상이 아니다.
 *
 * ponytail: 목록이 짧아 상수 배열 하나로 둔다. 자산이 더 늘면 그때 생성 스크립트를 붙인다.
 * 라이선스 원문은 번역하지 않는 것이 관례라 이 화면만 i18n 사전을 쓰지 않는다.
 */
const NOTICES = [
  {
    name: "face-api.js",
    use: "키오스크 큰 글씨 제안의 얼굴 검출·연령대 추정 모델 (브라우저 내 실행)",
    copyright: ["Copyright (c) Vladimir Mandic", "Copyright (c) 2018 Vincent Muehler"],
    license: "MIT License",
    href: "https://github.com/vladmandic/face-api",
    full: "/models/NOTICE.txt",
  },
];

export default function VisitorLicensesPage() {
  return (
    <div className="px-4 pt-4 pb-8">
      <Link href="/visitor/privacy" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <ArrowLeft className="size-3.5" /> 개인정보 안내
      </Link>
      <h1 className="mt-2 flex items-center gap-2 text-lg font-extrabold text-foreground">
        <Scale className="size-5 text-primary" />
        오픈소스 라이선스
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">
        이 서비스가 함께 배포하는 오픈소스 저작물과 라이선스입니다.
      </p>

      <ul className="mt-4 space-y-3">
        {NOTICES.map((notice) => (
          <li key={notice.name} className="rounded-xl border border-border bg-card p-3">
            <h2 className="text-sm font-bold text-foreground">{notice.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{notice.use}</p>
            {notice.copyright.map((line) => (
              <p key={line} className="mt-1 text-[0.6875rem] text-muted-foreground">{line}</p>
            ))}
            <p className="mt-1 text-[0.6875rem] font-semibold text-foreground">{notice.license}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-[0.6875rem] font-semibold text-primary">
              <a href={notice.href} target="_blank" rel="noreferrer" className="underline">
                라이선스 원문
              </a>
              {notice.full && (
                <a href={notice.full} target="_blank" rel="noreferrer" className="underline">
                  고지 전문
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
