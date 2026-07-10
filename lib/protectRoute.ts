import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

type RouteProtectionConfig = {
  requiredAuth?: boolean;
  requiredRole?: string;
};

/**
 * Middleware to protect API routes with authentication
 * Usage in route handler:
 *
 * export async function GET(req: NextRequest) {
 *   const authResult = await protectRoute(req, { requiredAuth: true });
 *   if (!authResult.authorized) {
 *     return authResult.response;
 *   }
 *   // Route handler code here
 * }
 */
export async function protectRoute(
  req: NextRequest,
  config: RouteProtectionConfig = { requiredAuth: false }
) {
  if (!config.requiredAuth) {
    return { authorized: true, token: null };
  }

  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        ),
      };
    }

    if (config.requiredRole && token.role !== config.requiredRole) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Forbidden - insufficient permissions" },
          { status: 403 }
        ),
      };
    }

    return {
      authorized: true,
      token,
    };
  } catch (error) {
    console.error("Auth middleware error:", error);
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      ),
    };
  }
}

/**
 * Extract user ID from request
 */
export function getUserIdFromRequest(req: NextRequest): string | null {
  const token = (req as any).user?.id || null;
  return token;
}
