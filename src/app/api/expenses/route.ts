import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";
import { rupeesToPaise } from "@/lib/money";

export async function GET() {
  try {
    const actor = await requirePermission("expenses");
    const expenses = await prisma.expense.findMany({
      where: { businessId: actor.businessId },
      orderBy: { spentAt: "desc" },
    });
    return Response.json({ expenses });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("expenses");
    const body = await request.json();
    if (!body.category || body.amount == null) return Response.json({ error: "Category and amount are required." }, { status: 400 });
    const expense = await prisma.expense.create({
      data: {
        businessId: actor.businessId,
        branchId: actor.branchId,
        category: body.category,
        amountPaise: rupeesToPaise(body.amount),
        note: body.note || null,
        spentAt: body.spentAt ? new Date(body.spentAt) : new Date(),
        createdBy: actor.userId,
      },
    });
    return Response.json({ expense });
  } catch (error) {
    return jsonError(error);
  }
}
