import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";

export async function GET() {
  try {
    const actor = await requirePermission("pos");
    const tables = await prisma.restaurantTable.findMany({
      where: { branchId: actor.branchId },
      include: { orders: { where: { status: "OPEN" }, include: { items: true } } },
      orderBy: { sortOrder: "asc" },
    });
    return Response.json({ tables });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("settings");
    const { name, seats } = await request.json();
    const table = await prisma.restaurantTable.create({
      data: { branchId: actor.branchId, name, seats: Number(seats ?? 4) },
    });
    return Response.json({ table });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requirePermission("pos");
    const { id, status } = await request.json();
    await prisma.restaurantTable.updateMany({
      where: { id, branchId: actor.branchId },
      data: { status },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
