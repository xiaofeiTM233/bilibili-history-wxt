import { useState, useEffect } from "react";
import "./App.css";
import { Button, Checkbox, Space } from "antd";
function App() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingFav, setIsSyncingFav] = useState(false);
  const [status, setStatus] = useState("");
  const [isFullSync, setIsFullSync] = useState(false);

  useEffect(() => {
    // 检查同步状态
    const checkSyncStatus = async () => {
      const result = await browser.storage.local.get("lastSync");
      if (result.lastSync) {
        const lastSync = new Date(result.lastSync);
        setStatus(`上次同步时间：${lastSync.toLocaleString()}`);
      } else {
        setStatus("尚未同步过历史记录");
      }
    };
    checkSyncStatus();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setStatus("正在同步...");

    try {
      const response = await browser.runtime.sendMessage({
        action: "syncHistory",
        isFullSync: isFullSync,
      });

      if (response && response.success) {
        setStatus(response.message);
      } else {
        setStatus("同步失败：" + (response ? response.error : "未知错误"));
      }
    } catch (error) {
      setStatus("同步失败：" + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncFav = async () => {
    setIsSyncingFav(true);
    setStatus("正在同步收藏夹...");

    try {
      const response = await browser.runtime.sendMessage({
        action: "syncFavorites",
      });

      if (response && response.success) {
        setStatus(response.message);
      } else {
        setStatus("同步收藏夹失败：" + (response ? response.error : "未知错误"));
      }
    } catch (error) {
      setStatus("同步收藏夹失败：" + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsSyncingFav(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2.5">
        <h2 className="text-xl font-bold">Bilibili 无限历史记录</h2>
        <Button
          type="primary"
          block
          className="no-hover-effect"
          onClick={() => {
            browser.tabs.create({
              url: "/my-history.html",
            });
          }}
          disabled={isSyncing}
        >
          打开历史记录页面
        </Button>
        <Button
          type="primary"
          block
          className="no-hover-effect"
          onClick={handleSync}
          disabled={isSyncing}
          loading={isSyncing}
        >
          {isSyncing ? "同步中..." : "立即同步"}
        </Button>
        <Button
          type="primary"
          block
          onClick={handleSyncFav}
          disabled={isSyncing || isSyncingFav}
          loading={isSyncingFav}
          style={{ backgroundColor: "#fb7299" }}
        >
          {isSyncingFav ? "收藏夹同步中..." : "同步收藏夹"}
        </Button>
        <Space align="center">
          <Checkbox
            id="fullSync"
            checked={isFullSync}
            onChange={(e) => setIsFullSync(e.target.checked)}
            disabled={isSyncing}
          >
            全量同步
          </Checkbox>
        </Space>
        {status && <div className="mt-2.5 text-gray-600">{status}</div>}
      </div >
    </>
  );
}

export default App;
