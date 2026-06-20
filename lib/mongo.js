import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Missing MONGODB_URI");

const client = new MongoClient(uri);

export default client.connect();
