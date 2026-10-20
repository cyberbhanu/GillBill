import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";

export async function GET() {
  try {
    const actor = await requirePermission("suppliers");
    const suppliers = await prisma.supplier.findMany({
      where: { businessId: actor.businessId },
      include: { purchases: true },
      orderBy: { name: "asc" },
    });
    return Response.json({
      suppliers: suppliers.map((s) => ({
        ...s,
        outstandingPaise: s.purchases.reduce((n, p) => n + (p.totalPaise - p.paidPaise), 0),
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("suppliers");
    const body = await request.json();
    if (!body.name) return Response.json({ error: "Supplier name is required." }, { status: 400 });
    const supplier = await prisma.supplier.create({
      data: {
        businessId: actor.businessId,
        name: body.name,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
        gstin: body.gstin || null,
        notes: body.notes || null,
      },
    });
    return Response.json({ supplier });
  } catch (error) {
    return jsonError(error);
  }
}
