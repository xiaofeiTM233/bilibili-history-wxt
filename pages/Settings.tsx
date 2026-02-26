import { useState, useEffect } from "react";
import { clearHistory, saveHistory } from "../utils/db";
import { getStorageValue, setStorageValue } from "../utils/storage";
import {
  IS_SYNC_DELETE,
  SYNC_INTERVAL,
  IS_SYNC_DELETE_FROM_BILIBILI,
  CLOUD_SYNC_CONFIG,
  LAST_CLOUD_UPLOAD,
  LAST_CLOUD_DOWNLOAD,
  EXPORT_FORMAT,
} from "../utils/constants";
import {
  exportHistoryToCSV,
  exportHistoryToJSON,
} from "../utils/export";
import { message, Modal, Switch, Button, Select, InputNumber, Card, Space, Divider, Input, Alert } from "antd";
import { HistoryItem, CloudSyncConfig, CloudSyncType } from "../utils/types";
import { CloudOutlined, CloudUploadOutlined, CloudDownloadOutlined, LinkOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const Settings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSyncDelete, setIsSyncDelete] = useState(true);
  const [isSyncDeleteFromBilibili, setIsSyncDeleteFromBilibili] =
    useState(true);

  const [showResetResultDialog, setShowResetResultDialog] = useState(false);
  const [resetResult, setResetResult] = useState("");
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState("");

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("json");
  const [syncInterval, setSyncInterval] = useState(1);

  // 从存储加载导出格式
  useEffect(() => {
    const loadExportFormat = async () => {
      const storedExportFormat = await getStorageValue<("csv" | "json") | undefined>(EXPORT_FORMAT);
      if (storedExportFormat) {
        setExportFormat(storedExportFormat);
      }
    };
    loadExportFormat();
  }, []);

  // 云同步相关状态
  const [cloudConfig, setCloudConfig] = useState<CloudSyncConfig>({
    type: "webdav",
    enabled: false,
    autoSync: false,
    syncInterval: 60,
    syncDirection: "upload",
  });
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [lastCloudUpload, setLastCloudUpload] = useState<number | null>(null);
  const [lastCloudDownload, setLastCloudDownload] = useState<number | null>(null);
  const [tokenStatus, setTokenStatus] = useState<{ isValid: boolean; expiresAt: number | null | undefined; isRefreshing: boolean }>({
    isValid: false,
    expiresAt: null,
    isRefreshing: false,
  });

  useEffect(() => {
    const loadSettings = async () => {
      const syncDelete = await getStorageValue(IS_SYNC_DELETE, true);
      const syncDeleteFromBilibili = await getStorageValue(
        IS_SYNC_DELETE_FROM_BILIBILI,
        true
      );
      const storedSyncInterval = await getStorageValue(SYNC_INTERVAL, 1);
      const storedCloudConfig = await getStorageValue<CloudSyncConfig | undefined>(CLOUD_SYNC_CONFIG);
      const storedLastUpload = await getStorageValue<number | null>(LAST_CLOUD_UPLOAD, null);
      const storedLastDownload = await getStorageValue<number | null>(LAST_CLOUD_DOWNLOAD, null);

      setIsSyncDelete(syncDelete);
      setIsSyncDeleteFromBilibili(syncDeleteFromBilibili);
      setSyncInterval(storedSyncInterval);
      if (storedCloudConfig) {
        setCloudConfig(storedCloudConfig);
        // 检查 OneDrive Token 状态
        if (storedCloudConfig.type === "onedrive" && storedCloudConfig.token) {
          const isTokenValid = storedCloudConfig.tokenExpires !== undefined && storedCloudConfig.tokenExpires > Date.now();
          setTokenStatus({
            isValid: isTokenValid,
            expiresAt: isTokenValid ? (storedCloudConfig.tokenExpires || null) : null,
            isRefreshing: false,
          });
        }
      }
      setLastCloudUpload(storedLastUpload);
      setLastCloudDownload(storedLastDownload);
      setIsLoading(false);
    };
    loadSettings();
  }, []);

  const handleSyncDeleteChange = async (checked: boolean) => {
    setIsSyncDelete(checked);
    await setStorageValue(IS_SYNC_DELETE, checked);
  };

  const handleSyncDeleteFromBilibiliChange = async (checked: boolean) => {
    setIsSyncDeleteFromBilibili(checked);
    await setStorageValue(IS_SYNC_DELETE_FROM_BILIBILI, checked);
  };

  const handleSyncIntervalChange = async (newInterval: number) => {
    if (newInterval >= 1) {
      setSyncInterval(newInterval);
      await setStorageValue(SYNC_INTERVAL, newInterval);
    }
  };

  const handleReset = async () => {
    try {
      setIsResetLoading(true);
      setResetStatus("正在清空历史记录...");
      await clearHistory();
      setResetStatus("正在清理存储...");
      await browser.storage.local.clear();
      setResetStatus("正在重新加载...");
      setResetResult("恢复出厂设置成功！");
    } catch (error) {
      console.error("恢复出厂设置失败:", error);
      setResetResult("恢复出厂设置失败，请重试！");
    } finally {
      setIsResetLoading(false);
      setResetStatus("");
      setShowResetResultDialog(true);
      setShowConfirmDialog(false);
    }
  };

  const handleExport = async (formatToExport: "csv" | "json") => {
    try {
      setIsExporting(true);
      if (formatToExport === "csv") {
        await exportHistoryToCSV();
        message.success("CSV导出成功！");
      } else if (formatToExport === "json") {
        await exportHistoryToJSON();
        message.success("JSON导出成功！");
      }
    } catch (error) {
      console.error(`导出 ${formatToExport.toUpperCase()} 失败:`, error);
      message.error(`导出 ${formatToExport.toUpperCase()} 失败，请重试！`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    try {
      setIsImporting(true);
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json";

      fileInput.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const jsonContent = e.target?.result as string;
              const items = JSON.parse(jsonContent) as HistoryItem[];
              if (
                !Array.isArray(items) ||
                items.some(
                  (item) =>
                    typeof item.id === "undefined" ||
                    typeof item.view_at === "undefined"
                )
              ) {
                message.error(
                  "文件内容格式不正确，请确保导入的是正确的历史记录文件。"
                );
                setIsImporting(false);
                return;
              }
              await saveHistory(items);
              message.success("历史记录导入成功！");
            } catch (parseError) {
              console.error("解析JSON文件失败:", parseError);
              message.error("导入失败，文件格式错误或内容不正确。");
            } finally {
              setIsImporting(false);
            }
          };
          reader.onerror = () => {
            console.error("读取文件失败");
            message.error("导入失败，无法读取文件。");
            setIsImporting(false);
          };
          reader.readAsText(file);
        } else {
          setIsImporting(false);
        }
      };

      fileInput.click();
    } catch (error) {
      console.error(`导入失败:`, error);
      message.error("导入失败，请重试。");
    } finally {
      setIsImporting(false);
    }
  };

  // 云同步相关处理函数
  const updateCloudConfig = (updates: Partial<CloudSyncConfig>) => {
    setCloudConfig((prev) => ({ ...prev, ...updates }));
  };

  const handleCloudConfigChange = async (updates: Partial<CloudSyncConfig>) => {
    await setStorageValue(CLOUD_SYNC_CONFIG, { ...cloudConfig, ...updates });
    setCloudConfig((prev) => ({ ...prev, ...updates }));
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      const response = await browser.runtime.sendMessage({
        action: "testCloudConnection",
        config: cloudConfig,
      });
      if (response.success) {
        message.success("连接测试成功");
      } else {
        message.error(response.message || "连接失败");
      }
    } catch (error) {
      message.error("连接测试失败");
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleCloudUpload = async () => {
    setIsCloudSyncing(true);
    try {
      const response = await browser.runtime.sendMessage({
        action: "cloudUpload",
        config: cloudConfig,
      });
      if (response.success) {
        message.success("上传成功");
        const uploadTime = await getStorageValue<number | null>(LAST_CLOUD_UPLOAD, null);
        setLastCloudUpload(uploadTime);
      } else {
        message.error(response.message || "上传失败");
      }
    } catch (error) {
      message.error("上传失败");
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleCloudDownload = async () => {
    Modal.confirm({
      title: "确认下载",
      content: "下载将覆盖本地所有历史记录，此操作不可恢复，是否继续？",
      okText: "确认",
      cancelText: "取消",
      onOk: async () => {
        setIsCloudSyncing(true);
        try {
          const response = await browser.runtime.sendMessage({
            action: "cloudDownload",
            config: cloudConfig,
          });
          if (response.success) {
            message.success("下载成功");
            const downloadTime = await getStorageValue<number | null>(LAST_CLOUD_DOWNLOAD, null);
            setLastCloudDownload(downloadTime);
          } else {
            message.error(response.message || "下载失败");
          }
        } catch (error) {
          message.error("下载失败");
        } finally {
          setIsCloudSyncing(false);
        }
      },
    });
  };

  // WebDAV 配置表单
  const renderWebDAVConfig = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">服务器地址</label>
        <Input
          placeholder="https://your-webdav-server.com/dav"
          value={cloudConfig.serverUrl || ""}
          onChange={(e) => handleCloudConfigChange({ serverUrl: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
        <Input
          placeholder="用户名"
          value={cloudConfig.username || ""}
          onChange={(e) => handleCloudConfigChange({ username: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
        <Input.Password
          placeholder="密码"
          value={cloudConfig.password || ""}
          onChange={(e) => handleCloudConfigChange({ password: e.target.value })}
        />
      </div>
    </div>
  );

  // OneDrive 配置表单
  const renderOneDriveConfig = () => {
    const handleOneDriveAuth = async () => {
      setIsTestingConnection(true);
      try {
        const response = await browser.runtime.sendMessage({
          action: "oneDriveAuth",
        });
        if (response.success) {
          message.success("授权成功");
          // 重新加载配置
          const configResponse = await browser.runtime.sendMessage({
            action: "getCloudConfig",
          });
          if (configResponse.success && configResponse.config) {
            setCloudConfig(configResponse.config);
          }
        } else {
          message.error(response.error || "授权失败");
        }
      } catch (error) {
        message.error("授权失败");
      } finally {
        setIsTestingConnection(false);
      }
    };

    const isAuthorized = cloudConfig.token && cloudConfig.tokenExpires != null && cloudConfig.tokenExpires > Date.now();
    const hasRefreshToken = cloudConfig.refreshToken != null && cloudConfig.refreshToken !== "";

    const handleOneDriveRefresh = async () => {
      setTokenStatus(prev => ({ ...prev, isRefreshing: true }));
      try {
        const response = await browser.runtime.sendMessage({
          action: "refreshOneDriveToken",
        });
        if (response.success) {
          message.success("令牌刷新成功！");
          setTokenStatus(prev => ({
            ...prev,
            isValid: true,
            expiresAt: response.tokenExpires,
            isRefreshing: false,
          }));
          // 重新加载配置
          const configResponse = await browser.runtime.sendMessage({
            action: "getCloudConfig",
          });
          if (configResponse.success && configResponse.config) {
            setCloudConfig(configResponse.config);
          }
        } else {
          message.error(response.message || "刷新失败");
          setTokenStatus(prev => ({ ...prev, isRefreshing: false }));
        }
      } catch (error) {
        message.error("刷新失败");
        setTokenStatus(prev => ({ ...prev, isRefreshing: false }));
      }
    };

    const handleRevokeAuth = async () => {
      try {
        const response = await browser.runtime.sendMessage({
          action: "revokeOneDriveAuth",
        });
        if (response.success) {
          message.success("授权已撤销");
          // 重新加载配置
          const configResponse = await browser.runtime.sendMessage({
            action: "getCloudConfig",
          });
          if (configResponse.success && configResponse.config) {
            setCloudConfig(configResponse.config);
          }
        } else {
          message.error(response.message || "撤销授权失败");
        }
      } catch (error) {
        message.error("撤销授权失败");
      }
    };

    const handleManageAuth = () => {
      window.open("https://account.live.com/consent/Manage", "_blank");
    };

    return (
      <div className="space-y-4">
        {isAuthorized ? (
          <Alert
            title="OneDrive 已授权"
            description={
              <div>
                <p>授权状态有效，过期时间：{dayjs(cloudConfig.tokenExpires).format("YYYY-MM-DD HH:mm:ss")}</p>
                <p>
                  <span>刷新令牌状态：</span>
                  <span className={`text-sm font-medium ${hasRefreshToken ? 'text-green-600' : 'text-red-600'}`}>
                    {hasRefreshToken ? '有效' : '失效'}
                  </span>
                </p>
              </div>
            }
            type="success"
            showIcon
          />
        ) : cloudConfig.token ? (
          <Alert
            title="授权已过期"
            description={
              <div>
                <p>请重新授权以继续使用 OneDrive 同步功能</p>
                <p>
                  <span>刷新令牌状态：</span>
                  <span className={`text-sm font-medium ${hasRefreshToken ? 'text-green-600' : 'text-red-600'}`}>
                    {hasRefreshToken ? '有效' : '失效'}
                  </span>
                </p>
              </div>
            }
            type="warning"
            showIcon
          />
        ) : (
          <Alert
            title="需要授权 OneDrive"
            description="点击下方按钮进行 Microsoft 账号授权"
            type="info"
            showIcon
          />
        )}

        <div className="flex justify-end gap-2">
          {isAuthorized && (
            <>
              <Button
                danger
                onClick={handleRevokeAuth}
              >
                断开连接
              </Button>
              <Button
                onClick={handleManageAuth}
              >
                撤销授权
              </Button>
            </>
          )}
          <Button
            type="primary"
            onClick={handleOneDriveAuth}
            loading={isTestingConnection}
          >
            {isAuthorized ? "重新授权" : "授权 OneDrive"}
          </Button>
          {hasRefreshToken && (
            <Button
              type="primary"
              onClick={handleOneDriveRefresh}
              loading={tokenStatus.isRefreshing}
              disabled={tokenStatus.isRefreshing}
            >
              刷新令牌
            </Button>
          )}
        </div>
      </div>
    );
  };

  // 定期检查 Token 状态（每 30 秒）
  useEffect(() => {
    const interval = setInterval(() => {
      if (cloudConfig.type === "onedrive" && cloudConfig.token) {
        const isTokenValid = cloudConfig.tokenExpires != null && cloudConfig.tokenExpires > Date.now();
        setTokenStatus(prev => ({
          ...prev,
          isValid: isTokenValid,
          expiresAt: isTokenValid ? cloudConfig.tokenExpires : null,
        }));
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [cloudConfig.type, cloudConfig.token, cloudConfig.tokenExpires]);

  return (
    <div className="p-6 container mx-auto">
      {isLoading ? (
        <div className="flex justify-center items-center h-96">
          <div className="text-gray-500">加载中...</div>
        </div>
      ) : (
        <>
          <Card className="mb-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-base font-medium">恢复出厂设置</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    清空所有本地历史记录数据和用户偏好，且无法恢复
                  </p>
                </div>
                <Button
                  danger
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={isResetLoading}
                >
                  恢复出厂
                </Button>
              </div>

              <Divider />

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-base font-medium text-blue-600">导出历史记录</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    将所有历史记录导出，方便备份和查看
                  </p>
                </div>
                <Space size="large">
                  <Select
                    value={exportFormat}
                    onChange={(value) => {
                      setExportFormat(value as "csv" | "json");
                      setStorageValue(EXPORT_FORMAT, value as "csv" | "json");
                    }}
                    disabled={isExporting}
                    style={{ width: 100 }}
                    options={[
                      { label: "JSON", value: "json" },
                      { label: "CSV", value: "csv" },
                    ]}
                  />
                  <Button
                    type="primary"
                    onClick={() => handleExport(exportFormat)}
                    disabled={isExporting}
                    loading={isExporting}
                  >
                    导出
                  </Button>
                </Space>
              </div>

              <Divider />

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-base font-medium text-blue-600">导入历史记录</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    将.json文件导入，恢复历史记录
                  </p>
                </div>
                <Button
                  type="primary"
                  onClick={() => handleImport()}
                  disabled={isImporting}
                  loading={isImporting}
                >
                  导入
                </Button>
              </div>
            </div>
          </Card>

          <Card className="mb-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-base font-medium">同步删除：插件 -&gt; B站</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    删除本地历史记录时同步删除B站服务器历史记录
                  </p>
                </div>
                <Switch checked={isSyncDelete} onChange={handleSyncDeleteChange} />
              </div>

              <Divider />

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-base font-medium">同步删除：B站 -&gt; 插件</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    在B站网页端删除历史记录时同步删除插件历史记录
                  </p>
                </div>
                <Switch checked={isSyncDeleteFromBilibili} onChange={handleSyncDeleteFromBilibiliChange} />
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-base font-medium text-fuchsia-600">
                    自动同步时间间隔
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">单位：分钟，最小值为1</p>
                </div>
                <Space size="large">
                  <span className="text-gray-600">间隔时间：</span>
                  <InputNumber
                    mode="spinner"
                    min={1}
                    max={999}
                    value={syncInterval}
                    onChange={(value) => handleSyncIntervalChange(value || 1)}
                    style={{ width: 200 }}
                  />
                </Space>
              </div>
            </div>
          </Card>

          {/* 云同步设置 */}
          <Card className="mb-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-base font-medium flex items-center gap-2">
                    <CloudOutlined className="text-blue-500" />
                    <span className="text-blue-600">云同步备份</span>
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    将历史记录备份到 WebDAV 或 OneDrive
                  </p>
                </div>
                <Switch
                  checked={cloudConfig.enabled}
                  onChange={(checked) => handleCloudConfigChange({ enabled: checked })}
                />
              </div>

              {cloudConfig.enabled && (
                <>
                  <Divider />

                  {/* 同步类型选择 */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-base font-medium">云服务类型</h3>
                    </div>
                    <Select
                      value={cloudConfig.type}
                      onChange={(value) => handleCloudConfigChange({ type: value as CloudSyncType })}
                      style={{ width: 150 }}
                      options={[
                        { label: "WebDAV", value: "webdav" },
                        { label: "OneDrive", value: "onedrive" },
                      ]}
                    />
                  </div>

                  <Divider />

                  {/* 根据类型显示配置表单 */}
                  {cloudConfig.type === "webdav" ? renderWebDAVConfig() : renderOneDriveConfig()}

                  <Divider />

                  {/* 同步方向 */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-base font-medium">同步方向</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        上传：本地覆盖云端 / 下载：云端覆盖本地
                      </p>
                    </div>
                    <Select
                      value={cloudConfig.syncDirection}
                      onChange={(value) => handleCloudConfigChange({ syncDirection: value as "upload" | "download" | "bidirectional" })}
                      style={{ width: 150 }}
                      options={[
                        { label: "上传到云端", value: "upload" },
                        { label: "从云端下载", value: "download" },
                      ]}
                    />
                  </div>

                  <Divider />

                  {/* 自动同步 */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-base font-medium">自动定时同步</h3>
                      <p className="text-sm text-gray-500 mt-1">按照设定的间隔自动执行同步</p>
                    </div>
                    <Switch
                      checked={cloudConfig.autoSync}
                      onChange={(checked) => handleCloudConfigChange({ autoSync: checked })}
                    />
                  </div>

                  {cloudConfig.autoSync && (
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-base font-medium text-fuchsia-600">
                          云同步间隔
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">单位：分钟，最小值为5</p>
                      </div>
                      <Space size="large">
                        <span className="text-gray-600">间隔时间：</span>
                        <InputNumber
                          mode="spinner"
                          min={5}
                          max={1440}
                          value={cloudConfig.syncInterval}
                          onChange={(value) => handleCloudConfigChange({ syncInterval: value || 60 })}
                          style={{ width: 200 }}
                        />
                      </Space>
                    </div>
                  )}

                  <Divider />

                  {/* 最后同步时间和操作按钮 */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      {lastCloudUpload && (
                        <p>上次上传：{dayjs(lastCloudUpload).format("YYYY-MM-DD HH:mm:ss")}</p>
                      )}
                      {lastCloudDownload && (
                        <p>上次下载：{dayjs(lastCloudDownload).format("YYYY-MM-DD HH:mm:ss")}</p>
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        icon={<LinkOutlined />}
                        onClick={handleTestConnection}
                        loading={isTestingConnection}
                      >
                        测试连接
                      </Button>
                      <Button
                        type="primary"
                        icon={<CloudUploadOutlined />}
                        onClick={handleCloudUpload}
                        loading={isCloudSyncing}
                        disabled={
                          cloudConfig.type === "webdav"
                            ? !cloudConfig.serverUrl || !cloudConfig.username
                            : !cloudConfig.token
                        }
                      >
                        立即上传
                      </Button>
                      <Button
                        type="primary"
                        danger
                        icon={<CloudDownloadOutlined />}
                        onClick={handleCloudDownload}
                        loading={isCloudSyncing}
                        disabled={
                          cloudConfig.type === "webdav"
                            ? !cloudConfig.serverUrl || !cloudConfig.username
                            : !cloudConfig.token
                        }
                      >
                        立即下载
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Modal
            title="确认恢复出厂设置？"
            open={showConfirmDialog}
            onOk={() => {
              handleReset();
            }}
            onCancel={() => setShowConfirmDialog(false)}
            okText="确认"
            cancelText="取消"
            okButtonProps={{ danger: true, loading: isResetLoading }}
            cancelButtonProps={{ disabled: isResetLoading }}
          >
            <p className="text-gray-600">
              此操作将删除所有本地存储的历史记录数据和用户偏好，且无法恢复。确定要继续吗？
            </p>
            {isResetLoading && (
              <p className="text-blue-600 mt-4">{resetStatus}</p>
            )}
          </Modal>

          <Modal
            open={showResetResultDialog}
            onOk={() => setShowResetResultDialog(false)}
            onCancel={() => setShowResetResultDialog(false)}
            okText="确定"
            cancelButtonProps={{ style: { display: "none" } }}
          >
            <p className="text-xl text-gray-600 text-center font-medium">
              {resetResult}
            </p>
          </Modal>
        </>
      )}
    </div>
  );
};

export default Settings;
