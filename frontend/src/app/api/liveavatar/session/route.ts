import { NextResponse } from "next/server";

const LIVEAVATAR_TOKEN_URL = "https://api.liveavatar.com/v1/sessions/token";
const DEFAULT_AVATAR_ID = "";

function isTruthy(value: string | undefined) {
  return value === "1" || value === "true" || value === "TRUE";
}

function allowClientApiKey() {
  return process.env.NODE_ENV !== "production" || isTruthy(process.env.LIVEAVATAR_ALLOW_CLIENT_KEY);
}

function configured() {
  return Boolean(process.env.LIVEAVATAR_API_KEY && (process.env.LIVEAVATAR_AVATAR_ID || DEFAULT_AVATAR_ID));
}

export function GET() {
  return NextResponse.json({
    configured: configured(),
    allowClientApiKey: allowClientApiKey(),
    sandbox: process.env.LIVEAVATAR_SANDBOX !== "false",
    language: "ko",
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        apiKey?: unknown;
        avatarId?: unknown;
        sandbox?: unknown;
      }
    | null;

  const bodyApiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  const bodyAvatarId = typeof body?.avatarId === "string" ? body.avatarId.trim() : "";
  const apiKey = process.env.LIVEAVATAR_API_KEY?.trim() || (allowClientApiKey() ? bodyApiKey : "");
  const avatarId = process.env.LIVEAVATAR_AVATAR_ID?.trim() || bodyAvatarId || DEFAULT_AVATAR_ID;

  if (!apiKey) {
    return NextResponse.json({ error: "LIVEAVATAR_API_KEY_REQUIRED" }, { status: 400 });
  }
  if (!avatarId) {
    return NextResponse.json({ error: "LIVEAVATAR_AVATAR_ID_REQUIRED" }, { status: 400 });
  }

  const sandbox = typeof body?.sandbox === "boolean"
    ? body.sandbox
    : process.env.LIVEAVATAR_SANDBOX !== "false";

  const avatarPersona: Record<string, unknown> = { language: "ko" };
  if (process.env.LIVEAVATAR_VOICE_ID) avatarPersona.voice_id = process.env.LIVEAVATAR_VOICE_ID;
  if (process.env.LIVEAVATAR_CONTEXT_ID) avatarPersona.context_id = process.env.LIVEAVATAR_CONTEXT_ID;

  const payload = {
    avatar_id: avatarId,
    mode: "FULL",
    is_sandbox: sandbox,
    video_settings: { quality: "high", encoding: "H264" },
    max_session_duration: 60,
    avatar_persona: avatarPersona,
    interactivity_type: "CONVERSATIONAL",
  };

  try {
    const response = await fetch(LIVEAVATAR_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const result = (await response.json().catch(() => null)) as
      | { data?: { session_token?: string }; message?: string }
      | null;

    if (!response.ok || !result?.data?.session_token) {
      return NextResponse.json(
        { error: "LIVEAVATAR_TOKEN_FAILED", message: result?.message ?? "LiveAvatar session token was not returned" },
        { status: response.ok ? 502 : response.status },
      );
    }

    return NextResponse.json({ sessionToken: result.data.session_token, language: "ko", sandbox });
  } catch (error) {
    console.error("LiveAvatar session token request failed:", error);
    return NextResponse.json({ error: "LIVEAVATAR_UNAVAILABLE" }, { status: 503 });
  }
}
