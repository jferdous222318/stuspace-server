import { MongoClient } from "mongodb";

let db;
export async function connectDB() {
  if (db) return db;
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db(process.env.DB_NAME || "studiospace");
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  console.log("MongoDB connected");
  return db;
}
export const getDB = () => db;