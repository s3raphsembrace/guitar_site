import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  console.log("\n========== MONGODB TEST START ==========");
  console.log("Testing MongoDB connection...");

  try {
    console.log("1️⃣ Connecting to MongoDB...");
    const client = await clientPromise;
    console.log("✅ Connected!");

    console.log("\n2️⃣ Selecting database...");
    const db = client.db("guitar-game");
    console.log("✅ Database selected: guitar-game");

    console.log("\n3️⃣ Accessing collections...");
    const users = db.collection("users");
    const scores = db.collection("scores");
    const levels = db.collection("levels");
    const rooms = db.collection("rooms");
    console.log("✅ All collections accessible");

    console.log("\n4️⃣ Testing database operations...");
    const userCount = await users.countDocuments();
    const scoreCount = await scores.countDocuments();
    const levelCount = await levels.countDocuments();
    console.log(`✅ Users: ${userCount}`);
    console.log(`✅ Scores: ${scoreCount}`);
    console.log(`✅ Levels: ${levelCount}`);

    console.log("\n✅ MONGODB TEST COMPLETE - SUCCESS!");
    console.log("========== MONGODB TEST END ==========\n");

    return NextResponse.json({
      success: true,
      message: "MongoDB is connected and working!",
      database: "guitar-game",
      collections: {
        users: userCount,
        scores: scoreCount,
        levels: levelCount
      }
    });
  } catch (error: any) {
    console.log("\n❌ MONGODB TEST FAILED!");
    console.log("Error:", error.message);
    console.log("Address:", error.address || "N/A");
    console.log("Port:", error.port || "N/A");
    console.log("\n📍 DIAGNOSIS:");
    console.log("If you see 'ECONNREFUSED' → MongoDB is NOT running");
    console.log("If you see 'ENOTFOUND' → Wrong hostname/IP");
    console.log("If you see timeout → MongoDB not responding");
    console.log("\n🔧 TO FIX:");
    console.log("1. On Windows (NOT WSL), open PowerShell");
    console.log("2. Run: mongod");
    console.log("3. Wait for 'Listening on socket' message");
    console.log("4. Keep that window open");
    console.log("5. Come back to browser and refresh");
    console.log("========== MONGODB TEST END (ERROR) ==========\n");

    return NextResponse.json(
      {
        success: false,
        message: error.message,
        error_code: error.code || "UNKNOWN",
        error_address: error.address,
        error_port: error.port,
        helpful_hint: "MongoDB is not running or not accessible at 10.255.255.254:27017"
      },
      { status: 500 }
    );
  }
}
