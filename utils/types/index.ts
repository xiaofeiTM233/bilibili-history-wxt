export interface HistoryItem {
  bvid: string;
  title: string;
  cover: string;
  tag_name?: string;
  business: "archive" | "pgc" | "article" | "article-list" | "live" | "cheese";
  view_at: number;
  id: number;
  cid?: string;
  author_name: string;
  author_mid: number;
  uri?: string;
}

export interface SearchParams {
  searchType: "all" | "bvid" | "id" | "title" | "author";
  keyword: string;
  authorKeyword: string;
  startDate: string;
  endDate: string;
  businessType: string;
}

export interface DBConfig {
  name: string;
  version: number;
  stores: {
    history: {
      keyPath: string;
      indexes: string[];
    };
  };
}

export interface SyncResponse {
  code: number;
  message: string;
  data: {
    list: HistoryItem[];
    has_more: boolean;
  };
}

/**
 * 云同步类型
 */
export type CloudSyncType = "webdav" | "onedrive";

/**
 * 云同步配置
 */
export interface CloudSyncConfig {
  type: CloudSyncType;
  enabled: boolean;
  autoSync: boolean; // 自动同步
  syncInterval: number; // 同步间隔（分钟）
  // WebDAV 配置
  serverUrl?: string;
  username?: string;
  password?: string;
  // OneDrive 配置
  token?: string;
  refreshToken?: string;
  refreshTokenExpired?: boolean; // 刷新令牌是否已过期
  tokenExpires?: number;
  // 上传/下载方向
  syncDirection: "upload" | "download" | "bidirectional"; // upload: 上传覆盖云端, download: 下载覆盖本地
}

/**
 * 云同步结果
 */
export interface CloudSyncResult<T = void> {
  success: boolean;
  message: string;
  data?: T;
  refreshTokenExpired?: boolean; // 刷新令牌是否已过期
}

/**
 * 备份数据结构
 */
export interface BackupData {
  version: number;
  timestamp: number;
  count: number;
  history: HistoryItem[];
}

