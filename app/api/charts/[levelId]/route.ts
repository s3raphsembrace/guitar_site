import { NextResponse } from "next/server";
import { getImportCollections } from "@/lib/level-import/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ levelId: string }> },
) {
  try {
    const { levelId } = await context.params;
    const { levelVersions, userLevels } = await getImportCollections();
    const level = await userLevels.findOne({
      id: levelId,
      status: "published",
    });

    if (!level?.publishedVersionId) {
      return NextResponse.json({ message: "Chart not found." }, { status: 404 });
    }

    const version = await levelVersions.findOne({
      _id: level.publishedVersionId,
      levelId,
      status: "published",
    });
    if (!version) {
      return NextResponse.json({ message: "Chart version not found." }, { status: 404 });
    }

    return NextResponse.json(version.chart);
  } catch (error) {
    console.error("[GET /api/charts/:levelId]", error);
    return NextResponse.json({ message: "Failed to load chart." }, { status: 500 });
  }
}
