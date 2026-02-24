import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadFile } from "@/lib/azure-storage";

const ALLOWED_TYPES: Record<string, string[]> = {
  customers: ["bin", "sty"],
  updates: ["zip"],
};

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "customers";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 100MB)" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const folderKey = folder.split("/")[0];
    const allowed = ALLOWED_TYPES[folderKey] || [];
    if (!allowed.includes(ext)) {
      return NextResponse.json(
        { error: `סוג קובץ לא מורשה. מותר: ${allowed.join(", ")}` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const url = await uploadFile(buffer, file.name, folder);

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
