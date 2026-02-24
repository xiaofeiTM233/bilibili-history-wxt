import {
  IS_SYNCING,
  SYNC_INTERVAL,
  SYNC_TIME_REMAIN,
  IS_SYNC_DELETE_FROM_BILIBILI,
  CLOUD_SYNC_CONFIG,
  IS_CLOUD_SYNCING,
  CLOUD_SYNC_TIME_REMAIN,
} from "../utils/constants";
import { openDB, getItem, deleteHistoryItem } from "../utils/db";
import { getStorageValue, setStorageValue } from "../utils/storage";
import { uploadToCloud, downloadFromCloud, testCloudConnection, oneDriveAuth } from "../utils/cloudSync";
import { CloudSyncConfig, CloudSyncResult } from "../utils/types";

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });

  // 初始化定时任务
  browser.runtime.onInstalled.addListener((details) => {
    // 设置每分钟同步一次
    browser.alarms.create("syncHistory", {
      periodInMinutes: 1,
    });

    // 首次安装时打开历史记录页面
    if (details.reason === "install") {
      browser.tabs.create({ url: "/my-history.html" });
    }
  });

  const intervalSync = async (syncInterval: number) => {
    try {
      // 检查是否正在同步
      const isSyncing = await getStorageValue(IS_SYNCING);
      if (isSyncing) {
        console.log("同步正在进行中，跳过本次定时同步");
        return;
      }

      // 设置同步状态为进行中
      await setStorageValue(IS_SYNCING, true);

      // 执行增量同步
      await syncHistory(false);
    } catch (error) {
      console.error("定时同步失败:", error);
    } finally {
      // 无论成功还是失败，都重置同步状态
      await setStorageValue(IS_SYNCING, false);
      // 重置当前同步剩余时间
      await setStorageValue(SYNC_TIME_REMAIN, syncInterval);
    }
  };

  // 云同步定时任务处理
  const intervalCloudSync = async (syncInterval: number) => {
    try {
      // 获取云同步配置
      const config = await getStorageValue<CloudSyncConfig | undefined>(CLOUD_SYNC_CONFIG);
      if (!config || !config.enabled || !config.autoSync) {
        console.log("云同步未启用或未配置自动同步");
        return;
      }

      // 检查是否正在云同步
      const isCloudSyncing = await getStorageValue(IS_CLOUD_SYNCING);
      if (isCloudSyncing) {
        console.log("云同步正在进行中，跳过本次定时同步");
        return;
      }

      // 设置云同步状态为进行中
      await setStorageValue(IS_CLOUD_SYNCING, true);

      // 根据同步方向执行同步
      let result: CloudSyncResult;
      if (config.syncDirection === "download") {
        result = await downloadFromCloud(config);
      } else {
        // upload 或 bidirectional 都执行上传
        result = await uploadToCloud(config);
      }

      console.log("云同步结果:", result.message);
    } catch (error) {
      console.error("云同步失败:", error);
    } finally {
      // 无论成功还是失败，都重置同步状态
      await setStorageValue(IS_CLOUD_SYNCING, false);
      // 重置当前同步剩余时间
      await setStorageValue(CLOUD_SYNC_TIME_REMAIN, syncInterval);
    }
  };

  // 监听定时任务
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "syncHistory") {
      // 获取同步间隔
      const syncInterval = await getStorageValue(SYNC_INTERVAL, 1);
      // 获取当前同步剩余时间
      const syncRemain = await getStorageValue(SYNC_TIME_REMAIN, syncInterval);
      // 当前同步剩余时间减1
      const currentSyncRemain = syncRemain - 1;
      // 如果当前同步剩余时间大于0，则不进行同步
      if (currentSyncRemain > 0) {
        console.log(`还需${currentSyncRemain}分钟进行同步，暂时跳过`);
        // 更新同步剩余时间
        await setStorageValue(SYNC_TIME_REMAIN, currentSyncRemain);
        return;
      }
      // 使用提取的函数处理定时任务
      intervalSync(syncInterval);
    } else if (alarm.name === "cloudSync") {
      // 获取云同步配置
      const config = await getStorageValue<CloudSyncConfig | undefined>(CLOUD_SYNC_CONFIG);
      if (!config || !config.enabled || !config.autoSync) {
        return;
      }
      // 获取云同步间隔
      const syncInterval = config.syncInterval || 60;
      // 获取当前云同步剩余时间
      const syncRemain = await getStorageValue(CLOUD_SYNC_TIME_REMAIN, syncInterval);
      // 当前同步剩余时间减1
      const currentSyncRemain = syncRemain - 1;
      // 如果当前同步剩余时间大于0，则不进行同步
      if (currentSyncRemain > 0) {
        console.log(`云同步还需${currentSyncRemain}分钟进行同步，暂时跳过`);
        // 更新同步剩余时间
        await setStorageValue(CLOUD_SYNC_TIME_REMAIN, currentSyncRemain);
        return;
      }
      // 执行云同步
      intervalCloudSync(syncInterval);
    }
  });

  // 处理同步历史记录的消息
  const handleSyncHistory = async (
    message: any,
    sendResponse: (response: any) => void
  ) => {
    try {
      // 检查是否正在同步
      const isSyncing = await getStorageValue(IS_SYNCING);
      if (isSyncing) {
        console.log("同步正在进行中，请稍后再试");
        sendResponse({
          success: false,
          error: "同步正在进行中，请稍后再试",
        });
        return;
      }

      // 设置同步状态为进行中
      await setStorageValue(IS_SYNCING, true);

      // 获取前端传递的isFullSync参数
      const forceFullSync = message.isFullSync || false;

      if (forceFullSync) {
        // 如果前端强制要求全量同步
        await syncHistory(true);
        sendResponse({ success: true, message: "全量同步成功" });
      } else {
        // 执行增量同步
        await syncHistory(false);
        sendResponse({ success: true, message: "增量同步成功" });
      }
    } catch (error) {
      console.error("同步失败:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      });
    } finally {
      // 无论成功还是失败，都重置同步状态
      await setStorageValue(IS_SYNCING, false);
    }
  };

  // 处理删除历史记录的消息
  const handleDeleteHistoryItem = async (
    message: any,
    sendResponse: (response: any) => void
  ) => {
    try {
      const syncDeleteFromBilibili = await getStorageValue(
        IS_SYNC_DELETE_FROM_BILIBILI,
        true
      );
      if (!syncDeleteFromBilibili) {
        sendResponse({ success: true, message: "同步删除未开启" });
        return;
      }
      await deleteHistoryItem(message.id);
      sendResponse({ success: true, message: "历史记录删除成功" });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "删除失败",
      });
    }
  };

  // 处理云同步上传的消息
  const handleCloudUpload = async (
    message: any,
    sendResponse: (response: any) => void
  ) => {
    try {
      const isCloudSyncing = await getStorageValue(IS_CLOUD_SYNCING);
      if (isCloudSyncing) {
        sendResponse({ success: false, error: "云同步正在进行中，请稍后再试" });
        return;
      }

      await setStorageValue(IS_CLOUD_SYNCING, true);
      const config = message.config as CloudSyncConfig;
      const result = await uploadToCloud(config);
      sendResponse(result);
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "上传失败",
      });
    } finally {
      await setStorageValue(IS_CLOUD_SYNCING, false);
    }
  };

  // 处理云同步下载的消息
  const handleCloudDownload = async (
    message: any,
    sendResponse: (response: any) => void
  ) => {
    try {
      const isCloudSyncing = await getStorageValue(IS_CLOUD_SYNCING);
      if (isCloudSyncing) {
        sendResponse({ success: false, error: "云同步正在进行中，请稍后再试" });
        return;
      }

      await setStorageValue(IS_CLOUD_SYNCING, true);
      const config = message.config as CloudSyncConfig;
      const result = await downloadFromCloud(config);
      sendResponse(result);
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "下载失败",
      });
    } finally {
      await setStorageValue(IS_CLOUD_SYNCING, false);
    }
  };

  // 处理测试云同步连接的消息
  const handleTestCloudConnection = async (
    message: any,
    sendResponse: (response: any) => void
  ) => {
    try {
      const config = message.config as CloudSyncConfig;
      const result = await testCloudConnection(config);
      sendResponse(result);
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "连接测试失败",
      });
    }
  };

  // 处理保存云同步配置的消息
  const handleSaveCloudConfig = async (
    message: any,
    sendResponse: (response: any) => void
  ) => {
    try {
      const config = message.config as CloudSyncConfig;
      await setStorageValue(CLOUD_SYNC_CONFIG, config);
      // 重置云同步剩余时间
      await setStorageValue(CLOUD_SYNC_TIME_REMAIN, config.syncInterval || 60);
      sendResponse({ success: true, message: "配置保存成功" });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "配置保存失败",
      });
    }
  };

  // 处理获取云同步配置的消息
  const handleGetCloudConfig = async (
    _message: any,
    sendResponse: (response: any) => void
  ) => {
    try {
      const config = await getStorageValue<CloudSyncConfig | undefined>(CLOUD_SYNC_CONFIG);
      sendResponse({ success: true, config });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "获取配置失败",
      });
    }
  };

  // 处理 OneDrive 授权的消息
  const handleOneDriveAuth = async (
    _message: any,
    sendResponse: (response: any) => void
  ) => {
    try {
      const result = await oneDriveAuth();
      if (result.success && result.data) {
        // 获取现有配置并更新 token
        const config = await getStorageValue<CloudSyncConfig | undefined>(CLOUD_SYNC_CONFIG) || {
          type: "onedrive" as const,
          enabled: true,
          autoSync: false,
          syncInterval: 60,
          syncDirection: "upload" as const,
        };
        config.token = result.data.token;
        config.tokenExpires = Date.now() + (result.data.expiresIn - 300) * 1000;
        await setStorageValue(CLOUD_SYNC_CONFIG, config);
        sendResponse({ success: true, message: "授权成功" });
      } else {
        sendResponse({ success: false, error: result.message });
      }
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "授权失败",
      });
    }
  };

  // 处理撤销 OneDrive 授权的消息
  const handleRevokeOneDriveAuth = async (
    _message: any,
    sendResponse: (response: any) => void
  ) => {
    try {
      // 获取现有配置
      const config = await getStorageValue<CloudSyncConfig | undefined>(CLOUD_SYNC_CONFIG);
      if (!config || config.type !== "onedrive") {
        sendResponse({ success: false, message: "未找到 OneDrive 配置" });
        return;
      }

      // 清除 token 和 refresh_token
      if (config) {
        config.token = "";
        config.refreshToken = "";
        config.tokenExpires = 0;
        await setStorageValue(CLOUD_SYNC_CONFIG, config);
      }

      sendResponse({ success: true, message: "授权已撤销" });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "撤销授权失败",
      });
    }
  };

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "syncHistory") {
      handleSyncHistory(message, sendResponse);
      return true; // 保持消息通道开放
    } else if (message.action === "getCookies") {
      // 使用 Promise 风格处理 cookies，避免回调签名导致的类型或运行时错误
      browser.cookies.getAll({ domain: "bilibili.com" })
        .then((cookies) => sendResponse({ success: true, cookies }))
        .catch((error) => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));
      return true;
    } else if (message.action === "deleteHistoryItem") {
      handleDeleteHistoryItem(message, sendResponse);
      return true; // 保持消息通道开放
    } else if (message.action === "cloudUpload") {
      handleCloudUpload(message, sendResponse);
      return true;
    } else if (message.action === "cloudDownload") {
      handleCloudDownload(message, sendResponse);
      return true;
    } else if (message.action === "testCloudConnection") {
      handleTestCloudConnection(message, sendResponse);
      return true;
    } else if (message.action === "saveCloudConfig") {
      handleSaveCloudConfig(message, sendResponse);
      return true;
    } else if (message.action === "getCloudConfig") {
      handleGetCloudConfig(message, sendResponse);
      return true;
    } else if (message.action === "oneDriveAuth") {
      handleOneDriveAuth(message, sendResponse);
      return true;
    } else if (message.action === "revokeOneDriveAuth") {
      handleRevokeOneDriveAuth(message, sendResponse);
      return true;
    }
  });

  // 全量同步历史记录
  async function syncHistory(isFullSync = false): Promise<boolean> {
    try {
      // 获取 B 站 cookie
      const cookies = await browser.cookies.getAll({
        domain: "bilibili.com",
      });
      const SESSDATA = cookies.find(
        (cookie) => cookie.name === "SESSDATA"
      )?.value;

      if (!SESSDATA) {
        throw new Error("未找到 B 站登录信息，请先登录 B 站");
      }

      let hasMore = true;
      let max = 0;
      let view_at = 0;
      const type = "all";
      const ps = 30;

      // 循环获取所有历史记录
      while (hasMore) {
        // 获取历史记录
        const response = await fetch(
          `https://api.bilibili.com/x/web-interface/history/cursor?max=${max}&view_at=${view_at}&type=${type}&ps=${ps}`,
          {
            headers: {
              Cookie: `SESSDATA=${SESSDATA}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("获取历史记录失败");
        }

        const data = await response.json();

        if (data.code !== 0) {
          throw new Error(data.message || "获取历史记录失败");
        }

        // 更新分页参数
        hasMore = data.data.list.length > 0;
        max = data.data.cursor.max;
        view_at = data.data.cursor.view_at;

        if (data.data.list.length > 0) {
          // 为每批数据创建新的事务
          const db = await openDB();
          const tx = db.transaction("history", "readwrite");
          const store = tx.objectStore("history");
          // 取出list中的第一条和最后一条
          if (!isFullSync) {
            const firstItem = data.data.list[0];
            const lastItem = data.data.list[data.data.list.length - 1];
            // 如果firstItem的bvid和lastItem的bvid在indexedDB中存在，则不进行同步
            const firstItemExists = await getItem(store, firstItem.history.oid);
            const lastItemExists = await getItem(store, lastItem.history.oid);
            if (firstItemExists && lastItemExists) {
              console.log("增量同步至此结束");
              hasMore = false;
            }
          }

          // 批量存储历史记录
          for (const item of data.data.list) {
            // put是异步的
            store.put({
              id: item.history.oid,
              business: item.history.business,
              bvid: item.history.bvid,
              cid: item.history.cid,
              title: item.title,
              tag_name: item.tag_name,
              cover: item.cover || (item.covers && item.covers[0]),
              view_at: item.view_at,
              uri: item.uri,
              author_name: item.author_name || "",
              author_mid: item.author_mid || "",
              timestamp: Date.now(),
            });
          }
          console.log(`同步了${data.data.list.length}条历史记录`);

          // 等待事务完成
          await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
          });

          // 添加延时，避免请求过于频繁
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // 更新最后同步时间
      await browser.storage.local.set({ lastSync: Date.now() });

      return true;
    } catch (error) {
      console.error("同步历史记录失败:", error);
      throw error;
    }
  }
});
