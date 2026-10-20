import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";
import { rupeesToPaise } from "@/lib/money";

export async function GET() {
  try {
    const actor = await requirePermission("pos");
    const current = await prisma.registerShift.findFirst({
      where: { register: { branchId: actor.branchId }, closedAt: null },
      include: { openedBy: true, register: true },
    });
    const history = await prisma.registerShift.findMany({
      where: { register: { branchId: actor.branchId } },
      include: { openedBy: true, closedBy: true },
      orderBy: { openedAt: "desc" },
      take: 20,
    });
    return Response.json({ current, history });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("pos");
    const body = await request.json();
    const register = await prisma.cashRegister.findFirst({ where: { branchId: actor.branchId } });
    if (!register) return Response.json({ error: "No cash register is configured." }, { status: 400 });

    if (body.action === "open") {
      const open = await prisma.registerShift.findFirst({ where: { registerId: register.id, closedAt: null } });
      if (open) return Response.json({ error: "A shift is already open." }, { status: 400 });
      const shift = await prisma.registerShift.create({
        data: {
          registerId: register.id,
          openedById: actor.userId,
          openingPaise: rupeesToPaise(body.opening ?? 0),
          expectedPaise: rupeesToPaise(body.opening ?? 0),
        },
      });
      return Response.json({ shift });
    }

    if (body.action === "close") {
      const open = await prisma.registerShift.findFirst({ where: { registerId: register.id, closedAt: null } });
      if (!open) return Response.json({ error: "No open shift to close." }, { status: 400 });
      const countedPaise = rupeesToPaise(body.counted ?? 0);
      const shift = await prisma.registerShift.update({
        where: { id: open.id },
        data: {
          closedAt: new Date(),
          closedById: actor.userId,
          countedPaise,
          differencePaise: countedPaise - open.expectedPaise,
          notes: body.notes || null,
        },
      });
      return Response.json({ shift });
    }

    return Response.json({ error: "Unknown shift action." }, { status: 400 });
  } catch (error) {
    return jsonError(error);
  }
}
