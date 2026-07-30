import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { createDb, type Db } from "../db/client";
import { bookmarks, bookmarkTags, categories, settings, tags } from "../db/schema";
import type { AppEnv } from "../lib/types";
import { requireAuth } from "../middleware/auth";
import {
	buildNetscapeHtml,
	parseNetscapeHtml,
	type ExportFolder,
	type ParsedFolder,
} from "../lib/netscape";

const idParam = zValidator("param", z.object({ id: z.coerce.number().int() }));
const reorderSchema = z.object({ ids: z.array(z.number().int()).min(1) });

// 手动创建/移动分类限制最多三级(导入不受限,保留浏览器书签原始层级)
const MAX_CATEGORY_DEPTH = 3;

// 校验分类挂到 parentId 下是否合法:防循环嵌套 + 限制最大层级(移动时连同子树一起算)
function validateCategoryNesting(
	all: { id: number; parentId: number | null }[],
	parentId: number,
	movingId?: number,
): string | null {
	const parentOf = new Map(all.map((r) => [r.id, r.parentId]));
	if (movingId !== undefined) {
		if (parentId === movingId) return "不能以自己为父级";
		let cur: number | null = parentId;
		while (cur != null) {
			if (cur === movingId) return "不能形成循环嵌套";
			cur = parentOf.get(cur) ?? null;
		}
	}
	// 父级所在层级(1-based)
	let parentDepth = 0;
	for (let cur: number | null = parentId; cur != null; cur = parentOf.get(cur) ?? null) {
		parentDepth++;
	}
	// 被移动子树的高度(新建时为 1)
	const childrenOf = new Map<number, number[]>();
	for (const r of all) {
		if (r.parentId != null) {
			const list = childrenOf.get(r.parentId) ?? [];
			list.push(r.id);
			childrenOf.set(r.parentId, list);
		}
	}
	const height = (id: number): number =>
		1 + Math.max(0, ...(childrenOf.get(id) ?? []).map(height));
	const subtreeHeight = movingId !== undefined ? height(movingId) : 1;
	if (parentDepth + subtreeHeight > MAX_CATEGORY_DEPTH) {
		return `最多支持 ${MAX_CATEGORY_DEPTH} 级分类`;
	}
	return null;
}

const categoryInput = z.object({
	name: z.string().min(1).max(50),
	icon: z.string().max(200).nullish(),
	parentId: z.number().int().nullish(),
	sort: z.number().int().optional(),
	visibility: z.enum(["public", "private"]).optional(),
});

const bookmarkInput = z.object({
	title: z.string().min(1).max(200),
	url: z.string().url().max(2000),
	description: z.string().max(500).nullish(),
	icon: z.string().max(2000).nullish(),
	categoryId: z.number().int().nullish(),
	sort: z.number().int().optional(),
	isPinned: z.boolean().optional(),
	visibility: z.enum(["public", "private"]).optional(),
	status: z.enum(["active", "dead"]).optional(),
	tags: z.array(z.string().min(1).max(30)).max(20).optional(),
});

// 同步书签标签:upsert 标签名,重建关联,清理孤儿标签
async function syncTags(db: Db, bookmarkId: number, names: string[]) {
	await db.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, bookmarkId));
	const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
	if (unique.length > 0) {
		await db.insert(tags).values(unique.map((name) => ({ name }))).onConflictDoNothing();
		const rows = await db.select().from(tags).where(inArray(tags.name, unique));
		await db
			.insert(bookmarkTags)
			.values(rows.map((t) => ({ bookmarkId, tagId: t.id })));
	}
}

// 检查网址存活:HEAD 优先,不支持/失败时降级 GET;仅 404/410/网络失败判死,防误杀反爬站点
async function checkUrl(url: string): Promise<boolean> {
	const headers = {
		"User-Agent":
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
	};
	try {
		const res = await fetch(url, {
			method: "HEAD",
			redirect: "follow",
			headers,
			signal: AbortSignal.timeout(8000),
		});
		if (res.status < 400) return true;
	} catch {
		// 降级 GET 再试
	}
	try {
		const res = await fetch(url, {
			method: "GET",
			redirect: "follow",
			headers,
			signal: AbortSignal.timeout(8000),
		});
		return res.status !== 404 && res.status !== 410;
	} catch {
		return false;
	}
}

