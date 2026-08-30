import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import { eq } from "drizzle-orm";
import { createDb } from "../db/client";
import { users } from "../db/schema";
import { AUTH_COOKIE, type AppEnv, type JwtUser } from "../lib/types";

// 软认证:有合法 token 则注入 user,没有也放行(公开接口按登录态过滤 visibility)
export const softAuth = createMiddleware<AppEnv>(async (c, next) => {
	const token = getCookie(c, AUTH_COOKIE);
	if (token) {
		try {
			const payload = await verify(token, c.env.JWT_SECRET, "HS256");
			if (typeof payload.id === "number" && typeof payload.username === "string") {
				// 校验 token 版本:改密码后旧 token 立即失效,避免被盗会话继续可用
				const db = createDb(c.env.DB);
				const [user] = await db
					.select({
						id: users.id,
						username: users.username,
						tokenVersion: users.tokenVersion,
					})
					.from(users)
					.where(eq(users.id, payload.id))
					.limit(1);
				// 缺少 ver 字段的旧版 token 一律视为失效
				const ver = typeof payload.ver === "number" ? payload.ver : -1;
				if (user && user.tokenVersion === ver) {
					c.set("user", { id: user.id, username: user.username } satisfies JwtUser);
				}
			}
		} catch {
			// token 无效/过期:视为未登录,不报错
		}
	}
	await next();
});

// 强认证:管理接口必须登录
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
	if (!c.get("user")) {
		return c.json({ error: "Unauthorized" }, 401);
	}
	await next();
});
