import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "../../components/Sidebar";
import Settings from "../../pages/Settings";
import { History } from "../../pages/History";
import { ConfigProvider, App as AntApp } from "antd";
import zhCN from "antd/locale/zh_CN";

const App = () => {
  return (
    <HashRouter>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: "#fb7299",
          },
          components: {
            FloatButton: {
              colorPrimary: "#fb7299",
            },
          },
        }}
      >
        <AntApp>
          <div className="flex h-screen">
            <Sidebar />
            {/* 主内容区域 */}
            <div className="ml-40 w-full">
              <Routes>
                <Route path="/" element={<History />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </div>
        </AntApp>
      </ConfigProvider>
    </HashRouter>
  );
};

export default App;
