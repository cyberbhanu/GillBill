import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { jsonError, requirePermission } from "@/lib/session";

export async function GET() {
  try {
    const actor = await requirePermission("inventory");
    const rows = await prisma.inventoryBalance.findMany({
      where: { branchId: actor.branchId },
      include: { product: { include: { category: true, variants: true } } },
      orderBy: { updatedAt: "desc" },
    });
    const movements = await prisma.stockMovement.findMany({
      where: { branchId: actor.branchId },
      include: { product: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const valuationPaise = rows.reduce((s, r) => s + Math.round(r.qty * r.product.purchasePaise), 0);
    return Response.json({ rows, movements, valuationPaise });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("inventory");
    const { productId, qty, reason, note } = await request.json();
    if (!productId || !qty || !reason) return Response.json({ error: "Product, quantity, and reason are required." }, { status: 400 });
    const delta = Number(qty);
    const current = await prisma.inventoryBalance.findUnique({
      where: { branchId_productId: { branchId: actor.branchId, productId } },
    });
    const next = (current?.qty ?? 0) + delta;
    if (next < 0 && actor.business.preventNegativeStock && !can(actor.role, "adjustStockException")) {
      return Response.json({ error: "Negative stock requires manager authorization." }, { status: 403 });
    }
    await prisma.$transaction([
      current
        ? prisma.inventoryBalance.update({ where: { id: current.id }, data: { qty: next } })
        : prisma.inventoryBalance.create({ data: { branchId: actor.branchId, productId, qty: next } }),
      prisma.stockMovement.create({
        data: {
          branchId: actor.branchId,
          productId,
          qtyDelta: delta,
          reason,
          note: note || null,
          createdBy: actor.userId,
        },
      }),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
