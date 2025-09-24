import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
const db = prisma as any;

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return new Response("address required", { status: 400 });
  const user = await db.user.findUnique({ where: { address } });
  return new Response(JSON.stringify(user), { status: 200 });
}

export async function POST(req: NextRequest) {
  const { address } = await req.json();
  if (!address) return new Response("address required", { status: 400 });

  const user = await db.user.upsert({
    where: { address },
    update: {},
    create: { address },
  });

  return new Response(JSON.stringify(user), { status: 200 });
}


