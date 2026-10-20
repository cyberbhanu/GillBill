import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const actor = await requirePermission("reports");
    const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
    const from = new Date();
    from.setDate(from.getDate() - days);
    const orders = await prisma.order.findMany({
      where: {
        branch: { businessId: actor.businessId },
        status: "COMPLETED",
        completedAt: { gte: from },
      },
      include: { payments: true, items: { include: { product: true } }, customer: true },
      orderBy: { completedAt: "desc" },
    });
    const expenses = await prisma.expense.findMany({
      where: { businessId: actor.businessId, spentAt: { gte: from } },
    });
    const salesPaise = orders.reduce((s, o) => s + o.totalPaise, 0);
    const taxPaise = orders.reduce((s, o) => s + o.taxPaise, 0);
    const cogsPaise = orders.flatMap((o) => o.items).reduce((s, i) => s + Math.round(i.qty * i.product.purchasePaise), 0);
    const expensePaise = expenses.reduce((s, e) => s + e.amountPaise, 0);
    const cashPaise = orders.flatMap((o) => o.payments).filter((p) => p.method === "CASH").reduce((s, p) => s + p.amountPaise, 0);
    return Response.json({
      summary: {
        salesPaise,
        orderCount: orders.length,
        taxPaise,
        cogsPaise,
        grossProfitPaise: salesPaise - cogsPaise,
        netProfitPaise: salesPaise - cogsPaise - expensePaise - taxPaise,
        expensePaise,
        cashPaise,
        outstandingPaise: (await prisma.customer.aggregate({ where: { businessId: actor.businessId }, _sum: { outstandingPaise: true } }))._sum.outstandingPaise ?? 0,
      },
      orders,
      expenses,
    });
  } catch (error) {
    return jsonError(error);
  }
}
