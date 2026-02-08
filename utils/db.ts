import { DBConfig, HistoryItem } from "./types";
import dayjs from "dayjs";

const DB_CONFIG: DBConfig = {
  name: "bilibiliHistory",
  version: 4,
  stores: {
    history: {
      keyPath: "id",
      indexes: ["view_at"],
    },
    favFolders: {
      keyPath: "id",
      indexes: ["mid"],
    },
    favResources: {
      keyPath: "id",
      indexes: ["folder_id", "fav_time"],
    },
  },
};

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = async (event) => {
      console.log("onupgradeneeded");
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction!;
      const oldVersion = event.oldVersion;
      const newVersion = event.newVersion || DB_CONFIG.version;

      console.log(`数据库升级: ${oldVersion} -> ${newVersion}`);

      // 首次创建数据库 (oldVersion === 0)
      if (oldVersion === 0) {
        const historyStore = db.createObjectStore("history", { keyPath: "id" });
        historyStore.createIndex("view_at", "view_at", { unique: false });

        console.log("首次创建数据库和索引");
      } else if (oldVersion === 1 && newVersion >= 2) {
        // 从版本1升级到版本2：重命名viewTime字段为view_at
        console.log("开始迁移数据：viewTime -> view_at");

        // 获取现有的对象存储
        const store = transaction.objectStore("history");

        // 删除旧的viewTime索引
        if (store.indexNames.contains("viewTime")) {
          store.deleteIndex("viewTime");
          console.log("删除旧的viewTime索引");
        }

        // 创建新的view_at索引
        store.createIndex("view_at", "view_at", { unique: false });
        console.log("创建新的view_at索引");

        // 迁移数据：将viewTime字段重命名为view_at
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => {
          const allRecords = getAllRequest.result;
          console.log(`开始迁移 ${allRecords.length} 条记录`);

          allRecords.forEach((record: any) => {
            if (record.viewTime !== undefined) {
              // 将viewTime重命名为view_at
              record.view_at = record.viewTime;
              delete record.viewTime;

              // 更新记录
              store.put(record);
            }
          });

          console.log("数据迁移完成");
        };

        getAllRequest.onerror = () => {
          console.error("数据迁移失败:", getAllRequest.error);
        };
      }

      if (oldVersion < 4 && newVersion >= 4) {
        console.log("创建收藏夹相关表");

        const favFoldersStore = db.createObjectStore("favFolders", {
          keyPath: "id",
        });
        favFoldersStore.createIndex("mid", "mid", { unique: false });

        const favResourcesStore = db.createObjectStore("favResources", {
          keyPath: "id",
        });
        favResourcesStore.createIndex("folder_id", "folder_id", { unique: false });
        favResourcesStore.createIndex("fav_time", "fav_time", { unique: false });

        console.log("收藏夹相关表创建完成");
      }
    };
  });
};

export const saveHistory = async (history: HistoryItem[]): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction("history", "readwrite");
  const store = tx.objectStore("history");

  return new Promise((resolve, reject) => {
    let operationsCompleted = 0;
    let operationsFailed = false;

    if (history.length === 0) {
      resolve();
      return;
    }

    history.forEach((item) => {
      if (operationsFailed) return;

      const request = store.put(item);
      request.onsuccess = () => {
        operationsCompleted++;
      };
      request.onerror = () => {
        if (!operationsFailed) {
          operationsFailed = true;
          console.error(
            "向 IndexedDB 中 put 项目失败:",
            request.error,
            "项目:",
            item
          );
        }
      };
    });

    tx.oncomplete = () => {
      if (!operationsFailed) {
        console.log("所有历史记录已成功保存/更新。");
        resolve();
      } else {
        reject(new Error("部分或全部历史记录项保存失败，但事务意外完成。"));
      }
    };

    tx.onerror = () => {
      console.error("保存/更新历史记录事务失败:", tx.error);
      reject(tx.error);
    };
  });
};

const matchCondition = (
  item: HistoryItem,
  keyword: string,
  authorKeyword: string,
  date: string,
  businessType: string
) => {
  return (
    matchKeyword(item, keyword) &&
    matchAuthorKeyword(item, authorKeyword) &&
    matchDate(item, date) &&
    matchBusinessType(item, businessType)
  );
};

