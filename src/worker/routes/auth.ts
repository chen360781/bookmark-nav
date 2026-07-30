import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { setCookie, deleteCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { createDb } from "../db/client";
import { users } from "../db/schema";
import { hashPassword, verifyPassword } from "../lib/password";
import { AUTH_COOKIE, TOKEN_TTL_SECONDS, type AppEnv } from "../lib/types";

const credentialsSchema = z.object({
	username: z.string().min(1).max(50),
	password: z.string().min(6).max(100),
});

async function issueToken(
	c: Context<AppEnv>,
	user: { id: number; username: string },
) {
	// 部署时漏配 JWT_SECRET 是最常见的环境问题,给出明确提示而非模糊的 500
	if (!c.env.JWT_SECRET) {
		throw new HTTPException(500, {
			message:
				"服务未配置 JWT_SECRET:请在 Worker → 设置 → 变量和机密中添加机密 JWT_SECRET 后重试",
		});
	}
	const token = await sign(
		{
			id: user.id,
			username: user.username,
			exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
		},
		c.env.JWT_SECRET,
		"HS256",
	);
	setCookie(c, AUTH_COOKIE, token, {
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		path: "/",
		maxAge: TOKEN_TTL_SECONDS,
	});
}

export const authRoutes = new Hono<AppEnv>()
	// 初始化状态:前端据此决定显示"初始化管理员"还是"登录"
	.get("/status", async (c) => {
		const db = createDb(c.env.DB);
		const [first] = await db.select({ id: users.id }).from(users).limit(1);
		return c.json({
			initialized: !!first,
			authenticated: !!c.get("user"),
			user: c.get("user") ?? null,
		});
	})
	// 首次初始化管理员,仅当没有任何用户时可用
	.post("/setup", zValidator("json", credentialsSchema), async (c) => {
		const db = createDb(c.env.DB);
		const [exists] = await db.select({ id: users.id }).from(users).limit(1);
		if (exists) {
			return c.json({ error: "Already initialized" }, 403);
		}
		const { username, password } = c.req.valid("json");
		const [user] = await db
			.insert(users)
			.values({ username, passwordHash: await hashPassword(password) })
			.returning({ id: users.id, username: users.username });
		await issueToken(c, user);
		return c.json({ user });
	})
	.post("/login", zValidator("json", credentialsSchema), async (c) => {
		const db = createDb(c.env.DB);
		const { username, password } = c.req.valid("json");
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.username, username))
			.limit(1);
		if (!user || !(await verifyPassword(password, user.passwordHash))) {
			return c.json({ error: "用户名或密码错误" }, 401);
		}
		await issueToken(c, { id: user.id, username: user.username });
		return c.json({ user: { id: user.id, username: user.username } });
	})
	.post("/logout", (c) => {
		deleteCookie(c, AUTH_COOKIE, { path: "/" });
		return c.json({ ok: true });
	});