// 抓取网页元信息,用于表单自动填充
async function fetchMetadata(url: string) {
	const res = await fetch(url, {
		signal: AbortSignal.timeout(8000),
		headers: { "User-Agent": "Mozilla/5.0 (compatible; NavBot/1.0)" },
		redirect: "follow",
	});
	const html = (await res.text()).slice(0, 200_000);
	const pick = (re: RegExp) => html.match(re)?.[1]?.trim() ?? null;
	const decode = (s: string | null) =>
		s
			?.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'") ?? null;
	const title =
		pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
		pick(/<title[^>]*>([^<]+)<\/title>/i);
	const description =
		pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ??
		pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
	let icon =
		pick(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i) ??
		pick(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i);
	const origin = new URL(res.url || url).origin;
	icon = icon ? new URL(icon, origin).href : `${origin}/favicon.ico`;
	return { title: decode(title), description: decode(description), icon };
}

export const adminRoutes = new Hono<AppEnv>()
	.use(requireAuth)
	// ---------- 分类 ----------
	.get("/categories", async (c) => {
		const db = createDb(c.env.DB);
		const rows = await db
			.select()
			.from(categories)
			.orderBy(asc(categories.sort), asc(categories.id));
		return c.json({ categories: rows });
	})
	.post("/categories", zValidator("json", categoryInput), async (c) => {
		const db = createDb(c.env.DB);
		const data = c.req.valid("json");
		if (data.parentId != null) {
			const all = await db
				.select({ id: categories.id, parentId: categories.parentId })
				.from(categories);
			const err = validateCategoryNesting(all, data.parentId);
			if (err) return c.json({ error: err }, 400);
		}
		const [row] = await db.insert(categories).values(data).returning();
		return c.json({ category: row });
	})
	.put(
		"/categories/reorder",
		zValidator("json", reorderSchema),
		async (c) => {
			const db = createDb(c.env.DB);
			const { ids } = c.req.valid("json");
			for (const [i, id] of ids.entries()) {
				await db.update(categories).set({ sort: i }).where(eq(categories.id, id));
			}
			return c.json({ ok: true });
		},
	)
	.put("/categories/:id", idParam, zValidator("json", categoryInput.partial()), async (c) => {
		const db = createDb(c.env.DB);
		const id = c.req.valid("param").id;
		const data = c.req.valid("json");
		// 防循环 + 限制三级(移动时带上子孙一起算深度)
		if (data.parentId != null) {
			const all = await db
				.select({ id: categories.id, parentId: categories.parentId })
				.from(categories);
			const err = validateCategoryNesting(all, data.parentId, id);
			if (err) return c.json({ error: err }, 400);
		}
		const [row] = await db
			.update(categories)
			.set(data)
			.where(eq(categories.id, id))
			.returning();
		if (!row) return c.json({ error: "Not found" }, 404);
		return c.json({ category: row });
	})
	// 批量删除分类:子分类级联删除,直属书签置为未分类(均由外键级联处理);ids 分片规避 D1 变量数限制
	.post(
		"/categories/batch-delete",
		zValidator("json", z.object({ ids: z.array(z.number().int()).min(1).max(1000) })),
		async (c) => {
			const db = createDb(c.env.DB);
			const { ids } = c.req.valid("json");
			for (let i = 0; i < ids.length; i += 90) {
				await db.delete(categories).where(inArray(categories.id, ids.slice(i, i + 90)));
			}
			return c.json({ ok: true, count: ids.length });
		},
	)
	.delete("/categories/:id", idParam, async (c) => {
		const db = createDb(c.env.DB);
		await db.delete(categories).where(eq(categories.id, c.req.valid("param").id));
		return c.json({ ok: true });
	})
	// ---------- 书签 ----------
	.get("/bookmarks", async (c) => {
		const db = createDb(c.env.DB);
		const rows = await db
			.select()
			.from(bookmarks)
			.orderBy(desc(bookmarks.isPinned), asc(bookmarks.sort), asc(bookmarks.id));
		const links = await db
			.select({ bookmarkId: bookmarkTags.bookmarkId, name: tags.name })
			.from(bookmarkTags)
			.innerJoin(tags, eq(bookmarkTags.tagId, tags.id));
		const map = new Map<number, string[]>();
		for (const l of links) {
			map.set(l.bookmarkId, [...(map.get(l.bookmarkId) ?? []), l.name]);
		}
		return c.json({
			bookmarks: rows.map((r) => ({ ...r, tags: map.get(r.id) ?? [] })),
		});
	})
	.post("/bookmarks", zValidator("json", bookmarkInput), async (c) => {
		const db = createDb(c.env.DB);
		const { tags: tagNames, ...data } = c.req.valid("json");
		const [row] = await db.insert(bookmarks).values(data).returning();
		if (tagNames) await syncTags(db, row.id, tagNames);
		return c.json({ bookmark: row });
	})
	.put(
		"/bookmarks/reorder",
		zValidator("json", reorderSchema),
		async (c) => {
			const db = createDb(c.env.DB);
			const { ids } = c.req.valid("json");
			for (const [i, id] of ids.entries()) {
				await db.update(bookmarks).set({ sort: i }).where(eq(bookmarks.id, id));
			}
			return c.json({ ok: true });
		},
	)
	// ---------- 批量操作(需注册在 /bookmarks/:id 之前;分片规避 D1 单语句 100 个绑定变量限制) ----------
	.put(
		"/bookmarks/batch-category",
		zValidator(
			"json",
			z.object({
				ids: z.array(z.number().int()).min(1).max(1000),
				categoryId: z.number().int().nullable(),
			}),
		),
		async (c) => {
			const db = createDb(c.env.DB);
			const { ids, categoryId } = c.req.valid("json");
			if (categoryId !== null) {
				const [cat] = await db
					.select({ id: categories.id })
					.from(categories)
					.where(eq(categories.id, categoryId));
				if (!cat) return c.json({ error: "分类不存在" }, 400);
			}
			for (let i = 0; i < ids.length; i += 90) {
				await db
					.update(bookmarks)
					.set({ categoryId, updatedAt: new Date() })
					.where(inArray(bookmarks.id, ids.slice(i, i + 90)));
			}
			return c.json({ ok: true, count: ids.length });
		},
	)
	.post(
		"/bookmarks/batch-delete",
		zValidator("json", z.object({ ids: z.array(z.number().int()).min(1).max(1000) })),
		async (c) => {
			const db = createDb(c.env.DB);
			const { ids } = c.req.valid("json");
			for (let i = 0; i < ids.length; i += 90) {
				await db.delete(bookmarks).where(inArray(bookmarks.id, ids.slice(i, i + 90)));
			}
			return c.json({ ok: true, count: ids.length });
		},
	)
	.put("/bookmarks/:id", idParam, zValidator("json", bookmarkInput.partial()), async (c) => {
		const db = createDb(c.env.DB);
		const { tags: tagNames, ...data } = c.req.valid("json");
		const [row] = await db
			.update(bookmarks)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(bookmarks.id, c.req.valid("param").id))
			.returning();
		if (!row) return c.json({ error: "Not found" }, 404);
		if (tagNames) await syncTags(db, row.id, tagNames);
		return c.json({ bookmark: row });
	})
	.delete("/bookmarks/:id", idParam, async (c) => {
		const db = createDb(c.env.DB);
		await db.delete(bookmarks).where(eq(bookmarks.id, c.req.valid("param").id));
		return c.json({ ok: true });
	})
	// ---------- 元信息抓取 ----------
	.post(
		"/metadata",
		zValidator("json", z.object({ url: z.string().url() })),
		async (c) => {
			try {
				return c.json(await fetchMetadata(c.req.valid("json").url));
			} catch {
				return c.json({ error: "抓取失败,请检查网址是否可访问" }, 422);
			}
		},
	)
	// ---------- 导入导出(Netscape Bookmark HTML,兼容 Chrome/Edge/Firefox/Safari) ----------
	.post(
		"/import",
		zValidator("json", z.object({ html: z.string().min(1).max(20_000_000) })),
		async (c) => {
			const db = createDb(c.env.DB);
			const tree = parseNetscapeHtml(c.req.valid("json").html);
			// 同名同父级分类复用;同 URL 书签跳过,重复导入不产生脏数据
			const existingCats = await db.select().from(categories);
			const catKey = new Map(
				existingCats.map((r) => [`${r.parentId ?? 0}:${r.name}`, r.id]),
			);
			const existingUrls = new Set(
				(await db.select({ url: bookmarks.url }).from(bookmarks)).map((r) => r.url),
			);
			let catCount = 0;
			let bmCount = 0;
			let skipped = 0;

			async function importBookmarks(
				folder: ParsedFolder,
				categoryId: number | null,
			) {
				for (const b of folder.bookmarks) {
					if (existingUrls.has(b.url)) {
						skipped++;
						continue;
					}
					existingUrls.add(b.url);
					await db.insert(bookmarks).values({
						title: b.title.slice(0, 200),
						url: b.url,
						icon: b.icon,
						categoryId,
						...(b.addDate ? { createdAt: new Date(b.addDate * 1000) } : {}),
					});
					bmCount++;
				}
				for (const child of folder.children) {
					const key = `${categoryId ?? 0}:${child.name}`;
					let id = catKey.get(key);
					if (id === undefined) {
						const [row] = await db
							.insert(categories)
							.values({ name: child.name.slice(0, 50), parentId: categoryId })
							.returning({ id: categories.id });
						id = row.id;
						catKey.set(key, id);
						catCount++;
					}
					await importBookmarks(child, id);
				}
			}

			await importBookmarks(tree, null);
			return c.json({ categories: catCount, bookmarks: bmCount, skipped });
		},
	)
	.get("/export", async (c) => {
		const db = createDb(c.env.DB);
		const cats = await db
			.select()
			.from(categories)
			.orderBy(asc(categories.sort), asc(categories.id));
		const bms = await db
			.select()
			.from(bookmarks)
			.orderBy(asc(bookmarks.sort), asc(bookmarks.id));
		const toEntry = (b: (typeof bms)[number]) => ({
			title: b.title,
			url: b.url,
			icon: b.icon,
			addDate: Math.floor(b.createdAt.getTime() / 1000),
		});
		// 按 parentId 重建文件夹树,保留任意层级
		const folderById = new Map<number, ExportFolder>(
			cats.map((cat) => [
				cat.id,
				{
					name: cat.name,
					addDate: Math.floor(cat.createdAt.getTime() / 1000),
					children: [],
					bookmarks: [],
				},
			]),
		);
		const rootFolders: ExportFolder[] = [];
		for (const cat of cats) {
			const node = folderById.get(cat.id)!;
			const parent = cat.parentId !== null ? folderById.get(cat.parentId) : undefined;
			if (parent) parent.children.push(node);
			else rootFolders.push(node);
		}
		const rootBookmarks = [];
		for (const b of bms) {
			const folder = b.categoryId !== null ? folderById.get(b.categoryId) : undefined;
			if (folder) folder.bookmarks.push(toEntry(b));
			else rootBookmarks.push(toEntry(b));
		}
		const html = buildNetscapeHtml(rootBookmarks, rootFolders);
		const date = new Date().toISOString().slice(0, 10);
		return c.body(html, 200, {
			"Content-Type": "text/html; charset=utf-8",
			"Content-Disposition": `attachment; filename="bookmarks-${date}.html"`,
		});
	})
	// ---------- 死链检测(后台手动触发,前端分批调用) ----------
	.post(
		"/check-links",
		zValidator("json", z.object({ ids: z.array(z.number().int()).min(1).max(10) })),
		async (c) => {
			const db = createDb(c.env.DB);
			const rows = await db
				.select({ id: bookmarks.id, url: bookmarks.url })
				.from(bookmarks)
				.where(inArray(bookmarks.id, c.req.valid("json").ids));
			const results = await Promise.all(
				rows.map(async (r) => ({
					id: r.id,
					status: (await checkUrl(r.url)) ? ("active" as const) : ("dead" as const),
				})),
			);
			for (const r of results) {
				await db
					.update(bookmarks)
					.set({ status: r.status })
					.where(eq(bookmarks.id, r.id));
			}
			return c.json({ results });
		},
	)
	// ---------- 标签 ----------
	.get("/tags", async (c) => {
		const db = createDb(c.env.DB);
		return c.json({ tags: await db.select().from(tags).orderBy(asc(tags.name)) });
	})
	// ---------- 站点设置 ----------
	.get("/settings", async (c) => {
		const db = createDb(c.env.DB);
		const rows = await db.select().from(settings);
		return c.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
	})
	.put(
		"/settings",
		zValidator("json", z.record(z.string(), z.string())),
		async (c) => {
			const db = createDb(c.env.DB);
			for (const [key, value] of Object.entries(c.req.valid("json"))) {
				await db
					.insert(settings)
					.values({ key, value })
					.onConflictDoUpdate({ target: settings.key, set: { value } });
			}
			return c.json({ ok: true });
		},
	);
