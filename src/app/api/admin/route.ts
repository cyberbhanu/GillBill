import { prisma } from "@/lib/prisma";
import { jsonError, requireSuperAdmin } from "@/lib/session";
import { z } from "zod";

const planSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  description: z.string().max(500).optional().nullable(),
  pricePaise: z.number().int().min(0),
  durationDays: z.number().int().min(1).max(3650),
  offerLabel: z.string().max(80).optional().nullable(),
  offerDiscountBps: z.number().int().min(0).max(10000).default(0),
});

export async function GET() {
  try {
    await requireSuperAdmin();
    const [pendingOwners, requests, plans, subscriptions] = await Promise.all([
      prisma.user.findMany({ where: { isApproved: false }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, phone: true, createdAt: true } }),
      prisma.softwareAccessRequest.findMany({ where: { status: "PENDING" }, include: { user: { select: { id: true, name: true, email: true, phone: true, memberships: { include: { business: { select: { name: true } } } } } }, plan: true }, orderBy: { createdAt: "asc" } }),
      prisma.subscriptionPlan.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] }),
      prisma.ownerSubscription.findMany({ include: { user: { select: { id: true, name: true, email: true, phone: true } }, plan: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    ]);
    return Response.json({ pendingOwners, requests, plans, subscriptions });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const body = await request.json();
    if (body.action === "approve-owner" || body.action === "reject-owner") {
      const parsed = z.object({ action: z.enum(["approve-owner", "reject-owner"]), userId: z.string().min(1) }).safeParse(body);
      if (!parsed.success) return Response.json({ error: "Invalid owner request." }, { status: 400 });
      const result = await prisma.user.updateMany({ where: { id: parsed.data.userId, isApproved: false }, data: { isApproved: parsed.data.action === "approve-owner", isActive: parsed.data.action === "approve-owner" } });
      if (!result.count) return Response.json({ error: "Pending owner account not found." }, { status: 404 });
      if (parsed.data.action === "reject-owner") await prisma.softwareAccessRequest.updateMany({ where: { userId: parsed.data.userId, status: "PENDING" }, data: { status: "REJECTED" } });
      return Response.json({ ok: true });
    }
    if (body.action === "confirm-sale") {
      const parsed = z.object({ action: z.literal("confirm-sale"), requestId: z.string().min(1), planId: z.string().min(1) }).safeParse(body);
      if (!parsed.success) return Response.json({ error: "Select a valid subscription plan." }, { status: 400 });
      const saleRequest = await prisma.softwareAccessRequest.findUnique({ where: { id: parsed.data.requestId }, include: { user: true } });
      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: parsed.data.planId } });
      if (!saleRequest || saleRequest.status !== "PENDING") return Response.json({ error: "Pending software sale not found." }, { status: 404 });
      if (!plan || !plan.isActive) return Response.json({ error: "That subscription plan is unavailable." }, { status: 404 });
      if (!saleRequest.user.isApproved) return Response.json({ error: "Approve this owner account before confirming the software sale." }, { status: 409 });
      const now = new Date();
      const amountPaise = Math.round(plan.pricePaise * (10000 - plan.offerDiscountBps) / 10000);
      const endsAt = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
      const subscription = await prisma.$transaction(async (tx) => {
        await tx.softwareAccessRequest.update({ where: { id: saleRequest.id }, data: { status: "CONFIRMED", planId: plan.id } });
        return tx.ownerSubscription.create({ data: { userId: saleRequest.userId, planId: plan.id, status: "ACTIVE", amountPaise, offerLabel: plan.offerLabel, startsAt: now, endsAt } });
      });
      return Response.json({ ok: true, subscription });
    }
    if (body.action === "create-plan" || body.action === "update-plan") {
      const parsed = planSchema.safeParse(body.plan);
      if (!parsed.success) return Response.json({ error: "Check the plan fields and try again." }, { status: 400 });
      if (body.action === "create-plan") {
        const plan = await prisma.subscriptionPlan.create({ data: { ...parsed.data, description: parsed.data.description || null, offerLabel: parsed.data.offerLabel || null } });
        return Response.json({ plan });
      }
      if (!parsed.data.id) return Response.json({ error: "Plan ID is required." }, { status: 400 });
      const plan = await prisma.subscriptionPlan.update({ where: { id: parsed.data.id }, data: { name: parsed.data.name, description: parsed.data.description || null, pricePaise: parsed.data.pricePaise, durationDays: parsed.data.durationDays, offerLabel: parsed.data.offerLabel || null, offerDiscountBps: parsed.data.offerDiscountBps } });
      return Response.json({ plan });
    }
    if (body.action === "archive-plan") {
      const parsed = z.object({ action: z.literal("archive-plan"), planId: z.string().min(1) }).safeParse(body);
      if (!parsed.success) return Response.json({ error: "Plan ID is required." }, { status: 400 });
      await prisma.subscriptionPlan.update({ where: { id: parsed.data.planId }, data: { isActive: false } });
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unknown admin action." }, { status: 400 });
  } catch (error) {
    return jsonError(error);
  }
}
