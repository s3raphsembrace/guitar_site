import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI ?? "";

// In development, attach the cached connection to the global object
// so it survives Next.js hot reloads without opening a new connection each time.
declare global {
  // eslint-disable-next-line no-var
  var _mongooseConn: typeof mongoose | null;
  // eslint-disable-next-line no-var
  var _mongoosePromise: Promise<typeof mongoose> | null;
}

let cached = global._mongooseConn;
let cachedPromise = global._mongoosePromise;

if (!cached) {
  cached = global._mongooseConn = null;
  cachedPromise = global._mongoosePromise = null;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured; database features are unavailable.");
  }
  if (cached) return cached;

  if (!cachedPromise) {
    cachedPromise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
    global._mongoosePromise = cachedPromise;
  }

  cached = await cachedPromise;
  global._mongooseConn = cached;
  return cached;
}