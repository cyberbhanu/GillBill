import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";

export async function GET() {
  try {
    const actor = await requirePermission("pos");
    const drafts = await prisma.order.findMany({
      where: { branchId: actor.branchId, status: "HELD" },
      include: { items: true },
      orderBy: { heldAt: "desc" },
    });
    return Response.json({ drafts });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("pos");
    const body = await request.json();
    const draft = await prisma.order.create({
      data: {
        branchId: actor.branchId,
        cashierId: actor.userId,
        customerId: body.customerId || null,
        status: "HELD",
        fulfillment: body.fulfillment ?? "WALK_IN",
        notes: body.notes,
        heldAt: new Date(),
        clientNonce: `hold-${crypto.randomUUID()}`,
        items: {
          create: (body.items ?? []).map((item: { productId: string; name: string; qty: number; unitPaise: number; variantId?: string }) => ({
            productId: item.productId,
            variantId: item.variantId,
            name: item.name,
            qty: item.qty,
            unitPaise: item.unitPaise,
            linePaise: Math.round(item.qty * item.unitPaise),
          })),
        },
      },
      include: { items: true },
    });
    return Response.json({ draft });
  } catch (error) {
    return jsonError(error);
  }
}
