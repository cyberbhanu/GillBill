import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";
import { ROLES } from "@/lib/permissions";

export async function GET() {
  try {
    const actor = await requirePermission("staff");
    const memberships = await prisma.membership.findMany({
      where: { businessId: actor.businessId },
      include: { user: true, branch: true },
      orderBy: { createdAt: "asc" },
    });
    return Response.json({
      staff: memberships.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        phone: m.user.phone,
        role: m.role,
        isActive: m.isActive && m.user.isActive,
        branchName: m.branch?.name,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("staff");
    const body = await request.json();
    if (!ROLES.includes(body.role) || body.role === "OWNER") {
      return Response.json({ error: "Choose a valid staff role." }, { status: 400 });
    }
    if (!body.name || !body.password || (!body.email && !body.phone)) {
      return Response.json({ error: "Name, login, and password are required." }, { status: 400 });
    }
    const email = body.email ? String(body.email).toLowerCase() : null;
    const phone = body.phone || null;
    const existing = await prisma.user.findFirst({
      where: { OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] },
    });
    const user =
      existing ??
      (await prisma.user.create({
        data: {
          name: body.name,
          email,
          phone,
          passwordHash: await bcrypt.hash(body.password, 12),
        },
      }));
    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        businessId: actor.businessId,
        branchId: body.branchId || actor.branchId,
        role: body.role,
      },
    });
    return Response.json({ membership });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requirePermission("staff");
    const { id, isActive, role } = await request.json();
    const membership = await prisma.membership.findFirst({
      where: { id, businessId: actor.businessId },
    });
    if (!membership) return Response.json({ error: "Staff member not found." }, { status: 404 });
    if (membership.role === "OWNER" && actor.role !== "OWNER") {
      return Response.json({ error: "Owner accounts cannot be changed here." }, { status: 403 });
    }
    await prisma.membership.update({
      where: { id },
      data: {
        ...(typeof isActive === "boolean" ? { isActive } : {}),
        ...(role && role !== "OWNER" ? { role } : {}),
      },
    });
    if (typeof isActive === "boolean") {
      const other = await prisma.membership.count({ where: { userId: membership.userId, isActive: true, id: { not: id } } });
      if (!other) await prisma.user.update({ where: { id: membership.userId }, data: { isActive } });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
