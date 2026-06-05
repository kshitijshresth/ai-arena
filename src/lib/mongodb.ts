import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "arena";

if (!uri) {
  throw new Error("MONGODB_URI is not defined in environment variables");
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

if (global._mongoClientPromise) {
  clientPromise = global._mongoClientPromise;
} else {
  const client = new MongoClient(uri);
  clientPromise = client.connect();
  global._mongoClientPromise = clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName);
}
