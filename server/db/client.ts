import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI ?? "";

if (!MONGODB_URI) {
  throw new Error("Please define MONGODB_URI in your .env.local file");
}

// In development, attach the cached connection to the global object
// so it survives Next.js hot reloads without opening a new connection each time.
declare global {
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | null;
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | null;
}

let cached = global._mongoClient;
let cachedPromise = global._mongoClientPromise;

if (!cached) {
  cached = global._mongoClient = null;
  cachedPromise = global._mongoClientPromise = null;
}

const clientPromise: Promise<MongoClient> = 
  cachedPromise ||
  (global._mongoClientPromise = MongoClient.connect(MONGODB_URI).then(
    (client) => {
      cached = global._mongoClient = client;
      return client;
    }
  ));

export default clientPromise;