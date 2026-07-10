import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function withAuth(handler: Function) {
  return async (req: NextRequest) => {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Add user info to request for use in handler
    (req as any).user = token;
    return handler(req);
  };
}

export function getAuthenticatedUser(req: NextRequest) {
  return (req as any).user;
}