const matchBusinessType = (item: HistoryItem, businessType: string) => {
  if (!businessType || businessType === "all") return true;
  // 专栏有两种类型：article 和 article-list，这里统一处理
  if (businessType === "article") {
    return item.business === "article" || item.business === "article-list";
  }
  return item.business === businessType;
};

const matchDate = (item: HistoryItem, date: string) => {
  if (!date) {
    return true;
  }
  const ts = Number(item.view_at);
  const d = dayjs(ts * 1000);
  const dateStr = d.format("YYYY-MM-DD");
  return dateStr === date;
};

const matchKeyword = (item: HistoryItem, keyword: string) => {
  return !keyword || item.title.toLowerCase().includes(keyword.toLowerCase());
};

const matchAuthorKeyword = (item: HistoryItem, authorKeyword: string) => {
  return (
    !authorKeyword ||
    item.author_name.toLowerCase().includes(authorKeyword.toLowerCase())
  );
};

// 匹配 BV 号（精准搜索）
const matchBvid = (item: HistoryItem, bvid: string) => {
  if (!bvid) return true;
  // 支持 BV、bv、Bv 等大小写组合
  const normalizedInput = bvid.toLowerCase();
  const normalizedBvid = item.bvid.toLowerCase();
  return normalizedBvid === normalizedInput;
};

// 匹配 av 号（精准搜索）
const matchId = (item: HistoryItem, id: string) => {
  if (!id) return true;
  // 移除可能的前缀
  const numericId = id.replace(/^av/i, "");
  return item.id.toString() === numericId;
};

// 匹配日期区间
const matchDateRange = (item: HistoryItem, startDate: string, endDate: string) => {
  if (!startDate && !endDate) return true;

  const itemDate = dayjs(item.view_at * 1000);
  const start = startDate ? dayjs(startDate).startOf('day') : null;
  const end = endDate ? dayjs(endDate).add(1, 'day').startOf('day') : null;

  if (start && end) {
    return itemDate >= start && itemDate < end;
  } else if (start) {
    return itemDate >= start;
  } else if (end) {
    return itemDate < end;
  }
  return true;
};

// 综合搜索（支持模糊搜索标题和作者，也支持精准搜索BV号和AV号）
const matchAll = (item: HistoryItem, keyword: string) => {
  if (!keyword) return true;

  // 检查是否是BV号精准搜索
  if (keyword.toLowerCase().startsWith('bv') && matchBvid(item, keyword)) {
    return true;
  }

  // 检查是否是av号精准搜索
  if (keyword.toLowerCase().startsWith('av') && matchId(item, keyword)) {
    return true;
  }

  // 模糊搜索标题和作者
  const lowerKeyword = keyword.toLowerCase();
  return (
    item.title.toLowerCase().includes(lowerKeyword) ||
    item.author_name.toLowerCase().includes(lowerKeyword)
  );
};

export const getTotalHistoryCount = async (): Promise<number> => {
  const db = await openDB();
  const tx = db.transaction("history", "readonly");
  const store = tx.objectStore("history");

  return new Promise<number>((resolve, reject) => {
    const request = store.count();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error("获取历史记录总数失败:", request.error);
      reject(request.error);
    };
  });
};

