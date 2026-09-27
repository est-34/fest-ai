import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FESTAI | AI·ESG 기반 지역축제 DX 플랫폼",
  description:
    "FESTAI는 AI 축제 안내, 통합 운영관리, 방문객 QR 모바일 웹, ESG 성과관리를 하나로 연결하는 지역축제 디지털 전환(DX) 플랫폼 데모입니다.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 하단 탭바가 아이폰 홈 인디케이터와 겹치지 않으려면 safe-area 값을 받아야 한다.
  viewportFit: "cover",
  themeColor: "#0147FF",
};

/**
 * 접근성 설정은 zustand persist(localStorage)라 하이드레이션 뒤에야 반영된다 —
 * 고대비·큰 글씨 사용자가 매번 기본 화면을 한 번 보고 나서 바뀌는 깜빡임을 없애려고
 * 첫 페인트 전에 같은 값을 직접 읽어 붙인다.
 */
const THEME_SCRIPT = `(function(){try{
var d=document.documentElement;
var s=JSON.parse(localStorage.getItem("festai-accessibility")||"{}").state||{};
d.dataset.largeText=String(!!s.largeText);
d.dataset.highContrast=String(!!s.highContrast);
if(s.language)d.lang=s.language;
}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* 키보드·스크린리더 사용자가 매 페이지마다 내비게이션을 지나치지 않아도 되게 한다. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
        >
          본문 바로가기
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
