import { NextRequest } from "next/server";
import { getUserByAddress, createOrGetUser } from "@/services/userService";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return new Response("address required", { status: 400 });

  const user = await getUserByAddress(address);
  return Response.json(user);
}

export async function POST(req: NextRequest) {
  const { address } = await req.json();
  if (!address) return new Response("address required", { status: 400 });

  const user = await createOrGetUser(address);
  return Response.json(user);
}
