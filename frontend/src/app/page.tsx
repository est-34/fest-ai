import Link from "next/link";
import { LogIn, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/shared/ui/logo";
import { Badge } from "@/shared/ui/badge";
import { festivalInfo } from "@/entities/festival";
import { FestivalHero } from "@/widgets/landing-hero/festival-hero";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6 py-5">
        <Logo />
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="hidden gap-1.5 sm:inline-flex">
            <ShieldCheck className="size-3.5" />
            {festivalInfo.organizer} 공식 데모
          </Badge>
          {/* 랜딩은 방문객·운영자 두 시나리오의 입구다 — 운영자 진입이 보이지 않으면 입구가 아니다. */}
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <LogIn className="size-4" />
            운영자 로그인
          </Link>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-16 pt-6 lg:pt-10 items-center justify-center"
      >
        <section className="lg:text-center">
          <div className="flex flex-col gap-3 lg:items-center">
            <p className="inline-flex w-fit items-center gap-2 text-sm font-semibold uppercase tracking-[0.1em] text-primary">
              {/* AI(브랜드 블루)와 ESG(그린) 두 축을 한 마크로 — 아이콘은 장식이라 그라데이션 위 대비를 타지 않는다. */}
              <span className="bg-brand-gradient inline-flex size-6 items-center justify-center rounded-full text-white">
                <Sparkles className="size-3.5" />
              </span>
              AI · ESG 기반 지역축제 DX 플랫폼
            </p>
            <h1 className="max-w-xl text-[2rem] font-bold leading-[1.3] tracking-[-0.022em] text-foreground sm:text-[56px]">
              축제 운영의 신뢰를 잇는,
              <br />
              <span className="text-primary">FESTAI</span>
            </h1>
          </div>
        </section>
        <FestivalHero />
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © 2026 F:EST AI. All rights reserved.
      </footer>
    </div>
  );
}
