import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";

const FLOW = ["RECEIVED", "PREPARING", "READY", "SERVED"];

export async function GET() {
  try {
    const actor = await requirePermission("kitchen");
    const tickets = await prisma.kitchenTicket.findMany({
      where: { order: { branchId: actor.branchId }, status: { not: "CANCELLED" } },
      include: { order: { include: { table: true } } },
      orderBy: { createdAt: "asc" },
    });
    return Response.json({ tickets });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("kitchen");
    const { id, status } = await request.json();
    const ticket = await prisma.kitchenTicket.findFirst({
      where: { id, order: { branchId: actor.branchId } },
    });
    if (!ticket) return Response.json({ error: "Ticket not found." }, { status: 404 });
    const next = status && FLOW.includes(status) ? status : FLOW[Math.min(FLOW.indexOf(ticket.status) + 1, FLOW.length - 1)];
    await prisma.kitchenTicket.update({ where: { id }, data: { status: next } });
    await prisma.order.update({ where: { id: ticket.orderId }, data: { kitchenStatus: next } });
    return Response.json({ ok: true, status: next });
  } catch (error) {
    return jsonError(error);
  }
}
