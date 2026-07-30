// Hono app 公共类型:Bindings 来自 wrangler 生成的 Env,Variables 存放登录用户
export type JwtUser = {
	id: number;
	username: string;
};

export type AppEnv = {
	Bindings: Env;
	Variables: {
		user?: JwtUser;
	};
};

export const AUTH_COOKIE = "auth_token";
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 天
