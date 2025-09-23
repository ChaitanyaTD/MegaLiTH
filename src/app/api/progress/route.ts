import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

type Progress = {
  address: string;
  xState?: number;
  tgState?: number;
  refState?: number;
};

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return new Response("address required", { status: 400 });
  const record = await prisma.userProgress.findUnique({ where: { address } });
  if (!record) return new Response(JSON.stringify(null), { status: 200 });
  return new Response(JSON.stringify(record), { status: 200 });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Progress;
  if (!body?.address) return new Response("address required", { status: 400 });

  const upserted = await prisma.userProgress.upsert({
    where: { address: body.address },
    update: {
      xState: body.xState ?? undefined,
      tgState: body.tgState ?? undefined,
      refState: body.refState ?? undefined,
    },
    create: {
      address: body.address,
      xState: body.xState ?? 1,
      tgState: body.tgState ?? 0,
      refState: body.refState ?? 0,
    },
  });

  return new Response(JSON.stringify(upserted), { status: 200 });
}


