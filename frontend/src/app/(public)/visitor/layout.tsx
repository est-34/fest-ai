import type { Metadata } from "next";
import { VisitorShell } from "@/widgets/visitor-layout/visitor-shell";

export const metadata: Metadata = {
  title: "FESTAI | 방문객 모바일 웹",
};

export default function VisitorLayout({ children }: { children: React.ReactNode }) {
  return <VisitorShell>{children}</VisitorShell>;
}
