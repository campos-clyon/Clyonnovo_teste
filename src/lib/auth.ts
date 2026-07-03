import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getUserByOpenId, upsertUser } from "./db";
import { ENV } from "./env";

export const COOKIE_NAME = "manus_session";
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function getSecretKey() {
  const secret = ENV.cookieSecret;
  if (!secret) throw new Error("JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(openId: string, name: string): Promise<string> {
  const secretKey = getSecretKey();
  const expiresAt = Math.floor((Date.now() + ONE_YEAR_MS) / 1000);
  return new SignJWT({ openId, appId: ENV.appId, name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expiresAt)
    .sign(secretKey);
}

export async function verifySession(token: string | undefined | null) {
  if (!token) return null;
  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
    const { openId, appId, name } = payload as Record<string, unknown>;
    if (typeof openId !== "string" || typeof appId !== "string" || typeof name !== "string") return null;
    return { openId, appId, name };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;
  const session = await verifySession(sessionCookie);
  if (!session) return null;
  const user = await getUserByOpenId(session.openId);
  return user ?? null;
}

// OAuth helpers
export async function exchangeCodeForToken(code: string, state: string) {
  const response = await fetch(`${ENV.oAuthServerUrl}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, state, appId: ENV.appId }),
  });
  if (!response.ok) throw new Error("Failed to exchange code for token");
  return response.json() as Promise<{ accessToken: string }>;
}

export async function getUserInfo(accessToken: string) {
  const response = await fetch(`${ENV.oAuthServerUrl}/api/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Failed to get user info");
  return response.json() as Promise<{
    openId: string;
    name?: string;
    email?: string;
    loginMethod?: string;
    platform?: string;
  }>;
}

export function getLoginUrl(redirectPath = "/") {
  const params = new URLSearchParams({
    appId: ENV.appId,
    redirectUri: `${ENV.oAuthPortalUrl}/api/oauth/callback`,
    state: Buffer.from(JSON.stringify({ redirectPath })).toString("base64"),
  });
  return `${ENV.oAuthPortalUrl}/login?${params.toString()}`;
}