export const getHistory = async (
  lastViewTime: any = "",
  pageSize: number = 20,
  keyword: string = "",
  authorKeyword: string = "",
  date: string = "",
  businessType: string = "",
  searchType: string = "all",
  startDate: string = "",
  endDate: string = ""
): Promise<{ items: HistoryItem[]; hasMore: boolean }> => {
  const db = await openDB();
  const tx = db.transaction("history", "readonly");
  const store = tx.objectStore("history");
  const index = store.index("view_at");

  let range = null;
  if (lastViewTime) {
    range = IDBKeyRange.upperBound(lastViewTime, true);
  }

  // 使用游标按view_at降序获取指定页的数据
  const request = index.openCursor(range, "prev");
  const items: HistoryItem[] = [];
  let hasMore = false;

  return new Promise((resolve, reject) => {
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;

      if (cursor) {
        const value = cursor.value as HistoryItem;

        // 如果还没收集够数据，继续收集
        if (items.length < pageSize) {
          let isMatch = false;

          switch (searchType) {
            case "all":
              // 综合搜索（模糊搜索标题和作者）
              isMatch = matchAll(value, keyword);
              break;
            case "bvid":
              // BV号精准搜索
              isMatch = matchBvid(value, keyword);
              break;
            case "id":
              // av号精准搜索
              isMatch = matchId(value, keyword);
              break;
            case "title":
              // 标题模糊搜索
              isMatch = matchKeyword(value, keyword);
              break;
            case "author":
              // 作者名称模糊搜索
              isMatch = matchAuthorKeyword(value, keyword);
              break;
            default:
              // 默认使用原有的综合搜索逻辑
              isMatch = matchCondition(value, keyword, authorKeyword, date, businessType);
              break;
          }

          // 如果不是综合搜索，还需要考虑分类和日期
          if (searchType !== "all") {
            // 检查分类
            if (!matchBusinessType(value, businessType)) {
              isMatch = false;
            }
            // 检查日期区间（新功能）
            if (!matchDateRange(value, startDate, endDate)) {
              isMatch = false;
            }
          } else if (isMatch) {
            // 综合搜索模式下，如果关键词匹配，再检查分类和日期
            if (!matchBusinessType(value, businessType)) {
              isMatch = false;
            }
            // 检查日期区间（新功能）
            if (!matchDateRange(value, startDate, endDate)) {
              isMatch = false;
            }
            // 兼容旧的日期搜索（单日期）
            if (date && !matchDate(value, date)) {
              isMatch = false;
            }
          }

          if (isMatch) {
            items.push(value);
          }
          cursor.continue();
        } else {
          // 已经收集够数据，检查是否还有更多
          hasMore = true;
          resolve({
            items,
            hasMore,
          });
        }
      } else {
        // 没有更多数据了
        resolve({
          items,
          hasMore,
        });
      }
    };

    request.onerror = () => reject(request.error);
  });
};

export const deleteDB = () => {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_CONFIG.name);
    request.onsuccess = () => {
      console.log("数据库删除成功");
      resolve();
    };
    request.onerror = () => {
      console.error("数据库删除失败:", request.error);
      reject(request.error);
    };
  });
};

export const getItem = async (
  store: IDBObjectStore,
  key: string
): Promise<any> => {
  return new Promise((resolve) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
  });
};

export const clearHistory = async (): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction("history", "readwrite");
  const store = tx.objectStore("history");

  return new Promise<void>((resolve, reject) => {
    const request = store.clear();

    request.onsuccess = () => {
      console.log("历史记录已清空");
      resolve();
    };

    request.onerror = () => {
      console.error("清空历史记录失败:", request.error);
      reject(request.error);
    };
  });
};

export const deleteHistoryItem = async (id: number): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction("history", "readwrite");
  const store = tx.objectStore("history");

  return new Promise<void>((resolve, reject) => {
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log("历史记录删除成功, id =", id);
      resolve();
    };

    request.onerror = () => {
      console.error("删除历史记录失败, id =", id, request.error);
      reject(request.error);
    };
  });
};

export const getAllHistory = async (): Promise<HistoryItem[]> => {
  const db = await openDB();
  const tx = db.transaction("history", "readonly");
  const store = tx.objectStore("history");
  const index = store.index("view_at");

  return new Promise((resolve, reject) => {
    const request = index.openCursor(null, "prev");
    const items: HistoryItem[] = [];

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;

      if (cursor) {
        items.push(cursor.value as HistoryItem);
        cursor.continue();
      } else {
        resolve(items);
      }
    };

    request.onerror = () => reject(request.error);
  });
};

import { FavoriteFolder, FavoriteResource } from "./types";

