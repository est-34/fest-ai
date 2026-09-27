import { cn } from "@/shared/lib/utils";

interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
  sublabel?: string;
  /** ESG 기능(스탬프 투어 등)의 진행률은 ESG 색으로 채운다. */
  tone?: "primary" | "esg";
}

export function ProgressRing({
  value,
  size = 132,
  strokeWidth = 12,
  className,
  label,
  sublabel,
  tone = "primary",
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-accent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={cn(
            "transition-[stroke-dashoffset] duration-700 ease-out",
            tone === "esg" ? "stroke-esg" : "stroke-primary",
          )}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold tracking-tight text-foreground">
          {label ?? `${Math.round(clamped)}%`}
        </span>
        {sublabel && <span className="mt-0.5 text-xs text-muted-foreground">{sublabel}</span>}
      </div>
    </div>
  );
}
