import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

// 数据库访问统一收敛于此:D1 → 本地 SQLite/libSQL 迁移时只改这个文件
export function createDb(d1: D1Database) {
	return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof createDb>;
