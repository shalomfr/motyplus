import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

interface LogActivityParams {
  userId?: string;
  customerId?: number;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}

export async function logActivity({
  userId,
  customerId,
  action,
  entityType,
  entityId,
  details,
}: LogActivityParams) {
  return prisma.activityLog.create({
    data: {
      userId,
      customerId,
      action,
      entityType,
      entityId,
      details: details ? (details as Prisma.InputJsonValue) : undefined,
    },
  });
}
