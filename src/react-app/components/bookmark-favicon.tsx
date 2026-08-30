import { useMemo, useState } from "react";
import { Globe } from "lucide-react";
import { bookmarkIconCandidates, type Bookmark } from "@/lib/api";

// 书签图标:按候选项依次尝试加载,全部失败后回退为占位图标
export function BookmarkFavicon({
	bookmark,
	iconService,
	className,
}: {
	bookmark: Bookmark;
	iconService?: string;
	className?: string;
}) {
	const sources = useMemo(
		() => bookmarkIconCandidates(bookmark, iconService),
		[bookmark, iconService],
	);
	const [index, setIndex] = useState(0);
	const [lastKey, setLastKey] = useState({ bookmark, iconService });
	// 书签或图标服务变化时重置候选下标(渲染期间调整 state)
	if (lastKey.bookmark !== bookmark || lastKey.iconService !== iconService) {
		setLastKey({ bookmark, iconService });
		setIndex(0);
	}
	const src = sources[index];
	if (!src) return <Globe className={className} />;
	return (
		<img
			key={src}
			src={src}
			alt=""
			className={className}
			loading="lazy"
			onError={() => setIndex((i) => i + 1)}
		/>
	);
}