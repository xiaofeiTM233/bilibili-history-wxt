import { useEffect, useState, useRef } from "react";
import { getFavFolders, getFavResources } from "../../utils/db";
import { FavoriteFolder, FavoriteResource } from "../../utils/types";
import { Folder, ChevronDownIcon, RefreshCwIcon } from "lucide-react";
import { Pagination } from "../../components/Pagination";
import { useDebounce } from "use-debounce";

export const Favorites = () => {
    const [folders, setFolders] = useState<FavoriteFolder[]>([]);
    const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
    const [resources, setResources] = useState<FavoriteResource[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 50;
    const [keyword, setKeyword] = useState("");
    const [debouncedKeyword] = useDebounce(keyword, 500);
    const [searchType, setSearchType] = useState("all");
    const [isSearchTypeOpen, setIsSearchTypeOpen] = useState(false);
    const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadFolders();
    }, []);

    useEffect(() => {
        if (selectedFolderId) {
            loadResources(selectedFolderId);
        } else if (folders.length > 0) {
            // Default select first folder
            setSelectedFolderId(folders[0].id);
        }
    }, [folders, selectedFolderId, debouncedKeyword, searchType, startDate, endDate]);

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
            const list = await getFavResources(folderId, debouncedKeyword, searchType, startDate, endDate);
            setResources(list);
            setCurrentPage(1);
        } catch (error) {
            console.error("加载收藏资源失败", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        // Scroll to top of content
        if (contentRef.current) {
            contentRef.current.scrollTop = 0;
        }
    };

    const startIndex = (currentPage - 1) * pageSize;
    const currentResources = resources.slice(startIndex, startIndex + pageSize);

    const searchTypeOptions = [
        { value: "all", label: "综合" },
        { value: "title", label: "标题" },
        { value: "author", label: "作者" },
        { value: "bvid", label: "BV" },
        { value: "id", label: "AV" },
    ];

    return (
        <div className="flex h-screen bg-gray-50">
            {/* 左侧收藏夹列表 */}
            <div className="w-64 bg-white border-r overflow-y-auto flex-shrink-0">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Folder className="w-5 h-5" />
                        我的收藏夹
                    </h2>
                </div>
                <div className="p-2">
                    {folders.map((folder) => (
                        <div
                            key={folder.id}
                            className={`p-3 rounded-lg cursor-pointer mb-1 transition-colors ${selectedFolderId === folder.id
                                ? "bg-blue-50 text-blue-600"
                                : "hover:bg-gray-100"
                                }`}
                            onClick={() => setSelectedFolderId(folder.id)}
                        >
                            <div className="font-medium truncate">{folder.title}</div>
                            <div className="text-xs text-gray-400 mt-1">
                                {folder.media_count}个内容
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 右侧内容列表 */}
            <div className="flex-1 flex flex-col">
                {/* 顶部固定筛选栏 */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5 sticky top-0 bg-white py-4 px-10 z-10 border-b border-gray-200 shadow-sm">
                    <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full whitespace-nowrap">
                        {selectedFolderId ? `当前收藏夹：${folders.find((f) => f.id === selectedFolderId)?.title}` : "请选择收藏夹"}
                    </span>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* 日期范围选择器 */}
                        <div className="relative z-20">
                            {isDateDropdownOpen && (
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setIsDateDropdownOpen(false)}
                                ></div>
                            )}

                            <button
                                onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                                className={`
                                    flex items-center justify-between px-4 py-2
                                    bg-gray-50 hover:bg-gray-100
                                    border transition-all duration-200
                                    text-gray-700 text-sm font-medium
                                    rounded-lg min-w-[100px] outline-none
                                    ${isDateDropdownOpen
                                        ? 'border-blue-500 ring-2 ring-blue-100 bg-white'
                                        : 'border-gray-200'
                                    }
                                `}
                            >
                                <span className="truncate">
                                    {startDate && endDate ? `${startDate.substring(5)}~${endDate.substring(5)}` : "日期"}
                                </span>
                                <ChevronDownIcon
                                    className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isDateDropdownOpen ? 'rotate-180 text-blue-500' : ''}`}
                                />
                            </button>

                            {isDateDropdownOpen && (
                                <div className="absolute top-full left-0 mt-2 w-[240px] bg-white border border-gray-100 rounded-xl shadow-xl z-30 p-4 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">开始日期</label>
                                            <input
                                                type="date"
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">结束日期</label>
                                            <input
                                                type="date"
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                            />
                                        </div>
                                        {(startDate || endDate) && (
                                            <button
                                                className="w-full px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                onClick={() => {
                                                    setStartDate("");
                                                    setEndDate("");
                                                }}
                                            >
                                                清除日期
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 搜索类型选择器 */}
                        <div className="relative z-20">
                            {isSearchTypeOpen && (
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setIsSearchTypeOpen(false)}
                                ></div>
                            )}

                            <button
                                onClick={() => setIsSearchTypeOpen(!isSearchTypeOpen)}
                                className={`
                                    flex items-center justify-between px-4 py-2
                                    bg-gray-50 hover:bg-gray-100
                                    border transition-all duration-200
                                    text-gray-700 text-sm font-medium
                                    rounded-lg w-[100px] outline-none
                                    ${isSearchTypeOpen
                                        ? 'border-blue-500 ring-2 ring-blue-100 bg-white'
                                        : 'border-gray-200'
                                    }
                                `}
                            >
                                <span>
                                    {searchTypeOptions.find(opt => opt.value === searchType)?.label || "综合"}
                                </span>
                                <ChevronDownIcon
                                    className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isSearchTypeOpen ? 'rotate-180 text-blue-500' : ''}`}
                                />
                            </button>

                            {isSearchTypeOpen && (
                                <div className="absolute top-full left-0 mt-2 w-[100px] bg-white border border-gray-100 rounded-xl shadow-xl z-30 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left">
                                    {searchTypeOptions.map((option) => (
                                        <div
                                            key={option.value}
                                            onClick={() => {
                                                setSearchType(option.value);
                                                setIsSearchTypeOpen(false);
                                                setKeyword("");
                                                setStartDate("");
                                                setEndDate("");
                                            }}
                                            className={`
                                                px-4 py-2.5 text-sm cursor-pointer transition-colors
                                                flex items-center justify-between
                                                ${searchType === option.value
                                                    ? 'bg-blue-50 text-blue-600 font-medium'
                                                    : 'text-gray-700 hover:bg-gray-50'
                                                }
                                            `}
                                        >
                                            {option.label}
                                            {searchType === option.value && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 搜索输入框 */}
                        {searchType === "title" || searchType === "author" || searchType === "all" ? (
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-[250px] px-3 py-2 border border-gray-200 rounded"
                                    placeholder={
                                        searchType === "title" ? "搜索标题..." :
                                        searchType === "author" ? "搜索作者..." :
                                        "搜索标题或作者..."
                                    }
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                />
                                {keyword && (
                                    <button
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition-colors"
                                        onClick={() => setKeyword("")}
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-4 w-4"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M6 18L18 6M6 6l12 12"
                                            />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ) : searchType === "bvid" || searchType === "id" ? (
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-[250px] px-3 py-2 border border-gray-200 rounded"
                                    placeholder={searchType === "bvid" ? "输入BV号（如: BV1xx411c7w）" : "输入av号（如: av123456）"}
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                />
                                {keyword && (
                                    <button
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition-colors"
                                        onClick={() => setKeyword("")}
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-4 w-4"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M6 18L18 6M6 6l12 12"
                                            />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ) : null}

                        {/* 刷新按钮 */}
                        <button
                            onClick={() => {
                                if (selectedFolderId) {
                                    loadResources(selectedFolderId);
                                }
                            }}
                            className="p-2 border border-gray-200 rounded-full bg-gray-50 hover:bg-gray-100"
                        >
                            <RefreshCwIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto" ref={contentRef}>
                    <div className="p-6">
                        {loading ? (
                            <div className="text-center py-10 text-gray-500">加载中...</div>
                        ) : (
                            <>
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-6">
                                    {currentResources.map((item) => (
                                        <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden flex flex-col bg-white hover:shadow-md transition-shadow">
                                            <a
                                                href={`https://www.bilibili.com/video/${item.bvid}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="no-underline text-inherit flex flex-col h-full"
                                            >
                                                <div>
                                                    <div className="relative w-full aspect-video">
                                                        <img
                                                            src={`${item.cover.replace("http:", "https:")}@760w_428h_1c.avif`}
                                                            alt={item.title}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                        />
                                                    </div>
                                                    <div className="p-3 flex-1 flex flex-col">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <h3
                                                                className="m-0 text-sm leading-[1.4] h-10 overflow-hidden line-clamp-2 flex-1"
                                                                title={item.title}
                                                            >
                                                                {item.title}
                                                            </h3>
                                                        </div>
                                                        <div className="flex justify-between items-center text-gray-500 text-xs mt-2">
                                                            <span
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    window.open(
                                                                        `https://space.bilibili.com/${item.upper?.mid}`,
                                                                        "_blank"
                                                                    );
                                                                }}
                                                                className="hover:text-[#fb7299] transition-colors cursor-pointer truncate mr-2"
                                                            >
                                                                {item.upper?.name}
                                                            </span>
                                                            <span className="shrink-0">
                                                                {new Date((item.fav_time || item.ctime) * 1000).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </a>
                                        </div>
                                    ))}
                                    {currentResources.length === 0 && (
                                        <div className="col-span-full text-center py-10 text-gray-400">
                                            这个收藏夹是空的
                                        </div>
                                    )}
                                </div>
                                <div className="mt-8">
                                    <Pagination
                                        currentPage={currentPage}
                                        totalItems={resources.length}
                                        pageSize={pageSize}
                                        onPageChange={handlePageChange}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
