import { useEffect, useState, useRef } from "react";
import { getFavFolders, getFavResources } from "../../utils/db";
import { FavoriteFolder, FavoriteResource } from "../../utils/types";
import {
  FolderOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useDebounce } from "use-debounce";
import {
  Select,
  Input,
  DatePicker,
  Button,
  Menu,
  Tag,
  Spin,
  Empty,
  Space,
} from "antd";
import type { Dayjs } from "dayjs";
import "dayjs/locale/zh-cn";

export const Favorites = () => {
    const [folders, setFolders] = useState<FavoriteFolder[]>([]);
    const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
    const [resources, setResources] = useState<FavoriteResource[]>([]);
    const [loading, setLoading] = useState(false);
    const [keyword, setKeyword] = useState("");
    const [debouncedKeyword] = useDebounce(keyword, 500);
    const [searchType, setSearchType] = useState("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadFolders();
    }, []);

    useEffect(() => {
        if (selectedFolderId) {
            loadResources(selectedFolderId);
        } else if (folders.length > 0) {
            setSelectedFolderId(folders[0].id);
        }
    }, [folders, selectedFolderId, debouncedKeyword, searchType, startDate, endDate, dateRange]);

    const loadFolders = async () => {
        try {
            const list = await getFavFolders();
            // Sort by index
            const sortedList = list.sort((a, b) => (a.index || 0) - (b.index || 0));
            setFolders(sortedList);
        } catch (error) {
            console.error("加载收藏夹失败", error);
        }
    };

    const loadResources = async (folderId: number) => {
        setLoading(true);
        try {
            const list = await getFavResources(
                folderId,
                debouncedKeyword,
                searchType,
                startDate,
                endDate
            );
            setResources(list);
        } catch (error) {
            console.error("加载收藏资源失败", error);
        } finally {
            setLoading(false);
        }
    };

    const searchTypeOptions = [
        { value: "all", label: "综合" },
        { value: "title", label: "标题" },
        { value: "author", label: "作者" },
        { value: "bvid", label: "BV号" },
        { value: "id", label: "AV号" },
    ];

    const selectedFolder = folders.find((f) => f.id === selectedFolderId);

    return (
        <div className="flex h-screen bg-gray-50">
            {/* 左侧收藏夹列表 */}
            <div className="w-64 bg-white border-r overflow-y-auto flex-shrink-0">
                <div className="p-4 border-b flex items-center gap-2">
                    <FolderOutlined className="text-xl" />
                    <h2 className="text-lg font-bold">我的收藏夹</h2>
                </div>
                <Menu
                    selectedKeys={selectedFolderId ? [selectedFolderId.toString()] : []}
                    onClick={(e) => setSelectedFolderId(Number(e.key))}
                    items={folders.map((folder) => ({
                        key: folder.id.toString(),
                        label: (
                            <div>
                                <div className="font-medium truncate">{folder.title}</div>
                                <div className="text-xs text-gray-400">
                                    {folder.media_count}个内容
                                </div>
                            </div>
                        ),
                    }))}
                    className="border-r-0"
                />
            </div>

            {/* 右侧内容列表 */}
            <div className="flex-1 flex flex-col">
                {/* 顶部固定筛选栏 */}
                <div className="flex flex-wrap items-center justify-between gap-4 sticky top-0 bg-white py-4 px-10 z-10 border-b border-gray-200 shadow-sm">
                    <Tag color="blue">
                        {selectedFolder ? `当前收藏夹：${selectedFolder.title}（${resources.length}）` : "请选择收藏夹"}
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

                        {/* 搜索类型选择器 */}
                        <Select
                            value={searchType}
                            onChange={(value) => {
                                setSearchType(value);
                                setKeyword("");
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
                            style={{ width: 300 }}
                            placeholder={
                                searchType === "title"
                                    ? "搜索标题..."
                                    : searchType === "author"
                                    ? "搜索作者..."
                                    : searchType === "bvid"
                                    ? "输入BV号（如: BV1GJ411x7h7）"
                                    : searchType === "id"
                                    ? "输入av号（如: av80433022）"
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
                                if (selectedFolderId) {
                                    loadResources(selectedFolderId);
                                }
                            }}
                        >
                            刷新
                        </Button>
                    </Space>
                </div>

                <div className="flex-1 overflow-y-auto" ref={contentRef}>
                    <div className="p-6">
                        {loading ? (
                            <div className="text-center py-10">
                                <Spin />
                            </div>
                        ) : (
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
                                {resources.map((item) => (
                                    <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                                <a
                                                    href={`https://www.bilibili.com/video/${item.bvid}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="no-underline text-inherit"
                                                >
                                                    <div>
                                                        <div className="relative w-full aspect-video">
                                                            <img
                                                                alt={item.title}
                                                                src={`${item.cover.replace("http:", "https:")}@760w_428h_1c.avif`}
                                                                className="w-full h-full object-cover"
                                                                loading="lazy"
                                                            />
                                                        </div>
                                                        <div className="p-2.5">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <h3
                                                                    className="m-0 text-sm leading-[1.4] h-10 overflow-hidden line-clamp-2 flex-1"
                                                                    title={item.title}
                                                                >
                                                                    {item.title}
                                                                </h3>
                                                            </div>
                                                            <div className="flex justify-between items-center text-gray-500 text-xs mt-1">
                                                                <a
                                                                    href={`https://space.bilibili.com/${item.upper?.mid}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                    }}
                                                                    className="hover:text-[#fb7299] transition-colors no-underline text-inherit"
                                                                >
                                                                    {item.upper?.name}
                                                                </a>
                                                                <span className="shrink-0">
                                                                    {new Date((item.fav_time || item.ctime) * 1000).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </a>
                                    </div>
                                ))}
                            </div>
                        )}
                        {resources.length === 0 && !loading && (
                            <Empty description="这个收藏夹是空的" />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
