import React, { useState, useEffect, useRef } from "react";
import { HistoryItem } from "../components/HistoryItem";
import { getHistory, getTotalHistoryCount } from "../utils/db";
import { HistoryItem as HistoryItemType } from "../utils/types";
import { useDebounce } from "use-debounce";
import {
  Select,
  Input,
  Button,
  DatePicker,
  Tag,
  Spin,
  Space,
  Empty,
} from "antd";
import {
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
dayjs.locale("zh-cn");

export const History: React.FC = () => {
  const [history, setHistory] = useState<HistoryItemType[]>([]);
  const [keyword, setKeyword] = useState("");
  const [authorKeyword, setAuthorKeyword] = useState("");
  const [debouncedKeyword] = useDebounce(keyword, 500);
  const [debouncedAuthorKeyword] = useDebounce(authorKeyword, 500);
  const [date, setDate] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [totalHistoryCount, setTotalHistoryCount] = useState(0);
  const [searchType, setSearchType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadMoreRef = useRef<HTMLDivElement>(null);
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
    { value: "bvid", label: "BV" },
    { value: "id", label: "AV" },
  ];

  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  const loadHistory = async (isAppend: boolean = false) => {
    if (isLoadingRef.current) {
      return;
    }

    try {
      setIsLoading(true);
      isLoadingRef.current = true;

      // 使用函数式更新来获取最新的history值
      const lastViewTime = isAppend
        ? await new Promise<number | "">((resolve) => {
          setHistory((currentHistory) => {
            const lastTime =
              currentHistory.length > 0
                ? currentHistory[currentHistory.length - 1].view_at
                : "";
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
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  // 当debouncedKeyword或debouncedAuthorKeyword变化时重新加载数据
  useEffect(() => {
    loadHistory(false);
  }, [debouncedKeyword, debouncedAuthorKeyword, date, selectedType, searchType, startDate, endDate, dateRange]);

  useEffect(() => {
    getTotalCount();
  }, []);

  const getTotalCount = async () => {
    const count = await getTotalHistoryCount();
    setTotalHistoryCount(count);
  };

  useEffect(() => {
    const options = {
      threshold: 0.1,
      rootMargin: "200px",
    };
    // 设置Intersection Observer
    observerRef.current = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoadingRef.current) {
        // 闭包陷阱，这个函数会捕获第一次渲染时的history值
        // debouncedKeyword也是一样的问题
        loadHistory(true);
      }
    }, options);

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, debouncedKeyword, debouncedAuthorKeyword, date, selectedType, searchType, startDate, endDate, dateRange]);

  const getLoadMoreText = () => {
    if (history.length === 0) {
      return keyword.trim() ? "没有找到匹配的历史记录" : "暂无历史记录";
    }
    return isLoading
      ? "加载中..."
      : hasMore
        ? "向下滚动加载更多"
        : "没有更多了";
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 sticky top-0 bg-white py-4 px-10 z-10 border-b border-gray-200 shadow-sm">
        <Tag color="blue">
          总记录数：{totalHistoryCount}
        </Tag>

        <Space wrap size="middle">
            {/* 日期范围选择器 */}
            <DatePicker.RangePicker
              value={dateRange}
              onChange={(dates) => {
                setDateRange(dates as [Dayjs, Dayjs] | null);
                if (dates) {
                  setStartDate(dates[0]!.format("YYYY-MM-DD"));
                  setEndDate(dates[1]!.format("YYYY-MM-DD"));
                } else {
                  setStartDate("");
                  setEndDate("");
                }
              }}
              placeholder={["开始日期", "结束日期"]}
              format="YYYY-MM-DD"
            />

            {/* 分类选择器 */}
            <Select
              value={selectedType}
              onChange={(value) => setSelectedType(value)}
              options={typeOptions}
              style={{ width: 100 }}
            />

            {/* 搜索类型选择器 */}
            <Select
              value={searchType}
              onChange={(value) => {
                setSearchType(value);
                setKeyword("");
                setAuthorKeyword("");
                setDate("");
                setStartDate("");
                setEndDate("");
                setDateRange(null);
              }}
              options={searchTypeOptions}
              style={{ width: 100 }}
            />

            {/* 搜索输入框 */}
            <Input
              type="text"
              style={{ width: 250 }}
              placeholder={
                searchType === "title"
                  ? "搜索标题..."
                  : searchType === "author"
                  ? "搜索作者..."
                  : searchType === "bvid"
                  ? "搜索BV号..."
                  : searchType === "id"
                  ? "搜索AV号..."
                  : "搜索标题/作者/BV号/AV号..."
              }
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              prefix={<SearchOutlined />}
              allowClear
            />

            {/* 刷新按钮 */}
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                loadHistory(false);
                getTotalCount();
              }}
            >
              刷新
            </Button>
        </Space>
      </div>

      <div className="w-full px-6">
        {history.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {history.map((item) => (
              <HistoryItem
                key={item.id}
                item={item}
                onDelete={() => {
                  setHistory((prev) => prev.filter((h) => h.id !== item.id));
                  getTotalCount();
                }}
              />
            ))}
          </div>
        ) : (
          <Empty
            description={keyword.trim() ? "没有找到匹配的历史记录" : "暂无历史记录"}
          />
        )}
        <div ref={loadMoreRef} className="text-center my-8">
          {history.length > 0 && (isLoading ? <Spin /> : <span className="text-gray-500">{getLoadMoreText()}</span>)}
        </div>
      </div>
    </div>
  );
};
