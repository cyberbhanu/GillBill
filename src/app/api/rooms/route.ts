import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";
import { rupeesToPaise } from "@/lib/money";

export async function GET() {
  try {
    const actor = await requirePermission("rooms");
    const rooms = await prisma.room.findMany({
      where: { branchId: actor.branchId },
      include: { bookings: { where: { status: { in: ["RESERVED", "CHECKED_IN"] } }, include: { customer: true } } },
      orderBy: { number: "asc" },
    });
    return Response.json({ rooms });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("rooms");
    const body = await request.json();
    if (body.kind === "room") {
      const room = await prisma.room.create({
        data: {
          branchId: actor.branchId,
          number: body.number,
          category: body.category || "Standard",
          capacity: Number(body.capacity ?? 2),
          ratePaise: rupeesToPaise(body.rate ?? 0),
        },
      });
      return Response.json({ room });
    }
    const nights = Math.max(1, Number(body.nights ?? 1));
    const room = await prisma.room.findFirst({ where: { id: body.roomId, branchId: actor.branchId } });
    if (!room) return Response.json({ error: "Room not found." }, { status: 404 });
    const booking = await prisma.roomBooking.create({
      data: {
        roomId: room.id,
        customerId: body.customerId || null,
        guestName: body.guestName,
        guestPhone: body.guestPhone || null,
        checkIn: new Date(body.checkIn),
        checkOut: new Date(body.checkOut),
        nights,
        roomChargePaise: room.ratePaise * nights,
        depositPaise: rupeesToPaise(body.deposit ?? 0),
        status: body.status || "RESERVED",
        notes: body.notes || null,
      },
    });
    await prisma.room.update({ where: { id: room.id }, data: { status: booking.status === "CHECKED_IN" ? "OCCUPIED" : "RESERVED" } });
    return Response.json({ booking });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requirePermission("rooms");
    const { bookingId, status } = await request.json();
    const booking = await prisma.roomBooking.findFirst({
      where: { id: bookingId, room: { branchId: actor.branchId } },
    });
    if (!booking) return Response.json({ error: "Booking not found." }, { status: 404 });
    await prisma.roomBooking.update({ where: { id: bookingId }, data: { status } });
    const roomStatus = status === "CHECKED_IN" ? "OCCUPIED" : status === "CHECKED_OUT" || status === "CANCELLED" ? "AVAILABLE" : "RESERVED";
    await prisma.room.update({ where: { id: booking.roomId }, data: { status: roomStatus } });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
