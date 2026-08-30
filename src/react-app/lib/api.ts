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

// 书签图标候选:优先自定义 icon,其次按后台配置的图标服务模板按域名生成
export function bookmarkIconCandidates(
	b: Pick<Bookmark, "icon" | "url">,
	iconService?: string,
): string[] {
	const sources: string[] = [];
	if (b.icon) sources.push(b.icon);
	if (iconService) {
		try {
			const { hostname } = new URL(b.url);
			sources.push(iconService.split("{domain}").join(hostname));
		} catch {
			// 非法 URL:跳过服务模板
		}
	}
	return [...new Set(sources)];
}

// 书签图标主候选项(保持向后兼容)
export function bookmarkIcon(b: Pick<Bookmark, "icon" | "url">, iconService?: string): string {
	return bookmarkIconCandidates(b, iconService)[0] ?? "";
}
