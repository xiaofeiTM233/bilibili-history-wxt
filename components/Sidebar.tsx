import { Menu } from "antd";
import {
  HistoryOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import type { MenuProps } from "antd";

type MenuItem = Required<MenuProps>["items"][number];

const items: MenuItem[] = [
  {
    key: "/",
    icon: <HistoryOutlined />,
    label: "历史记录",
  },
  {
    key: "/settings",
    icon: <SettingOutlined />,
    label: "设置",
  },
];

export const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleMenuClick: MenuProps["onClick"] = (e) => {
    navigate(e.key);
  };

  return (
    <div className="fixed top-0 left-0 w-40 bg-gray-50 flex-shrink-0 h-full">
      <Menu
        mode="vertical"
        selectedKeys={[location.pathname]}
        items={items}
        onClick={handleMenuClick}
        className="border-r-0 h-full"
      />
      <p className="absolute bottom-2 left-2 text-gray-600 text-sm">
        v2.0.4
      </p>
    </div>
  );
};
