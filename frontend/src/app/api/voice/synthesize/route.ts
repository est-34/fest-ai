import { NextResponse } from "next/server";

const MAX_TEXT_LENGTH = 2_000;

function runtimeUrl() {
  return (process.env.VOICE_RUNTIME_URL ?? "").replace(/\/$/, "");
}

export async function POST(request: Request) {
  const url = runtimeUrl();
  if (!url) {
    return NextResponse.json({ error: "VOICE_RUNTIME_NOT_CONFIGURED" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as
    | { text?: unknown; language?: unknown; provider?: unknown }
    | null;

  if (!body || typeof body.text !== "string" || body.text.trim().length === 0 || body.text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "Invalid voice request" }, { status: 400 });
  }

  try {
    const response = await fetch(`${url}/v1/speech/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: body.text,
        language: typeof body.language === "string" ? body.language : "ko-KR",
        provider: "cosyvoice3",
      }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(payload ?? { error: "VOICE_RUNTIME_FAILED" }, { status: response.status });
    }

    return NextResponse.json({ data: payload?.data ?? payload });
  } catch (error) {
    console.error("CosyVoice runtime request failed:", error);
    return NextResponse.json({ error: "VOICE_RUNTIME_UNAVAILABLE" }, { status: 503 });
  }
}
