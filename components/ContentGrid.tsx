import { Spin, Empty } from "antd";
import { Card } from "./Card";
import { HistoryItem as HistoryItemType } from "../utils/types";
import { FavoriteResource } from "../utils/types";
import { useRef, forwardRef, useImperativeHandle } from "react";

interface ContentGridProps {
  viewType: "favorites" | "history";
  history: HistoryItemType[];
  resources: FavoriteResource[];
  loading: boolean;
  hasMore: boolean;
  keyword: string;
  debouncedKeyword: string;
  onHistoryDelete: (id: number) => void;
  onLoadHistoryTotalCount: () => void;
}

export const ContentGrid = forwardRef<any, ContentGridProps>(({
  viewType,
  history,
  resources,
  loading,
  hasMore,
  keyword,
  debouncedKeyword,
  onHistoryDelete,
  onLoadHistoryTotalCount,
}, ref) => {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getLoadMoreElement: () => loadMoreRef.current,
  }));

  const getLoadMoreText = () => {
    if (viewType === "history") {
      if (history.length === 0) {
        return keyword.trim() ? "没有找到匹配的历史记录" : "暂无历史记录";
      }
      return loading ? "加载中..." : hasMore ? "向下滚动加载更多" : "没有更多了";
    } else {
      if (resources.length === 0) {
        return debouncedKeyword ? "没有找到匹配的收藏" : "暂无收藏";
      }
      return loading ? "加载中..." : hasMore ? "向下滚动加载更多" : "没有更多了";
    }
  };

  return (
    <div ref={ref}>
      <div className="p-6">
        {viewType === "history" ? (
          history.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
              {history.map((item) => (
                <Card
                  key={item.id}
                  item={item}
                  itemType="history"
                  onDelete={() => {
                    onHistoryDelete(item.id);
                    onLoadHistoryTotalCount();
                  }}
                />
              ))}
            </div>
          ) : (
            <Empty description={keyword.trim() ? "没有找到匹配的历史记录" : "暂无历史记录"} />
          )
        ) : resources.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {resources.map((item) => (
              <Card key={item.id} item={item} itemType="favorite" />
            ))}
          </div>
        ) : (
          <Empty description={debouncedKeyword ? "没有找到匹配的收藏" : "暂无收藏"} />
        )}
        <div ref={loadMoreRef} className="text-center my-8 load-more-trigger">
          {(viewType === "history" ? history.length > 0 : resources.length > 0) &&
            (loading ? <Spin /> : <span className="text-gray-500">{getLoadMoreText()}</span>)}
        </div>
      </div>
    </div>
  );
});

ContentGrid.displayName = "ContentGrid";
