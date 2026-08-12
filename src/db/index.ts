import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
import ws from "ws";

import { env } from "../env";

const sql = neon(env.DATABASE_URL);
export const db = drizzle({ client: sql, schema });

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: env.DATABASE_URL });
export const dbPool = drizzleServerless({ client: pool, schema });
