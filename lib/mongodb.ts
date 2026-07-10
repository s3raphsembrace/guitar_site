import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Please add MONGODB_URI in .env.local");

console.log("🗄️ MongoDB Connection Init");
console.log("📍 URI:", uri);
console.log("📍 Database:", uri.split("/").pop());

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  // Prevent multiple connections in dev
  if (!(global as any)._mongoClientPromise) {
    console.log("🔄 Creating new MongoDB connection (dev mode with caching)...");
    client = new MongoClient(uri);
    (global as any)._mongoClientPromise = client.connect().then(() => {
      console.log("✅ MongoDB connected successfully!");
      return client;
    }).catch((error) => {
      console.error("❌ MongoDB connection failed:", error.message);
      throw error;
    });
  } else {
    console.log("♻️ Using cached MongoDB connection");
  }
  clientPromise = (global as any)._mongoClientPromise;
} else {
  console.log("🔄 Creating MongoDB connection (production mode)...");
  client = new MongoClient(uri);
  clientPromise = client.connect().then(() => {
    console.log("✅ MongoDB connected successfully!");
    return client;
  }).catch((error) => {
    console.error("❌ MongoDB connection failed:", error.message);
    throw error;
  });
}

export default clientPromise;