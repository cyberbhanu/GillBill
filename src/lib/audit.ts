import { prisma } from "@/lib/prisma";

export async function audit(input: {
  businessId?: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  payload?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      businessId: input.businessId,
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      payload: input.payload ? JSON.stringify(input.payload) : null,
    },
  });
}
