import {
  IS_SYNCING,
  SYNC_INTERVAL,
  SYNC_TIME_REMAIN,
  IS_SYNC_DELETE_FROM_BILIBILI,
} from "../utils/constants";
import { openDB, getItem, deleteHistoryItem } from "../utils/db";
import { getStorageValue, setStorageValue } from "../utils/storage";

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });

  // 初始化定时任务
  browser.runtime.onInstalled.addListener((details) => {
    // 设置每分钟同步一次
    browser.alarms.create("syncHistory", {
      periodInMinutes: 1,
    });

    // 只在首次安装时打开历史记录页面
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
