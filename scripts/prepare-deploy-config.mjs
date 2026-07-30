// 部署前把 Workers Builds 的构建变量注入 wrangler.json:
//   - D1_DATABASE_ID → d1_databases[0].database_id
//   - JWT_SECRET     → vars.JWT_SECRET
// 为什么放构建变量而不是面板 Secret:通过 GitHub 集成(Workers Builds)部署时,
// 每次 wrangler deploy 都会清空面板 UI 手动设置的 Secret/变量(见 cloudflare/workers-sdk#8871);
// 而构建变量是独立存储的,不会被清空,构建时注入即可保证每次部署都带上,永不丢失。
// 未设置对应变量时不做处理(本地开发用 .dev.vars,手动部署用面板 Secret,均不受影响)。
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../wrangler.json", import.meta.url);
const config = JSON.parse(readFileSync(path, "utf8"));
let changed = false;

const dbId = process.env.D1_DATABASE_ID;
if (dbId) {
	config.d1_databases[0].database_id = dbId;
	changed = true;
	console.log(`[prepare-deploy-config] 已注入 database_id: ${dbId}`);
} else {
	console.log("[prepare-deploy-config] 未设置 D1_DATABASE_ID,跳过");
}

const jwtSecret = process.env.JWT_SECRET;
if (jwtSecret) {
	config.vars = { ...config.vars, JWT_SECRET: jwtSecret };
	changed = true;
	console.log("[prepare-deploy-config] 已注入 JWT_SECRET (长度 " + jwtSecret.length + ")");
} else {
	console.log("[prepare-deploy-config] 未设置 JWT_SECRET,跳过");
}

if (changed) {
	writeFileSync(path, JSON.stringify(config, null, "\t") + "\n");
}
