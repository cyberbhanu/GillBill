import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";
import { rupeesToPaise } from "@/lib/money";

export async function GET() {
  try {
    const actor = await requirePermission("purchases");
    const purchases = await prisma.purchase.findMany({
      where: { branchId: actor.branchId },
      include: { supplier: true, items: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ purchases });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("purchases");
    const body = await request.json();
    const items = (body.items ?? []) as { productId: string; qty: number; cost: number }[];
    if (!items.length) return Response.json({ error: "Add purchase items." }, { status: 400 });
    const subtotalPaise = items.reduce((s, i) => s + Math.round(i.qty * rupeesToPaise(i.cost)), 0);
    const purchase = await prisma.$transaction(async (tx) => {
      const created = await tx.purchase.create({
        data: {
          branchId: actor.branchId,
          supplierId: body.supplierId || null,
          invoiceNo: body.invoiceNo || null,
          status: body.receive ? "RECEIVED" : "ORDERED",
          paymentStatus: body.paid ? "PAID" : "UNPAID",
          subtotalPaise,
          totalPaise: subtotalPaise,
          paidPaise: body.paid ? subtotalPaise : 0,
          receivedAt: body.receive ? new Date() : null,
          notes: body.notes || null,
          items: {
            create: items.map((i) => ({
              productId: i.productId,
              qty: Number(i.qty),
              costPaise: rupeesToPaise(i.cost),
            })),
          },
        },
        include: { items: true, supplier: true },
      });
      if (body.receive) {
        for (const item of created.items) {
          const current = await tx.inventoryBalance.findUnique({
            where: { branchId_productId: { branchId: actor.branchId, productId: item.productId } },
          });
          if (current) await tx.inventoryBalance.update({ where: { id: current.id }, data: { qty: { increment: item.qty } } });
          else await tx.inventoryBalance.create({ data: { branchId: actor.branchId, productId: item.productId, qty: item.qty } });
          await tx.product.update({ where: { id: item.productId }, data: { purchasePaise: item.costPaise } });
          await tx.stockMovement.create({
            data: {
              branchId: actor.branchId,
              productId: item.productId,
              qtyDelta: item.qty,
              reason: "PURCHASE",
              refType: "PURCHASE",
              refId: created.id,
              createdBy: actor.userId,
            },
          });
        }
      }
      return created;
    });
    return Response.json({ purchase });
  } catch (error) {
    return jsonError(error);
  }
}