// 收藏夹相关函数
export const saveFavFolders = async (folders: FavoriteFolder[]): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction("favFolders", "readwrite");
  const store = tx.objectStore("favFolders");

  return new Promise((resolve, reject) => {
    let operationsCompleted = 0;
    let operationsFailed = false;

    if (folders.length === 0) {
      resolve();
      return;
    }

    folders.forEach((folder) => {
      if (operationsFailed) return;
      const request = store.put(folder);
      request.onsuccess = () => operationsCompleted++;
      request.onerror = () => {
        if (!operationsFailed) {
          operationsFailed = true;
          reject(request.error);
        }
      };
    });

    tx.oncomplete = () => {
      if (!operationsFailed) resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
};

export const getFavFolders = async (mid?: number): Promise<FavoriteFolder[]> => {
  const db = await openDB();
  const tx = db.transaction("favFolders", "readonly");
  const store = tx.objectStore("favFolders");

  return new Promise((resolve, reject) => {
    let request;
    if (mid) {
      const index = store.index("mid");
      request = index.getAll(mid);
    } else {
      request = store.getAll();
    }
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveFavResources = async (resources: FavoriteResource[]): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction("favResources", "readwrite");
  const store = tx.objectStore("favResources");

  return new Promise((resolve, reject) => {
    let operationsCompleted = 0;
    let operationsFailed = false;

    if (resources.length === 0) {
      resolve();
      return;
    }

    // 递归处理每一个资源，因为我们需要在put之前可能进行get操作（异步）
    // 虽然可以在事务中并行发起请求，但为了逻辑清晰，我们使用 Promise.all 或者计数器

    // 这里我们直接发起所有请求，利用IndexedDB的事务特性
    resources.forEach((res) => {
      if (operationsFailed) return;

      // 检查是否是失效视频
      if (res.title === "已失效视频") {
        const getReq = store.get(res.id);
        getReq.onsuccess = () => {
          const oldData = getReq.result as FavoriteResource;
          let dataToSave = res;

          // 如果本地有旧数据，且旧数据是有效的（标题不是已失效视频）
          // 那么保留旧数据的关键元数据
          if (oldData && oldData.title !== "已失效视频") {
            dataToSave = {
              ...res,
              title: oldData.title,
              cover: oldData.cover,
              intro: oldData.intro,
              upper: oldData.upper,
              ctime: oldData.ctime, // 保持创建时间
              // 可以根据需要保留更多字段
            };
            console.log(`[失效保护] 保留了视频 ${oldData.id} 的元数据: ${oldData.title}`);
          }

          const putReq = store.put(dataToSave);
          putReq.onsuccess = () => CheckComplete();
          putReq.onerror = HandleError;
        };
        getReq.onerror = HandleError;
      } else {
        // 正常视频直接保存
        const putReq = store.put(res);
        putReq.onsuccess = () => CheckComplete();
        putReq.onerror = HandleError;
      }

      function HandleError(e: Event) {
        if (!operationsFailed) {
          operationsFailed = true;
          reject((e.target as IDBRequest).error);
        }
      }

      function CheckComplete() {
        operationsCompleted++;
        if (operationsCompleted === resources.length && !operationsFailed) {
          // 此时不能resolve，因为外层还有tx.oncomplete
        }
      }
    });

    tx.oncomplete = () => {
      if (!operationsFailed) resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
};

// 收藏夹筛选函数
const favMatchBvid = (item: FavoriteResource, bvid: string) => {
  if (!bvid) return true;
  return item.bvid === bvid || item.bv_id === bvid;
};

const favMatchId = (item: FavoriteResource, id: string) => {
  if (!id) return true;
  const numericId = id.replace(/^av/i, "");
  return item.id.toString() === numericId;
};

const favMatchKeyword = (item: FavoriteResource, keyword: string) => {
  if (!keyword) return true;
  return item.title.toLowerCase().includes(keyword.toLowerCase());
};

const favMatchAuthor = (item: FavoriteResource, keyword: string) => {
  if (!keyword) return true;
  return item.upper.name.toLowerCase().includes(keyword.toLowerCase());
};

const favMatchAll = (item: FavoriteResource, keyword: string) => {
  if (!keyword) return true;

  // 检查是否是BV号精准搜索
  if (keyword.toLowerCase().startsWith('bv') && favMatchBvid(item, keyword)) {
    return true;
  }

  // 检查是否是av号精准搜索
  if (keyword.toLowerCase().startsWith('av') && favMatchId(item, keyword)) {
    return true;
  }

  // 模糊搜索标题和作者
  const lowerKeyword = keyword.toLowerCase();
  return (
    item.title.toLowerCase().includes(lowerKeyword) ||
    item.upper.name.toLowerCase().includes(lowerKeyword)
  );
};

const favMatchDateRange = (item: FavoriteResource, startDate: string, endDate: string) => {
  if (!startDate && !endDate) return true;

  const itemDate = dayjs((item.fav_time || item.ctime) * 1000);
  const start = startDate ? dayjs(startDate).startOf('day') : null;
  const end = endDate ? dayjs(endDate).add(1, 'day').startOf('day') : null;

  if (start && end) {
    return itemDate >= start && itemDate < end;
  } else if (start) {
    return itemDate >= start;
  } else if (end) {
    return itemDate < end;
  }
  return true;
};

export const getFavResources = async (
  folderId?: number,
  keyword: string = "",
  searchType: string = "all",
  startDate: string = "",
  endDate: string = "",
  lastItem?: FavoriteResource,
  limit: number = 100
): Promise<{ items: FavoriteResource[]; hasMore: boolean }> => {
  const db = await openDB();
  const tx = db.transaction("favResources", "readonly");
  const store = tx.objectStore("favResources");

  return new Promise((resolve, reject) => {
    let request;
    if (folderId) {
      const index = store.index("folder_id");
      request = index.getAll(folderId);
    } else {
      request = store.getAll();
    }
    request.onsuccess = () => {
      let items = request.result as FavoriteResource[];

      // 根据搜索类型进行筛选
      items = items.filter((item) => {
        let isMatch = false;

        switch (searchType) {
          case "all":
            isMatch = favMatchAll(item, keyword);
            break;
          case "bvid":
            isMatch = favMatchBvid(item, keyword);
            break;
          case "id":
            isMatch = favMatchId(item, keyword);
            break;
          case "title":
            isMatch = favMatchKeyword(item, keyword);
            break;
          case "author":
            isMatch = favMatchAuthor(item, keyword);
            break;
          default:
            isMatch = true;
            break;
        }

        // 检查日期区间
        if (isMatch && (startDate || endDate)) {
          isMatch = favMatchDateRange(item, startDate, endDate);
        }

        return isMatch;
      });

      // Sort by index
      const sortedItems = items.sort((a, b) => (a.index || 0) - (b.index || 0));

      // 如果有 lastItem，则从该 item 之后开始返回
      let filteredItems = sortedItems;
      if (lastItem) {
        const lastIndex = sortedItems.findIndex(item => item.id === lastItem.id);
        if (lastIndex !== -1) {
          filteredItems = sortedItems.slice(lastIndex + 1);
        }
      }

      // 分页返回
      const hasMore = filteredItems.length > limit;
      const paginatedItems = filteredItems.slice(0, limit);

      resolve({ items: paginatedItems, hasMore });
    };
    request.onerror = () => reject(request.error);
  });
};


export const getFavResourcesCount = async (folderId?: number): Promise<number> => {
  const db = await openDB();
  const tx = db.transaction("favResources", "readonly");
  const store = tx.objectStore("favResources");
  const index = store.index("folder_id");

  return new Promise((resolve, reject) => {
    const request = index.count(folderId);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error("获取收藏夹总数失败:", request.error);
      reject(request.error);
    };
  });
};

export const deleteFavResources = async (ids: number[]): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction("favResources", "readwrite");
  const store = tx.objectStore("favResources");

  return new Promise((resolve, reject) => {
    let operationsCompleted = 0;
    let operationsFailed = false;

    if (ids.length === 0) {
      resolve();
      return;
    }

    ids.forEach((id) => {
      if (operationsFailed) return;
      const request = store.delete(id);
      request.onsuccess = () => operationsCompleted++;
      request.onerror = () => {
        if (!operationsFailed) {
          operationsFailed = true;
          reject(request.error);
        }
      };
    });

    tx.oncomplete = () => {
      if (!operationsFailed) resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
};
