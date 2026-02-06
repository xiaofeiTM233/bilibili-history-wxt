import { useState, useEffect } from "react";
import { clearHistory, saveHistory } from "../utils/db";
import { getStorageValue, setStorageValue } from "../utils/storage";
import {
  IS_SYNC_DELETE,
  SYNC_INTERVAL,
  IS_SYNC_DELETE_FROM_BILIBILI,
  FAV_SYNC_INTERVAL,
} from "../utils/constants";
import {
  exportHistoryToCSV,
  exportHistoryToJSON,
} from "../utils/export";
import { message, Modal, Switch, Button, Select, InputNumber, Card, Space, Divider } from "antd";
import { HistoryItem } from "../utils/types";

const Settings = () => {
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
  const [favSyncInterval, setFavSyncInterval] = useState(1440);

  useEffect(() => {
    const loadSettings = async () => {
      const syncDelete = await getStorageValue(IS_SYNC_DELETE, true);
      const syncDeleteFromBilibili = await getStorageValue(
        IS_SYNC_DELETE_FROM_BILIBILI,
        true
      );
      const storedSyncInterval = await getStorageValue(SYNC_INTERVAL, 1);
      const storedFavSyncInterval = await getStorageValue(FAV_SYNC_INTERVAL, 1440);

      setIsSyncDelete(syncDelete);
      setIsSyncDeleteFromBilibili(syncDeleteFromBilibili);
      setSyncInterval(storedSyncInterval);
      setFavSyncInterval(storedFavSyncInterval);
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

  const handleFavSyncIntervalChange = async (newInterval: number) => {
    if (newInterval >= 10) {
      setFavSyncInterval(newInterval);
      await setStorageValue(FAV_SYNC_INTERVAL, newInterval);
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

  return (
    <div className="p-6 container mx-auto">
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
                onChange={(value) => setExportFormat(value as "csv" | "json")}
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

          <Divider />

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-base font-medium text-pink-500">
                自动同步收藏夹时间间隔
              </h3>
              <p className="text-sm text-gray-500 mt-1">单位：分钟，最小值为10</p>
            </div>
            <Space size="large">
              <span className="text-gray-600">间隔时间：</span>
              <InputNumber
                mode="spinner"
                min={10}
                max={9999}
                step={10}
                value={favSyncInterval}
                onChange={(value) => handleFavSyncIntervalChange(value || 10)}
                style={{ width: 200 }}
              />
            </Space>
          </div>
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
    </div >
  );
};

export default Settings;
