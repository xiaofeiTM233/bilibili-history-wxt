import React from "react";
import { Pagination as AntPagination } from "antd";
import type { PaginationProps as AntPaginationProps } from "antd";

interface PaginationProps {
    currentPage: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalItems,
    pageSize,
    onPageChange,
}) => {
    if (totalItems <= 0 || pageSize <= 0) return null;

    const handlePageChange: AntPaginationProps["onChange"] = (page) => {
        onPageChange(page);
    };

    return (
        <div className="flex justify-center py-6">
            <AntPagination
                current={currentPage}
                total={totalItems}
                pageSize={pageSize}
                onChange={handlePageChange}
                showSizeChanger={false}
                showQuickJumper
                showTotal={(total) => `共 ${total} 个`}
                locale={{
                    items_per_page: "条/页",
                    jump_to: "跳至",
                    page: "页",
                    prev_page: "上一页",
                    next_page: "下一页",
                    prev_5: "向前 5 页",
                    next_5: "向后 5 页",
                    prev_3: "向前 3 页",
                    next_3: "向后 3 页",
                }}
            />
        </div>
    );
};
