import { NextResponse } from "next/server";
import { getAuthSession, getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getAuthSession();

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, user: null },
        { status: 401 }
      );
    }

    const user = await getCurrentUser();

    return NextResponse.json({
      ok: true,
      user: {
        id: user?.id,
        email: user?.email,
        name: user?.name,
      },
      session: {
        expires: session.expires,
      },
    });
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json(
      { ok: false, message: "Failed to fetch session" },
      { status: 500 }
    );
  }
}
