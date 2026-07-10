import { MongoClient } from "mongodb";

// Lazily connect to MongoDB. Importing this module NEVER throws or opens a
// connection — the client is only created the first time something awaits it.
// This lets the app build and serve static pages even when MONGODB_URI is unset;
// data-backed routes will reject (and their try/catch returns a 5xx) instead of
// crashing the whole build.

declare global {
  // eslint-disable-next-line no-var
  var _libMongoClientPromise: Promise<MongoClient> | null | undefined;
}

function connect(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return Promise.reject(
      new Error("MONGODB_URI is not configured; database features are unavailable.")
    );
  }
  if (!global._libMongoClientPromise) {
    console.log("🔄 Creating MongoDB connection...");
    global._libMongoClientPromise = new MongoClient(uri)
      .connect()
      .then((client) => {
        console.log("✅ MongoDB connected successfully!");
        return client;
      })
      .catch((error) => {
        // Reset so a later request can retry the connection.
        global._libMongoClientPromise = null;
        console.error("❌ MongoDB connection failed:", error.message);
        throw error;
      });
  }
  return global._libMongoClientPromise;
}

// A lazy thenable: awaiting it triggers the connection on first use.
const clientPromise = {
  then(onFulfilled, onRejected) {
    return connect().then(onFulfilled, onRejected);
  },
  catch(onRejected) {
    return connect().catch(onRejected);
  },
  finally(onFinally) {
    return connect().finally(onFinally);
  },
} as Promise<MongoClient>;

export default clientPromise;
