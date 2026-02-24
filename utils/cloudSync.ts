import { CloudSyncConfig, CloudSyncResult, BackupData } from "./types";
import { getAllHistory, clearHistory, saveHistory } from "./db";

const BACKUP_FILENAME = "bilibili-history-backup.json";

// OneDrive OAuth 配置 (PKCE Flow - 无需后端)
const ONEDRIVE_CLIENT_ID = "df5eb106-9689-458f-9981-fdcfc658bf17";

/**
 * 生成 PKCE code_challenge 和 code_verifier
 */
async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  // 生成随机的 code_verifier
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  // 生成 code_challenge (SHA256 hash of code_verifier)
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const codeChallenge = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return { codeVerifier, codeChallenge };
}

/**
 * OneDrive OAuth 授权 (PKCE Flow - 支持刷新令牌，无需后端)
 */
export const oneDriveAuth = async (): Promise<CloudSyncResult<{ token: string; refreshToken: string; expiresIn: number }>> => {
  try {
    const redirectUri = browser.identity.getRedirectURL();
    const { codeVerifier, codeChallenge } = await generatePKCE();

    // 第一步：获取授权码
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${ONEDRIVE_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent("offline_access Files.ReadWrite.AppFolder")}&code_challenge=${codeChallenge}&code_challenge_method=S256&prompt=consent`;

    const responseUrl = await browser.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });

    if (!responseUrl) {
      return { success: false, message: "授权被取消" };
    }

    // 从 URL 查询参数中提取授权码
    const urlParams = new URLSearchParams(new URL(responseUrl).search);
    const authCode = urlParams.get("code");

    if (!authCode) {
      const error = urlParams.get("error_description") || "授权失败";
      return { success: false, message: error };
    }

    // 第二步：使用授权码和 code_verifier 交换令牌
    const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: ONEDRIVE_CLIENT_ID,
        code: authCode,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      return { success: false, message: errorData.error_description || "令牌交换失败" };
    }

    const tokenData = await tokenResponse.json();

    return {
      success: true,
      message: "授权成功",
      data: {
        token: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in || 3600,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "授权失败",
    };
  }
};

/**
 * 刷新 OneDrive Token (使用 refresh_token 获取新的 access_token)
 */
export const refreshOneDriveToken = async (refreshToken: string): Promise<CloudSyncResult<{ token: string; refreshToken: string; expiresIn: number }>> => {
  try {
    const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: ONEDRIVE_CLIENT_ID,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        scope: "offline_access Files.ReadWrite.AppFolder",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      return { success: false, message: errorData.error_description || "令牌刷新失败，请重新授权" };
    }

    const tokenData = await tokenResponse.json();

    return {
      success: true,
      message: "令牌刷新成功",
      data: {
        token: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken,
        expiresIn: tokenData.expires_in || 3600,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "令牌刷新失败",
    };
  }
};

/**
 * 检查 OneDrive Token 是否有效，如果过期则自动刷新
 */
export const ensureValidOneDriveToken = async (config: CloudSyncConfig): Promise<string | null> => {
  if (!config.token) return null;
  
  // 检查 token 是否过期（留出 5 分钟的缓冲时间）
  const bufferTime = 5 * 60 * 1000; // 5 分钟
  if (config.tokenExpires && config.tokenExpires - bufferTime > Date.now()) {
    return config.token;
  }
  
  // Token 已过期或即将过期，尝试使用 refresh_token 刷新
  if (config.refreshToken) {
    const refreshResult = await refreshOneDriveToken(config.refreshToken);
    if (refreshResult.success && refreshResult.data) {
      // 更新存储中的令牌信息
      const updatedConfig: CloudSyncConfig = {
        ...config,
        token: refreshResult.data.token,
        refreshToken: refreshResult.data.refreshToken,
        tokenExpires: Date.now() + refreshResult.data.expiresIn * 1000,
      };
      await setStorageValue("cloudSyncConfig", updatedConfig);
      return refreshResult.data.token;
    }
  }
  
  // 刷新失败或没有 refresh_token，需要重新授权
  return null;
};

/**
 * 创建备份数据
 */
export const createBackupData = async (): Promise<BackupData> => {
  const history = await getAllHistory();
  return {
    version: 1,
    timestamp: Date.now(),
    count: history.length,
    history,
  };
};

/**
 * 从备份数据恢复
 */
export const restoreFromBackupData = async (data: BackupData): Promise<void> => {
  // 清空现有数据
  await clearHistory();
  // 保存备份数据
  if (data.history && data.history.length > 0) {
    await saveHistory(data.history);
  }
};

/**
 * WebDAV 客户端
 */
class WebDAVClient {
  private config: CloudSyncConfig;

  constructor(config: CloudSyncConfig) {
    this.config = config;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.config.username && this.config.password) {
      const credentials = btoa(`${this.config.username}:${this.config.password}`);
      headers["Authorization"] = `Basic ${credentials}`;
    } else if (this.config.token) {
      headers["Authorization"] = `Bearer ${this.config.token}`;
    }

    return headers;
  }

  private getUrl(path: string): string {
    const baseUrl = this.config.serverUrl?.replace(/\/$/, "");
    return `${baseUrl}${path}`;
  }

  /**
   * 上传文件到WebDAV
   */
  async upload(data: BackupData): Promise<CloudSyncResult> {
    try {
      const response = await fetch(this.getUrl(`/${BACKUP_FILENAME}`), {
        method: "PUT",
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`上传失败: ${response.status} ${response.statusText}`);
      }

      return { success: true, message: "上传成功" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "上传失败",
      };
    }
  }

  /**
   * 从WebDAV下载文件
   */
  async download(): Promise<CloudSyncResult<BackupData>> {
    try {
      const response = await fetch(this.getUrl(`/${BACKUP_FILENAME}`), {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, message: "远程备份不存在" };
        }
        throw new Error(`下载失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, message: "下载成功", data };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "下载失败",
      };
    }
  }

  /**
   * 检查远程文件是否存在
   */
  async checkExists(): Promise<boolean> {
    try {
      const response = await fetch(this.getUrl(`/${BACKUP_FILENAME}`), {
        method: "HEAD",
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * OneDrive 客户端
 */
class OneDriveClient {
  private config: CloudSyncConfig;

  constructor(config: CloudSyncConfig) {
    this.config = config;
  }

  private async ensureToken(): Promise<string | null> {
    return ensureValidOneDriveToken(this.config);
  }

  private async getHeaders(): Promise<HeadersInit> {
    const token = await this.ensureToken();
    return {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * 上传文件到OneDrive
   */
  async upload(data: BackupData): Promise<CloudSyncResult> {
    try {
      const token = await this.ensureToken();
      if (!token) {
        return { success: false, message: "未授权或令牌已过期，请重新授权" };
      }

      // 使用 OneDrive 应用专用文件夹 (approot) 上传到应用的私有目录
      const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${BACKUP_FILENAME}:/content`;
      
      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: await this.getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`上传失败: ${response.status} ${errorData.error?.message || response.statusText}`);
      }

      return { success: true, message: "上传成功" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "上传失败",
      };
    }
  }

  /**
   * 从OneDrive下载文件
   */
  async download(): Promise<CloudSyncResult<BackupData>> {
    try {
      const token = await this.ensureToken();
      if (!token) {
        return { success: false, message: "未授权或令牌已过期，请重新授权" };
      }

      // 从应用专用文件夹 (approot) 下载
      const downloadUrl = `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${BACKUP_FILENAME}:/content`;
      
      const response = await fetch(downloadUrl, {
        method: "GET",
        headers: await this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, message: "远程备份不存在" };
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`下载失败: ${response.status} ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return { success: true, message: "下载成功", data };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "下载失败",
      };
    }
  }

  /**
   * 检查远程文件是否存在
   */
  async checkExists(): Promise<boolean> {
    try {
      const token = await this.ensureToken();
      if (!token) return false;

      // 检查应用专用文件夹 (approot) 下的文件是否存在
      const checkUrl = `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${BACKUP_FILENAME}`;
      
      const response = await fetch(checkUrl, {
        method: "GET",
        headers: await this.getHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * 创建云同步客户端
 */
export const createCloudClient = (config: CloudSyncConfig): WebDAVClient | OneDriveClient | null => {
  switch (config.type) {
    case "webdav":
      return new WebDAVClient(config);
    case "onedrive":
      return new OneDriveClient(config);
    default:
      return null;
  }
};

/**
 * 上传备份到云端
 */
export const uploadToCloud = async (config: CloudSyncConfig): Promise<CloudSyncResult> => {
  const client = createCloudClient(config);
  if (!client) {
    return { success: false, message: "不支持的云同步类型" };
  }

  const backupData = await createBackupData();
  const result = await client.upload(backupData);

  if (result.success) {
    // 更新最后上传时间
    await setStorageValue("lastCloudUpload", Date.now());
  }

  return result;
};

/**
 * 从云端下载备份
 */
export const downloadFromCloud = async (config: CloudSyncConfig): Promise<CloudSyncResult> => {
  const client = createCloudClient(config);
  if (!client) {
    return { success: false, message: "不支持的云同步类型" };
  }

  const result = await client.download();

  if (result.success && result.data) {
    // 恢复数据（覆盖本地）
    await restoreFromBackupData(result.data);
    // 更新最后下载时间
    await setStorageValue("lastCloudDownload", Date.now());
  }

  return { success: result.success, message: result.message };
};

/**
 * 执行云同步（上传本地数据到云端，覆盖云端）
 */
export const syncToCloud = async (config: CloudSyncConfig): Promise<CloudSyncResult> => {
  return uploadToCloud(config);
};

/**
 * 执行云同步（从云端下载数据，覆盖本地）
 */
export const syncFromCloud = async (config: CloudSyncConfig): Promise<CloudSyncResult> => {
  return downloadFromCloud(config);
};

/**
 * 测试云同步连接
 */
export const testCloudConnection = async (config: CloudSyncConfig): Promise<CloudSyncResult> => {
  const client = createCloudClient(config);
  if (!client) {
    return { success: false, message: "不支持的云同步类型" };
  }

  try {
    // 尝试检查文件是否存在（测试连接）
    await client.checkExists();
    return { success: true, message: "连接成功" };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "连接失败",
    };
  }
};
