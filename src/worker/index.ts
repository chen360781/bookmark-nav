import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "./lib/types";
import { softAuth } from "./middleware/auth";
import { authRoutes } from "./routes/auth";
import { publicRoutes } from "./routes/public";
import { adminRoutes } from "./routes/admin";

const app = new Hono<AppEnv>()
	// 全局软认证:解析 cookie 里的 JWT,公开接口据此过滤私密内容
	.use("/api/*", softAuth)
	// 受登录态影响的响应一律禁止共享缓存,防止私密书签泄露
	.use("/api/*", async (c, next) => {
		await next();
		c.header("Cache-Control", "private, no-store");
	})
	.route("/api/auth", authRoutes)
	.route("/api/public", publicRoutes)
	.route("/api/admin", adminRoutes);

// API 异常统一返回 JSON,前端才能展示具体错误而非笼统的“网络错误”
app.onError((err, c) => {
	const status = err instanceof HTTPException ? err.status : 500;
	console.error(`[api] ${c.req.method} ${c.req.path}:`, err);
	return c.json({ error: err.message || "Internal Server Error" }, status);
});

// 非 API 路径回退到静态资产(SPA 模式下未命中资产会返回 index.html),保证前端路由刷新/直达不 404
app.notFound((c) => {
	if (c.req.path.startsWith("/api/")) return c.json({ error: "Not found" }, 404);
	return c.env.ASSETS.fetch(c.req.raw);
});

// 前端 Hono RPC client 使用的类型
export type AppType = typeof app;

export default app;
