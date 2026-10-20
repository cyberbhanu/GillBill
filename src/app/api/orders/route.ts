import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const actor = await requirePermission("orders");
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const orders = await prisma.order.findMany({
      where: {
        branch: { businessId: actor.businessId },
        ...(actor.business.shareDataAcrossBranches ? {} : { branchId: actor.branchId }),
        ...(status ? { status } : {}),
      },
      include: { items: true, payments: true, customer: true, invoice: true, table: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return Response.json({ orders });
  } catch (error) {
    return jsonError(error);
  }
}
