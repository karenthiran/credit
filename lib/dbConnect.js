import mongoose from "mongoose";

const cached = globalThis.__mongooseConnection ?? {
  conn: null,
  promise: null,
};

globalThis.__mongooseConnection = cached;

export const connectToDb = async () => {
  if (cached.conn || mongoose.connection.readyState === 1) {
    return cached.conn ?? mongoose;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri).then((db) => db);
  }

  cached.conn = await cached.promise;
  return cached.conn;
};
