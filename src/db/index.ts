import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
import ws from "ws";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema });

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const dbPool = drizzleServerless({ client: pool, schema });