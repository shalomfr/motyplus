import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

// PATCH /api/users/[id] — update user (isActive, name, role, password)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "פעולה זו מותרת למנהלים בלבד" }, { status: 403 });
  }

  const { id } = await params;

  const existingUser = await prisma.user.findUnique({ where: { id } });
  if (!existingUser) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  }

  const body = await request.json();
  const { name, email, role, password } = body;

  // Check if at least one field was provided
  if (!name && !email && !role && !password) {
    return NextResponse.json(
      { error: "יש לספק לפחות שדה אחד לעדכון" },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.name) data.name = body.name;
  if (body.role) data.role = body.role;
  if (body.password) data.passwordHash = await bcrypt.hash(body.password, 10);

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });

  return NextResponse.json(user);
}

// DELETE /api/users/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "פעולה זו מותרת למנהלים בלבד" }, { status: 403 });
  }

  const { id } = await params;

  if (session.user.id === id) {
    return NextResponse.json(
      { error: "לא ניתן למחוק את המשתמש שמחובר כרגע" },
      { status: 400 }
    );
  }

  const userCount = await prisma.user.count();
  if (userCount <= 1) {
    return NextResponse.json(
      { error: "לא ניתן למחוק את המשתמש האחרון במערכת" },
      { status: 400 }
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { id } });
  if (!existingUser) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  }

  // Clean up LeadNotes (set userId to null — requires schema change to nullable)
  await prisma.leadNote.updateMany({
    where: { userId: id },
    data: { userId: null },
  });
  // Clean up BillingProviders
  await prisma.billingProvider.updateMany({
    where: { userId: id },
    data: { userId: null },
  });
  // Clean up CustomerUpdate.sentById
  await prisma.customerUpdate.updateMany({
    where: { sentById: id },
    data: { sentById: null },
  });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ message: "המשתמש נמחק" });
}
