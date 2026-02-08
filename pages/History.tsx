import { useState, useEffect, useRef } from "react";
import { getFavFolders, getFavResources, getFavResourcesCount, getHistory, getTotalHistoryCount } from "../utils/db";
import { FavoriteFolder, FavoriteResource, HistoryItem as HistoryItemType } from "../utils/types";
import { useDebounce } from "use-debounce";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { FilterBar } from "../components/FilterBar";
import { SideMenu } from "../components/SideMenu";
import { ContentGrid } from "../components/ContentGrid";
dayjs.locale("zh-cn");

type ViewType = "history" | "favorites";

export const History = () => {
  const [folders, setFolders] = useState<FavoriteFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [viewType, setViewType] = useState<ViewType>("history");
  const [resources, setResources] = useState<FavoriteResource[]>([]);
  const [history, setHistory] = useState<HistoryItemType[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword] = useDebounce(keyword, 500);
  const [authorKeyword, setAuthorKeyword] = useState("");
  const [debouncedAuthorKeyword] = useDebounce(authorKeyword, 500);
  const [searchType, setSearchType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedType, setSelectedType] = useState("all");
  const [date, setDate] = useState("");

  const observerRef = useRef<IntersectionObserver | null>(null);
  const isLoadingRef = useRef<boolean>(false);

  const typeOptions = [
    { value: "all", label: "全部" },
    { value: "archive", label: "视频" },
    { value: "live", label: "直播" },
    { value: "pgc", label: "番剧" },
    { value: "article", label: "专栏" },
    { value: "cheese", label: "课堂" },
  ];

  const searchTypeOptions = [
    { value: "all", label: "综合" },
    { value: "title", label: "标题" },
    { value: "author", label: "作者" },
    { value: "bvid", label: "BV号" },
    { value: "id", label: "AV号" },
  ];

  useEffect(() => {
    loadFolders();
  }, []);

  useEffect(() => {
    if (viewType === "favorites") {
      if (selectedFolderId) {
        loadResources(selectedFolderId, false);
        loadTotalCount();
      } else if (folders.length > 0) {
        setSelectedFolderId(folders[0].id);
      }
    } else {
      loadHistory(false);
      loadHistoryTotalCount();
    }
  }, [folders, selectedFolderId, viewType, debouncedKeyword, debouncedAuthorKeyword, date, selectedType, searchType, startDate, endDate, dateRange]);

  const loadTotalCount = async () => {
    if (!selectedFolderId) return;
    const count = await getFavResourcesCount(selectedFolderId);
    setTotalCount(count);
  };

  const loadHistoryTotalCount = async () => {
    const count = await getTotalHistoryCount();
    setTotalCount(count);
  };

  const loadHistory = async (isAppend: boolean = false) => {
    if (isLoadingRef.current) return;

    try {
      setLoading(true);
      isLoadingRef.current = true;

      const lastViewTime = isAppend
        ? await new Promise<number | "">((resolve) => {
            setHistory((currentHistory) => {
              const lastTime = currentHistory.length > 0 ? currentHistory[currentHistory.length - 1].view_at : "";
              resolve(lastTime);
              return currentHistory;
            });
          })
        : "";

      const { items, hasMore } = await getHistory(
        lastViewTime,
        100,
        debouncedKeyword,
        debouncedAuthorKeyword,
        date,
        selectedType,
        searchType,
        startDate,
        endDate
      );

      if (isAppend) {
        setHistory((prev) => [...prev, ...items]);
      } else {
        setHistory(items);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      setHasMore(hasMore);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  const loadFolders = async () => {
    try {
      const list = await getFavFolders();
      const sortedList = list.sort((a, b) => (a.index || 0) - (b.index || 0));
      setFolders(sortedList);
    } catch (error) {
      console.error("加载收藏夹失败", error);
    }
  };

  const loadResources = async (folderId: number, isAppend: boolean = false) => {
    if (isLoadingRef.current) return;

    try {
      setLoading(true);
      isLoadingRef.current = true;

      const lastItem = isAppend && resources.length > 0 ? resources[resources.length - 1] : undefined;

      const result = await getFavResources(folderId, debouncedKeyword, searchType, startDate, endDate, lastItem);

      if (isAppend) {
        setResources((prev) => [...prev, ...result.items]);
      } else {
        setResources(result.items);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      setHasMore(result.hasMore);
    } catch (error) {
      console.error("加载收藏资源失败", error);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  const handleSearchTypeChange = (value: string) => {
    setSearchType(value);
    setKeyword("");
    setAuthorKeyword("");
    setDate("");
    setStartDate("");
    setEndDate("");
    setDateRange(null);
  };

  const handleRefresh = () => {
    if (viewType === "history") {
      loadHistory(false);
      loadHistoryTotalCount();
    } else if (selectedFolderId) {
      loadResources(selectedFolderId, false);
      loadTotalCount();
    }
  };

  const handleHistoryDelete = (id: number) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;

    const contentRefElement = contentRef.current;
    const loadMoreElement = contentRefElement?.querySelector('.my-8') as HTMLElement;

    if (!loadMoreElement) return;

    const options = {
      threshold: 0.1,
      rootMargin: "200px",
      root: contentRefElement,
    };
    observerRef.current = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoadingRef.current) {
        if (viewType === "history") {
          loadHistory(true);
        } else if (selectedFolderId) {
          loadResources(selectedFolderId, true);
        }
      }
    }, options);

    observerRef.current.observe(loadMoreElement);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, debouncedKeyword, debouncedAuthorKeyword, date, selectedType, searchType, startDate, endDate, dateRange, selectedFolderId, viewType]);

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  const getFilterTitle = () => {
    if (viewType === "history") {
      return `历史记录（${totalCount}）`;
    }
    if (selectedFolder) {
      return `${selectedFolder.title}（${totalCount}）`;
    }
    return "请选择收藏夹";
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <SideMenu
        viewType={viewType}
        selectedFolderId={selectedFolderId}
        folders={folders}
        totalCount={totalCount}
        onViewTypeChange={setViewType}
        onFolderChange={(folderId) => {
          setSelectedFolderId(folderId);
        }}
      />

      <div className="flex-1 flex flex-col">
        <FilterBar
          title={getFilterTitle()}
          showTypeSelect={viewType === "history"}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          typeOptions={typeOptions}
          searchType={searchType}
          onSearchTypeChange={handleSearchTypeChange}
          keyword={keyword}
          onKeywordChange={setKeyword}
          startDate={startDate}
          endDate={endDate}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          onRefresh={handleRefresh}
          searchTypeOptions={searchTypeOptions}
        />

        <ContentGrid
          ref={contentRef}
          viewType={viewType}
          history={history}
          resources={resources}
          loading={loading}
          hasMore={hasMore}
          keyword={keyword}
          debouncedKeyword={debouncedKeyword}
          onHistoryDelete={handleHistoryDelete}
          onLoadHistoryTotalCount={loadHistoryTotalCount}
        />
      </div>
    </div>
  );
};
