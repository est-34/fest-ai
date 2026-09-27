"use client";

import { useReusableVisitorCode } from "@/features/reusable-containers";
import { VisitorEsgHeader } from "@/features/esg/ui/visitor-esg-header";
import { useTranslation } from "@/shared/lib/i18n";
import { VisitorCodeCard } from "@/features/esg/ui/visitor-code-card";

export default function EsgRentPage() {
  const { t } = useTranslation();
  const visitorCode = useReusableVisitorCode();

  return (
    <div className="px-4 pt-4 pb-6">
      <VisitorEsgHeader title={t.esg.rent.title} description={t.esg.rent.subtitle} />

      <VisitorCodeCard code={visitorCode} text={t.esg.rent} helper={t.esg.rent.helper} />

      <div className="mt-4 rounded-xl border border-border bg-card p-3 text-[11px] leading-4 text-muted-foreground">
        {t.esg.rent.footerNoticePrefix}<strong className="text-foreground">{t.esg.reusable.statusTitle}</strong>{t.esg.rent.footerNoticeSuffix}
      </div>
    </div>
  );
}
