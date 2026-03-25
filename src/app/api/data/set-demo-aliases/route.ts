import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Mapping: organ name → demoAlias (folder name in Drive)
const ORGAN_ALIAS_MAP: Record<string, string> = {
  "Genos": "Genos1",
  "Genos 2": "Genos2",
  "PSR-SX720": "SX720",
  "PSR-SX920": "sx920",
  "Tyros5-1G": "Tyros5 - 1g",
  "Tyros5-2G": "Tyros5 - 2g",
};

// Mapping: set type name → demoAlias (folder name in Drive)
const SET_ALIAS_MAP: Record<string, string> = {
  "בסיס": "Basic",
  "Basic": "Basic",
  "סט שלם": "Full set",
  "Full set": "Full set",
  "חצי סט": "Half set",
  "Half set": "Half set",
  "קטרון ומוטיף": "ketron&motif",
  "ketron&motif": "ketron&motif",
  "לייב": "Live",
  "Live": "Live",
};

// POST /api/data/set-demo-aliases — הגדרת demoAlias אוטומטית לאורגנים וסטים
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const results: string[] = [];

    // Update organs
    const organs = await prisma.organ.findMany();
    for (const organ of organs) {
      const alias = ORGAN_ALIAS_MAP[organ.name];
      if (alias && organ.demoAlias !== alias) {
        await prisma.organ.update({
          where: { id: organ.id },
          data: { demoAlias: alias },
        });
        results.push(`Organ: ${organ.name} → ${alias}`);
      }
    }

    // Update set types
    const setTypes = await prisma.setType.findMany();
    for (const st of setTypes) {
      const alias = SET_ALIAS_MAP[st.name];
      if (alias && st.demoAlias !== alias) {
        await prisma.setType.update({
          where: { id: st.id },
          data: { demoAlias: alias },
        });
        results.push(`SetType: ${st.name} → ${alias}`);
      }
    }

    return NextResponse.json({
      message: `עודכנו ${results.length} רשומות`,
      updated: results,
    });
  } catch (error) {
    console.error("Error setting demo aliases:", error);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
