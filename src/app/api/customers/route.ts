import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const actor = await requirePermission("customers");
    const q = new URL(request.url).searchParams.get("q")?.trim();
    const customers = await prisma.customer.findMany({
      where: {
        businessId: actor.businessId,
        ...(q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }] } : {}),
      },
      orderBy: { name: "asc" },
    });
    return Response.json({ customers });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("customers");
    const body = await request.json();
    if (!body.name) return Response.json({ error: "Customer name is required." }, { status: 400 });
    const customer = await prisma.customer.create({
      data: {
        businessId: actor.businessId,
        name: String(body.name).trim(),
        phone: body.phone || null,
        email: body.email || null,
        notes: body.notes || null,
        creditLimitPaise: Number(body.creditLimitPaise ?? 0),
      },
    });
    return Response.json({ customer });
  } catch (error) {
    return jsonError(error);
  }
}
