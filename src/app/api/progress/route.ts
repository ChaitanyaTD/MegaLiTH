import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
const db = prisma as any;

type Progress = {
  address: string;
  xState?: number;
  tgState?: number;
  refState?: number;
};

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return new Response("address required", { status: 400 });
  const user = await db.user.findUnique({ where: { address } });
  if (!user) return new Response(JSON.stringify(null), { status: 200 });
  const record = await db.userProgress.findUnique({ where: { userId: user.id } });
  return new Response(JSON.stringify(record), { status: 200 });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Progress;
  if (!body?.address) return new Response("address required", { status: 400 });

  // Only proceed if the user already exists; do not create here
  const user = await db.user.findUnique({ where: { address: body.address } });
  if (!user) {
    return new Response("user not found", { status: 404 });
  }

  const upserted = await db.userProgress.upsert({
    where: { userId: user.id },
    update: {
      xState: body.xState ?? undefined,
      tgState: body.tgState ?? undefined,
      refState: body.refState ?? undefined,
    },
    create: {
      userId: user.id,
      xState: body.xState ?? 1,
      tgState: body.tgState ?? 0,
      refState: body.refState ?? 0,
    },
  });

  return new Response(JSON.stringify(upserted), { status: 200 });
}


