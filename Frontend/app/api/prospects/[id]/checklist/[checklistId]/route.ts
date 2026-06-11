// app/api/prospects/[id]/checklist/[checklistId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; checklistId: string } }
) {
  const auth = await requireAuth(["admin", "manager"]);
  if (!auth.ok) return auth.response;

  try {
    const prisma = getPrisma(); // ✅ lazy — only runs at request time, not build time

    const { status } = await req.json();
    if (status !== "TODO" && status !== "DONE") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const item = await prisma.onboardingChecklist.findUnique({
      where: { id: params.checklistId },
      include: {
        prospect: {
          select: {
            id: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!item || item.prospectId !== params.id || item.prospect.deletedAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const checklistItem = await tx.onboardingChecklist.update({
        where: { id: params.checklistId },
        data: { status: status === "DONE" ? "done" : "todo" },
      });

      const allItems = await tx.onboardingChecklist.findMany({
        where: { prospectId: params.id },
        select: { status: true },
      });

      const allCompleted = allItems.length > 0 && allItems.every((i: any) => i.status === "done");

      if (allCompleted) {
        await tx.prospect.update({
          where: { id: params.id },
          data: {
            completed: true,
            completedAt: new Date(),
          },
        });
      } else {
        await tx.prospect.update({
          where: { id: params.id },
          data: {
            completed: false,
            completedAt: null,
          },
        });
      }

      return checklistItem;
    });

    const prospect = await prisma.prospect.findUnique({
      where: { id: params.id },
      select: {
        completed: true,
        completedAt: true,
      },
    });

    return NextResponse.json({
      id: updated.id,
      prospectId: updated.prospectId,
      stepNumber: updated.stepNumber,
      title: updated.title,
      description: updated.description || "",
      assignee: updated.assignee || "",
      status: updated.status === "done" ? "DONE" : "TODO",
      dueDate: updated.dueDate || null,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt || updated.createdAt,
      prospectCompletion: prospect,
    });
  } catch (err) {
    console.error("PATCH checklist error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}