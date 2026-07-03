import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  getUserInfo,
  createSessionToken,
  COOKIE_NAME,
  ONE_YEAR_MS,
} from "@/lib/auth";
import { upsertUser } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json({ error: "code and state are required" }, { status: 400 });
  }

  try {
    const { accessToken } = await exchangeCodeForToken(code, state);
    const userInfo = await getUserInfo(accessToken);

    if (!userInfo.openId) {
      return NextResponse.json({ error: "openId missing" }, { status: 400 });
    }

    await upsertUser({
      openId: userInfo.openId,
      name: userInfo.name ?? null,
      email: userInfo.email ?? null,
      loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
      lastSignedIn: new Date(),
    });

    const sessionToken = await createSessionToken(userInfo.openId, userInfo.name ?? "");

    // Determinar redirect
    let redirectPath = "/";
    try {
      const stateData = JSON.parse(Buffer.from(state, "base64").toString());
      if (stateData.redirectPath) redirectPath = stateData.redirectPath;
    } catch {}

    const response = NextResponse.redirect(new URL(redirectPath, req.url));
    const isSecure = req.headers.get("x-forwarded-proto") === "https" || req.url.startsWith("https");

    response.cookies.set(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: isSecure,
      maxAge: ONE_YEAR_MS / 1000,
    });

    return response;
  } catch (error) {
    console.error("[OAuth] Callback failed", error);
    return NextResponse.json({ error: "OAuth callback failed" }, { status: 500 });
  }
}
