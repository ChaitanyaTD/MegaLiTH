import { NextRequest } from "next/server";
import { createHash, randomBytes, createHmac, randomUUID } from "crypto";

const STATE_SECRET = process.env.STATE_SECRET || "default-secret";

function signState(payload: any) {
  const data = JSON.stringify(payload);
  const hmac = createHmac("sha256", STATE_SECRET).update(data).digest("hex");
  return Buffer.from(JSON.stringify({ payload, sig: hmac })).toString("base64url");
}

export async function GET(req: NextRequest) {
  const X_CLIENT_ID = process.env.X_CLIENT_ID!;
  const X_REDIRECT_URI = process.env.X_REDIRECT_URI!;

  const address = req.nextUrl.searchParams.get("address");
  if (!address) return new Response("wallet address required", { status: 400 });

  // PKCE verifier & challenge
  const codeVerifier = randomBytes(64).toString("base64url");
  const hash = createHash("sha256").update(codeVerifier).digest();
  const codeChallenge = Buffer.from(hash).toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const payload = { uuid: randomUUID(), address, codeVerifier };
  const STATE = signState(payload);

  const url = new URL("https://twitter.com/i/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", X_CLIENT_ID);
  url.searchParams.set("redirect_uri", X_REDIRECT_URI);
  url.searchParams.set("scope", "tweet.read users.read follows.read offline.access");
  url.searchParams.set("state", STATE);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return new Response(JSON.stringify({ url: url.toString() }), {
    headers: { "Content-Type": "application/json" },
  });
}
