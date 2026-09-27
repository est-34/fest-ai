"use client";

import type { ReactNode } from "react";
import { QrCode as QrCodeIcon } from "lucide-react";
import { QrCode } from "@/shared/ui/qr-code";

export function VisitorCodeCard({ code, text, helper }: {
  code: string;
  text: { codeLabel: string; qrAlt: string; myCodeLabel: string; codeGenerating: string };
  helper: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-esg/30 bg-esg/5 p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-esg-text">
        <QrCodeIcon className="size-4" /> {text.codeLabel}
      </div>
      <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-dashed border-esg/40 bg-background p-5">
        {code && <QrCode value={code} size={190} alt={text.qrAlt} />}
        <div className="text-center">
          <p className="text-[11px] text-muted-foreground">{text.myCodeLabel}</p>
          <p className="mt-1 break-all font-mono text-sm font-extrabold tracking-wide text-esg-text">{code || text.codeGenerating}</p>
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{helper}</p>
        </div>
      </div>
    </section>
  );
}
