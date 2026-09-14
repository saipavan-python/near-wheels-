import { prisma } from "../db";

export async function audit(
  actorRole: string,
  actorId: string | null | undefined,
  action: string,
  entity: string,
  entityId: string | null | undefined,
  detail: Record<string, unknown> = {}
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorRole,
        actorId: actorId ?? undefined,
        action,
        entity,
        entityId: entityId ?? undefined,
        detail: JSON.stringify(detail),
      },
    });
  } catch {
    // never break request path
  }
}
