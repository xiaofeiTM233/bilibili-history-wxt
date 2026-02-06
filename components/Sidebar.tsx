
import {
  Star,
  HistoryIcon,
  SettingsIcon,
} from "lucide-react";
import ExpandableMenu from "./ExpandableMenu";
import { UPDATE_HISTORY } from "../utils/constants";

const menuList = [
  {
    title: "历史记录",
    icon: <HistoryIcon className="w-4 h-4" />,
    to: "/",
  },
  {
    title: "收藏夹",
    icon: <Star className="w-4 h-4" />,
    to: "/favorites",
  },
  {
    title: "设置",
    icon: <SettingsIcon className="w-4 h-4" />,
    to: "/settings",
  },
];

export const Sidebar = () => {
  const version = UPDATE_HISTORY[0]?.version || "";

  return (
    <div className="fixed top-0 left-0 w-40 bg-gray-100 flex-shrink-0 h-full">
      <nav className="space-y-2 p-4">
        {menuList.map((item, index) => (
          <ExpandableMenu key={index} {...item} />
        ))}
      </nav>

      <p className="absolute bottom-2 left-2 text-gray-600 text-base">
        {version ? `v${version}` : ""}
      </p>
    </div>
  );
};
