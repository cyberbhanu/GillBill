import { completeCheckout } from "@/lib/checkout";
import { jsonError, requirePermission } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("pos");
    const body = await request.json();
    const order = await completeCheckout({
      businessId: actor.businessId,
      branchId: actor.branchId,
      userId: actor.userId,
      customerId: body.customerId,
      tableId: body.tableId,
      bookingId: body.bookingId,
      fulfillment: body.fulfillment,
      notes: body.notes,
      billDiscountPaise: body.billDiscountPaise ?? 0,
      servicePaise: body.servicePaise ?? 0,
      deliveryPaise: body.deliveryPaise ?? 0,
      clientNonce: body.clientNonce,
      items: body.items ?? [],
      payments: body.payments ?? [],
      sendToKitchen: Boolean(body.sendToKitchen),
    });
    return Response.json({ order });
  } catch (error) {
    if (error instanceof Error && !(error as { status?: number }).status) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return jsonError(error);
  }
}
