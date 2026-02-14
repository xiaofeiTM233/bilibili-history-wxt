import { useState, useEffect, useRef } from "react";
import { getHistory, getTotalHistoryCount } from "../utils/db";
import { HistoryItem as HistoryItemType } from "../utils/types";
import { useDebounce } from "use-debounce";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { FilterBar } from "../components/FilterBar";
import { ContentGrid } from "../components/ContentGrid";
import { Splitter, FloatButton } from "antd";
dayjs.locale("zh-cn");

export const History = () => {
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
  const [splitterSize, setSplitterSize] = useState<number>(() => {
    const saved = localStorage.getItem('splitter-size');
    return saved ? Number(saved) : 0;
  });

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
    localStorage.setItem('splitter-size', splitterSize.toString());
  }, [splitterSize]);

  useEffect(() => {
    // 搜索条件改变时重置历史记录并重新加载
    setHistory([]);
    setHasMore(true);
    loadHistory(true);
    loadHistoryTotalCount();
  }, [debouncedKeyword, debouncedAuthorKeyword, date, selectedType, searchType, startDate, endDate, dateRange]);

  const loadHistoryTotalCount = async () => {
    const count = await getTotalHistoryCount();
    setTotalCount(count);
  };

  const loadHistory = async (reset: boolean = false) => {
    if (isLoadingRef.current) return;

    try {
      setLoading(true);
      isLoadingRef.current = true;

      const lastViewTime = reset ? "" : await new Promise<number | "">((resolve) => {
        setHistory((currentHistory) => {
          const lastTime = currentHistory.length > 0 ? currentHistory[currentHistory.length - 1].view_at : "";
          resolve(lastTime);
          return currentHistory;
        });
      });

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

      if (reset) {
        setHistory(items);
      } else {
        setHistory((prev) => [...prev, ...items]);
      }
      setHasMore(hasMore);
    } catch (error) {
      console.error("Failed to load history:", error);
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

  const handleDateRangeChange = (dates: [Dayjs, Dayjs] | null, start: string, end: string) => {
    setDateRange(dates);
    setStartDate(start);
    setEndDate(end);
  };

  const handleRefresh = () => {
    loadHistory();
    loadHistoryTotalCount();
  };

  const handleHistoryDelete = (id: number) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  const contentRef = useRef<any>(null);

  useEffect(() => {
    const loadMoreElement = contentRef.current?.getLoadMoreElement?.() as HTMLElement;

    if (!loadMoreElement) return;

    const options = {
      threshold: 0.1,
      rootMargin: "200px",
      root: null,
    };
    observerRef.current = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoadingRef.current) {
        loadHistory();
      }
    }, options);

    observerRef.current.observe(loadMoreElement);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, debouncedKeyword, debouncedAuthorKeyword, date, selectedType, searchType, startDate, endDate, dateRange]);

  const getFilterTitle = () => {
    return `历史记录（${totalCount}）`;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="flex-1 flex flex-col">
        <FilterBar
          title={getFilterTitle()}
          showTypeSelect={true}
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
          onDateRangeChange={handleDateRangeChange}
          onRefresh={handleRefresh}
          searchTypeOptions={searchTypeOptions}
        />

        <div className="flex-1 overflow-hidden">
          <Splitter style={{ height: '100%' }} onResize={(sizes: number[]) => setSplitterSize(sizes[0])}>
            <Splitter.Panel collapsible defaultSize={splitterSize} min="1%" max="80%">
              <div className="flex items-center justify-center h-full text-gray-400">
                <span></span>
              </div>
            </Splitter.Panel>
            <Splitter.Panel>
              <ContentGrid
                ref={contentRef}
                history={history}
                loading={loading}
                hasMore={hasMore}
                keyword={keyword}
                debouncedKeyword={debouncedKeyword}
                onHistoryDelete={handleHistoryDelete}
                onLoadHistoryTotalCount={loadHistoryTotalCount}
              />
            </Splitter.Panel>
          </Splitter>
        </div>
      </div>
      <FloatButton.BackTop
        type="primary"
        target={() => {
          const loadMoreEl: HTMLElement | undefined = contentRef.current?.getLoadMoreElement?.();
          if (!loadMoreEl) return document.body as HTMLElement;
          let el: HTMLElement | null = loadMoreEl;
          while (el && el !== document.body) {
            const style = window.getComputedStyle(el);
            if (style.overflowY === 'auto' || style.overflowY === 'scroll') return el;
            el = el.parentElement;
          }
          return document.body as HTMLElement;
        }}
      />
    </div>
  );
};
