import { useState, useEffect, useRef } from "react";
import "./App.css";
import { Button, Checkbox, Space } from "antd";
import { CloudUploadOutlined, CloudDownloadOutlined } from "@ant-design/icons";
import { CloudSyncConfig } from "../../utils/types";
import {
  CLOUD_SYNC_CONFIG,
  LAST_CLOUD_UPLOAD,
  LAST_CLOUD_DOWNLOAD,
} from "../../utils/constants";

function App() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatusState] = useState("");
  const [isFullSync, setIsFullSync] = useState(false);

  // 云同步相关状态
  const [cloudConfig, setCloudConfig] = useState<CloudSyncConfig | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const cloudConfigRef = useRef(cloudConfig);

  // 保持 ref 同步
  useEffect(() => {
    cloudConfigRef.current = cloudConfig;
  }, [cloudConfig]);

  // 格式化时间
  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return "尚未同步";
    return new Date(timestamp).toLocaleString();
  };

  // 自定义 setStatus：自动附加时间信息
  const setStatus = (currentStatus: string) => {
    const config = cloudConfigRef.current;
    browser.storage.local.get(["lastSync", LAST_CLOUD_UPLOAD, LAST_CLOUD_DOWNLOAD]).then((result) => {
      const lines: string[] = [];
      if (currentStatus) lines.push(currentStatus);
      if (result.lastSync) lines.push(`上次同步时间：${formatTime(result.lastSync)}`);
      if (config?.enabled && config.syncDirection === "upload" && result[LAST_CLOUD_UPLOAD]) {
        lines.push(`上次上传时间：${formatTime(result[LAST_CLOUD_UPLOAD])}`);
      }
      if (config?.enabled && config.syncDirection === "download" && result[LAST_CLOUD_DOWNLOAD]) {
        lines.push(`上次下载时间：${formatTime(result[LAST_CLOUD_DOWNLOAD])}`);
      }
      setStatusState(lines.join("\n"));
    });
  };

  useEffect(() => {
    // 初始化：加载配置并显示上次同步时间
    const initStatus = async () => {
      const configResult = await browser.storage.local.get(CLOUD_SYNC_CONFIG);
      const config = configResult[CLOUD_SYNC_CONFIG] || null;
      setCloudConfig(config);
      cloudConfigRef.current = config;
      setStatus("");
    };
    initStatus();
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
        setStatus("同步成功");
      } else {
        setStatus("同步失败：" + (response ? response.error : "未知错误"));
      }
    } catch (error) {
      setStatus("同步失败：" + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsSyncing(false);
    }
  };

  // 云同步上传
  const handleCloudUpload = async () => {
    setIsCloudSyncing(true);
    try {
      const response = await browser.runtime.sendMessage({
        action: "cloudUpload",
        config: cloudConfig,
      });
      if (response.success) {
        setStatus("云同步上传成功");
      } else {
        setStatus(response.message || "上传失败");
      }
    } catch (error) {
      setStatus("上传失败");
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // 云同步下载
  const handleCloudDownload = async () => {
    setIsCloudSyncing(true);
    try {
      const response = await browser.runtime.sendMessage({
        action: "cloudDownload",
        config: cloudConfig,
      });
      if (response.success) {
        setStatus("云同步下载成功");
      } else {
        setStatus(response.message || "下载失败");
      }
    } catch (error) {
      setStatus("下载失败");
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // 根据同步方向获取云同步按钮
  const getCloudSyncButton = () => {
    if (!cloudConfig?.enabled) return null;
    const isDisabled = cloudConfig.type === "webdav"
      ? !cloudConfig.serverUrl || !cloudConfig.username
      : !cloudConfig.token;

    if (cloudConfig.syncDirection === "upload") {
      return (
        <Button
          type="primary"
          block
          icon={<CloudUploadOutlined />}
          onClick={handleCloudUpload}
          loading={isCloudSyncing}
          disabled={isDisabled || isCloudSyncing}
        >
          云同步上传
        </Button>
      );
    }
    if (cloudConfig.syncDirection === "download") {
      return (
        <Button
          type="primary"
          block
          danger
          icon={<CloudDownloadOutlined />}
          onClick={handleCloudDownload}
          loading={isCloudSyncing}
          disabled={isDisabled || isCloudSyncing}
        >
          云同步下载
        </Button>
      );
    }
    return null;
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
        >
          打开历史记录页面
        </Button>
        {getCloudSyncButton()}
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
        {status && <div className="mt-2.5 text-gray-600 whitespace-pre-line">{status}</div>}
      </div >
    </>
  );
}

export default App;
