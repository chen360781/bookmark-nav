import { hc } from "hono/client";
import type { AppType } from "../../worker";

// Hono RPC client:类型由 worker 导出的 AppType 端到端推导
export const client = hc<AppType>("/");

export type Visibility = "public" | "private";

export type Category = {
	id: number;
	name: string;
	icon: string | null;
	parentId: number | null;
	sort: number;
	visibility: Visibility;
};

// 把分类树按深度优先拍平,带层级深度与完整路径,供列表/下拉框缩进展示
export type FlatCategory = { category: Category; depth: number; path: string };

export function flattenCategoryTree(cats: Category[]): FlatCategory[] {
	const byParent = new Map<number | null, Category[]>();
	for (const cat of cats) {
		const key = cat.parentId ?? null;
		const list = byParent.get(key) ?? [];
		list.push(cat);
		byParent.set(key, list);
	}
	const result: FlatCategory[] = [];
	function walk(parentId: number | null, depth: number, prefix: string) {
		for (const cat of byParent.get(parentId) ?? []) {
			const path = prefix ? `${prefix} / ${cat.name}` : cat.name;
			result.push({ category: cat, depth, path });
			walk(cat.id, depth + 1, path);
		}
	}
	walk(null, 0, "");
	return result;
}

export type Bookmark = {
	id: number;
	title: string;
	url: string;
	description: string | null;
	icon: string | null;
	categoryId: number | null;
	sort: number;
	clickCount: number;
	isPinned: boolean;
	visibility: Visibility;
	status: "active" | "dead";
	tags: string[];
};

// 书签图标:优先自定义,否则取站点 favicon
export function bookmarkIcon(b: Pick<Bookmark, "icon" | "url">): string {
	if (b.icon) return b.icon;
	try {
		return `${new URL(b.url).origin}/favicon.ico`;
	} catch {
		return "";
	}
}
