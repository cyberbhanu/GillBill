import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can, type Permission } from "@/lib/permissions";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "Please sign in to continue.");
  return session.user;
}

export async function requireActor() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new HttpError(401, "Please sign in to continue.");
  }
  if (!session.user.businessId) {
    throw new HttpError(409, "Create a business to continue.");
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      businessId: session.user.businessId,
      isActive: true,
    },
    include: {
      business: true,
      user: true,
      branch: true,
    },
  });
  if (!membership) throw new HttpError(403, "You do not have access to this business.");

  const branchId =
    session.user.branchId ||
    membership.branchId ||
    (
      await prisma.branch.findFirst({
        where: { businessId: membership.businessId, isDefault: true },
      })
    )?.id;

  if (!branchId) throw new HttpError(400, "No branch is configured for this business.");

  return {
    userId: membership.userId,
    name: membership.user.name,
    role: membership.role,
    business: membership.business,
    businessId: membership.businessId,
    branchId,
  };
}

export async function requirePermission(permission: Permission) {
  const actor = await requireActor();
  if (!can(actor.role, permission)) {
    throw new HttpError(403, "You do not have permission for this action.");
  }
  return actor;
}

export function jsonError(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Something went wrong." }, { status: 500 });
}
