import { HistoryOutlined, FolderOutlined } from "@ant-design/icons";
import { Menu } from "antd";
import { FavoriteFolder } from "../utils/types";

interface SideMenuProps {
  viewType: "favorites" | "history";
  selectedFolderId: number | null;
  folders: FavoriteFolder[];
  totalCount: number;
  onViewTypeChange: (type: "favorites" | "history") => void;
  onFolderChange: (folderId: number) => void;
}

export const SideMenu: React.FC<SideMenuProps> = ({
  viewType,
  selectedFolderId,
  folders,
  totalCount,
  onViewTypeChange,
  onFolderChange,
}) => {
  return (
    <div className="w-64 bg-white border-r overflow-y-auto flex-shrink-0">
      <div className="p-4 border-b flex items-center gap-2">
        <FolderOutlined className="text-xl" />
        <h2 className="text-lg font-bold">Bilibili 无限历史记录</h2>
      </div>
      <Menu
        selectedKeys={viewType === "history" ? ["history"] : selectedFolderId ? [selectedFolderId.toString()] : []}
        onClick={(e) => {
          if (e.key === "history") {
            onViewTypeChange("history");
          } else {
            onViewTypeChange("favorites");
            onFolderChange(Number(e.key));
          }
        }}
        items={[
          {
            key: "history",
            label: (
              <div>
                <div className="font-medium truncate flex items-center gap-2">
                  <HistoryOutlined />
                  历史记录
                </div>
                <div className="text-xs text-gray-400">
                  {totalCount > 0 && viewType === "history" ? `${totalCount}个内容` : ""}
                </div>
              </div>
            ),
          },
          ...folders.map((folder) => ({
            key: folder.id.toString(),
            label: (
              <div>
                <div className="font-medium truncate">{folder.title}</div>
                <div className="text-xs text-gray-400">{folder.media_count}个内容</div>
              </div>
            ),
          })),
        ]}
        className="border-r-0"
      />
    </div>
  );
};
