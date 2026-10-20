import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("orders");
    const { id } = await params;
    const order = await prisma.order.findFirst({
      where: { id, branch: { businessId: actor.businessId } },
      include: { items: true, payments: true, customer: true, invoice: true, kitchenTickets: true },
    });
    if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
    return Response.json({ order });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("orders");
    const { id } = await params;
    const { action } = await request.json();
    const order = await prisma.order.findFirst({
      where: { id, branch: { businessId: actor.businessId } },
      include: { invoice: true },
    });
    if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
    if (action === "reprint") {
      await prisma.invoice.update({
        where: { orderId: order.id },
        data: { printCount: { increment: 1 } },
      });
      return Response.json({ ok: true, reprinted: true, invoiceNumber: order.invoiceNumber });
    }
    if (action === "cancel") {
      if (!can(actor.role, "cancelSale")) {
        return Response.json({ error: "A manager must authorize cancellations." }, { status: 403 });
      }
      if (order.status === "CANCELLED") return Response.json({ order });
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      await audit({
        businessId: actor.businessId,
        userId: actor.userId,
        action: "SALE_CANCELLED",
        entity: "Order",
        entityId: order.id,
      });
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return jsonError(error);
  }
}
