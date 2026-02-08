import { Input, DatePicker, Button, Tag, Space, Select } from "antd";
import { SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";

interface FilterBarProps {
  title: string;
  showTypeSelect?: boolean;
  selectedType?: string;
  onTypeChange?: (value: string) => void;
  typeOptions?: { value: string; label: string }[];
  searchType: string;
  onSearchTypeChange: (value: string) => void;
  keyword: string;
  onKeywordChange: (value: string) => void;
  startDate: string;
  endDate: string;
  dateRange: [Dayjs, Dayjs] | null;
  onDateRangeChange: (dates: [Dayjs, Dayjs] | null, start: string, end: string) => void;
  onRefresh: () => void;
  searchTypeOptions: { value: string; label: string }[];
}

export const FilterBar: React.FC<FilterBarProps> = ({
  title,
  showTypeSelect,
  selectedType,
  onTypeChange,
  typeOptions,
  searchType,
  onSearchTypeChange,
  keyword,
  onKeywordChange,
  startDate,
  endDate,
  dateRange,
  onDateRangeChange,
  onRefresh,
  searchTypeOptions,
}) => {
  const getPlaceholder = () => {
    if (searchType === "title") return "搜索标题...";
    if (searchType === "author") return "搜索作者...";
    if (searchType === "bvid") return "输入BV号（如: BV1GJ411x7h7）";
    if (searchType === "id") return "输入av号（如: av80433022）";
    return "搜索标题/作者/BV号/AV号...";
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 sticky top-0 bg-white py-4 px-10 z-10 border-b border-gray-200 shadow-sm">
      <Tag color="blue">{title}</Tag>

      <Space wrap size="middle">
        {showTypeSelect && onTypeChange && typeOptions && (
          <Select
            value={selectedType}
            onChange={onTypeChange}
            options={typeOptions}
            style={{ width: 100 }}
          />
        )}

        <DatePicker.RangePicker
          value={dateRange}
          onChange={(dates) => {
            if (dates) {
              onDateRangeChange(
                dates as [Dayjs, Dayjs],
                dates[0]!.format("YYYY-MM-DD"),
                dates[1]!.format("YYYY-MM-DD")
              );
            } else {
              onDateRangeChange(null, "", "");
            }
          }}
          placeholder={["开始日期", "结束日期"]}
          format="YYYY-MM-DD"
        />

        <Select
          value={searchType}
          onChange={onSearchTypeChange}
          options={searchTypeOptions}
          style={{ width: 100 }}
        />

        <Input
          type="text"
          style={{ width: 300 }}
          placeholder={getPlaceholder()}
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          prefix={<SearchOutlined />}
          allowClear
        />

        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          刷新
        </Button>
      </Space>
    </div>
  );
};
