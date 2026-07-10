import clientPromise from "@/lib/mongodb";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return new Response(JSON.stringify({ error: "Missing email or password" }), { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("guitar-game");
    const users = db.collection("users");

    const user = await users.findOne({ email });
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid email or password" }), { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return new Response(JSON.stringify({ error: "Invalid email or password" }), { status: 401 });
    }

    return new Response(
      JSON.stringify({
        message: "Login successful",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Login error:", error);
    return new Response(JSON.stringify({ error: "Failed to login" }), { status: 500 });
  }
}
