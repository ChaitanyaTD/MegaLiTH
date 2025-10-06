import { NextRequest } from "next/server";
import { getUserByAddress } from "@/services/userService";
import { getProgress, upsertProgress } from "@/services/progressService";

// Helper to safely stringify BigInts
function toSafeJSON(obj: any) {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return new Response("address required", { status: 400 });

  const progress = await getProgress(address);
  return Response.json(toSafeJSON(progress));
}

export async function POST(req: NextRequest) {
  const { address, xState, tgState, refState } = await req.json();
  if (!address) return new Response("address required", { status: 400 });

  const user = await getUserByAddress(address);
  if (!user) return new Response("user not found", { status: 404 });

  const updated = await upsertProgress(user.id, { xState, tgState, refState });
  return Response.json(toSafeJSON(updated));
}
