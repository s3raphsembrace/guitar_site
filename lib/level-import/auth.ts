import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";

export class AuthRequiredError extends Error {
  constructor() {
    super("You must be logged in to use level import.");
    this.name = "AuthRequiredError";
  }
}

export async function requireUserSession() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    throw new AuthRequiredError();
  }
  return { userId, session };
}
