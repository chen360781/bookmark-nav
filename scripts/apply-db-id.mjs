// 部署前把环境变量 D1_DATABASE_ID 注入 wrangler.json 的 database_id。
// 用于 Fork 部署场景:fork 仓库无需修改任何文件即可部署,
// 保持与上游零差异,GitHub 的 Sync fork 按钮永不冲突。
// 未设置该变量时不做任何事(一键部署/手动部署不受影响)。
import { readFileSync, writeFileSync } from "node:fs";

const id = process.env.D1_DATABASE_ID;
if (!id) {
	console.log("[apply-db-id] 未设置 D1_DATABASE_ID,跳过注入");
	process.exit(0);
}

const path = new URL("../wrangler.json", import.meta.url);
const config = JSON.parse(readFileSync(path, "utf8"));
config.d1_databases[0].database_id = id;
writeFileSync(path, JSON.stringify(config, null, "\t") + "\n");
console.log(`[apply-db-id] 已注入 database_id: ${id}`);
