import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function GET() {
  try {
    const actor = await requirePermission("dashboard");
    const today = startOfDay();
    const whereBranch = actor.business.shareDataAcrossBranches
      ? { branch: { businessId: actor.businessId } }
      : { branchId: actor.branchId };

    const paidOrders = await prisma.order.findMany({
      where: { ...whereBranch, status: "COMPLETED", completedAt: { gte: today } },
      include: { payments: true, items: { include: { product: true } } },
    });

    const salesPaise = paidOrders.reduce((s, o) => s + o.totalPaise, 0);
    const cashPaise = paidOrders.flatMap((o) => o.payments).filter((p) => p.method === "CASH" && p.status === "CAPTURED").reduce((s, p) => s + p.amountPaise, 0);
    const upiPaise = paidOrders.flatMap((o) => o.payments).filter((p) => p.method === "UPI" && p.status === "CAPTURED").reduce((s, p) => s + p.amountPaise, 0);
    const cardPaise = paidOrders.flatMap((o) => o.payments).filter((p) => ["CARD", "CREDIT_CARD", "DEBIT_CARD"].includes(p.method) && p.status === "CAPTURED").reduce((s, p) => s + p.amountPaise, 0);
    const cogsPaise = paidOrders.flatMap((o) => o.items).reduce((s, i) => s + Math.round(i.qty * i.product.purchasePaise), 0);
    const taxPaise = paidOrders.reduce((s, o) => s + o.taxPaise, 0);
    const grossProfitPaise = salesPaise - cogsPaise;
    const expensesToday = await prisma.expense.aggregate({
      where: { businessId: actor.businessId, spentAt: { gte: today } },
      _sum: { amountPaise: true },
    });
    const netProfitPaise = grossProfitPaise - (expensesToday._sum.amountPaise ?? 0) - taxPaise;
    const credit = await prisma.customer.aggregate({
      where: { businessId: actor.businessId },
      _sum: { outstandingPaise: true },
    });
    const products = await prisma.product.count({ where: { businessId: actor.businessId, isActive: true } });
    const balances = await prisma.inventoryBalance.findMany({
      where: { branchId: actor.branchId },
      include: { product: true },
    });
    const lowStock = balances.filter((b) => b.product.trackStock && b.qty > 0 && b.qty <= b.product.minStock).length;
    const outOfStock = balances.filter((b) => b.product.trackStock && b.qty <= 0).length;
    const refunds = await prisma.refund.aggregate({
      where: { order: { ...whereBranch }, createdAt: { gte: today } },
      _sum: { amountPaise: true },
      _count: true,
    });
    const pendingKitchen = await prisma.kitchenTicket.count({
      where: { order: { branchId: actor.branchId }, status: { in: ["RECEIVED", "PREPARING"] } },
    });
    const activeBookings = actor.business.hotelEnabled
      ? await prisma.roomBooking.count({ where: { room: { branchId: actor.branchId }, status: { in: ["RESERVED", "CHECKED_IN"] } } })
      : 0;
    const rooms = actor.business.hotelEnabled ? await prisma.room.count({ where: { branchId: actor.branchId } }) : 0;

    const since = startOfDay();
    since.setDate(since.getDate() - 13);
    const periodOrders = await prisma.order.findMany({
      where: { ...whereBranch, status: "COMPLETED", completedAt: { gte: since } },
      include: { items: { include: { product: { include: { category: true } } } }, payments: true },
    });

    const dailyMap = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = startOfDay();
      d.setDate(d.getDate() - i);
      dailyMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const order of periodOrders) {
      const key = (order.completedAt ?? order.createdAt).toISOString().slice(0, 10);
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + order.totalPaise);
    }

    const productSales = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();
    const categorySales = new Map<string, number>();
    const methodSales = new Map<string, number>();
    const hourly = Array.from({ length: 24 }, () => 0);
    for (const order of periodOrders) {
      const hour = (order.completedAt ?? order.createdAt).getHours();
      hourly[hour] += order.totalPaise;
      for (const item of order.items) {
        const current = productSales.get(item.productId) ?? { name: item.name, qty: 0, revenue: 0, profit: 0 };
        current.qty += item.qty;
        current.revenue += item.linePaise;
        current.profit += item.linePaise - Math.round(item.qty * item.product.purchasePaise) - item.taxPaise;
        productSales.set(item.productId, current);
        const cat = item.product.category?.name ?? "Uncategorized";
        categorySales.set(cat, (categorySales.get(cat) ?? 0) + item.linePaise);
      }
      for (const payment of order.payments) {
        if (payment.status === "CAPTURED") methodSales.set(payment.method, (methodSales.get(payment.method) ?? 0) + payment.amountPaise);
      }
    }

    const recent = await prisma.order.findMany({
      where: whereBranch,
      include: { customer: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    return Response.json({
      stats: {
        todaySalesPaise: salesPaise,
        todayOrders: paidOrders.length,
        grossProfitPaise,
        netProfitPaise,
        cashPaise,
        upiPaise,
        cardPaise,
        outstandingPaise: credit._sum.outstandingPaise ?? 0,
        products,
        lowStock,
        outOfStock,
        expensesPaise: expensesToday._sum.amountPaise ?? 0,
        refundsPaise: refunds._sum.amountPaise ?? 0,
        refundCount: refunds._count,
        pendingKitchen,
        activeBookings,
        occupancyPct: rooms ? Math.round((activeBookings / rooms) * 100) : 0,
      },
      charts: {
        daily: [...dailyMap.entries()].map(([date, totalPaise]) => ({ date, totalPaise })),
        hourly,
        bestSelling: [...productSales.values()].sort((a, b) => b.qty - a.qty).slice(0, 8),
        mostProfitable: [...productSales.values()].sort((a, b) => b.profit - a.profit).slice(0, 8),
        byMethod: [...methodSales.entries()].map(([method, totalPaise]) => ({ method, totalPaise })),
        byCategory: [...categorySales.entries()].map(([category, totalPaise]) => ({ category, totalPaise })),
      },
      recent,
    });
  } catch (error) {
    return jsonError(error);
  }
}
