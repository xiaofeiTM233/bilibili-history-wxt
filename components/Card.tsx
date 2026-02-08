import { HistoryItem as HistoryItemType } from "../utils/types";
import { FavoriteResource } from "../utils/types";
import { Trash2 } from "lucide-react";
import { message } from "antd";
import { IS_SYNC_DELETE } from "../utils/constants";
import { getStorageValue } from "../utils/storage";
import { deleteHistoryItem, deleteFavResources } from "../utils/db";
import { getTypeTag } from "../utils/common";

interface CardProps {
  item: HistoryItemType | FavoriteResource;
  itemType: "history" | "favorite";
  onDelete?: () => void;
}

const deleteBilibiliHistory = async (
  business: string,
  id: number
): Promise<void> => {
  const cookies = await new Promise<Browser.cookies.Cookie[]>(
    (resolve, reject) => {
      browser.runtime.sendMessage({ action: "getCookies" }, (response) => {
        if (browser.runtime.lastError) {
          reject(browser.runtime.lastError);
          return;
        }
        if (response.success) {
          resolve(response.cookies);
        } else {
          reject(new Error(response.error));
        }
      });
    }
  );

  const bili_jct = cookies.find((cookie) => cookie.name === "bili_jct")?.value;
  const SESSDATA = cookies.find((cookie) => cookie.name === "SESSDATA")?.value;

  if (!bili_jct || !SESSDATA) {
    throw new Error("未找到必要的Cookie,请先登录B站");
  }

  const kid = `${business}_${id}`;
  const response = await fetch("https://api.bilibili.com/x/v2/history/delete", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `kid=${kid}&csrf=${bili_jct}`,
  });

  if (!response.ok) {
    console.error("删除历史记录失败:", response.statusText);
    return;
  }

  const data = await response.json();
  if (data.code !== 0) {
    console.error("删除历史记录失败:", data.message);
  }
};

export const Card: React.FC<CardProps> = ({ item, itemType, onDelete }) => {
  const isHistory = itemType === "history";
  const historyItem = isHistory ? item as HistoryItemType : null;
  const favoriteItem = !isHistory ? item as FavoriteResource : null;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (isHistory && historyItem) {
        const isSyncDelete = await getStorageValue(IS_SYNC_DELETE, true);
        if (isSyncDelete) {
          await deleteBilibiliHistory(historyItem.business, historyItem.id);
          console.log("删除B站服务器上的历史记录成功");
        }
        await deleteHistoryItem(historyItem.id);
      } else if (favoriteItem) {
        await deleteFavResources([favoriteItem.id]);
      }
      onDelete?.();
    } catch (error) {
      console.error("删除失败:", error);
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const title = isHistory ? historyItem!.title : favoriteItem!.title;
  const cover = isHistory ? historyItem!.cover : favoriteItem!.cover.replace("http:", "https:");
  const authorName = isHistory ? historyItem!.author_name : favoriteItem!.upper?.name;
  const authorMid = isHistory ? historyItem!.author_mid : favoriteItem!.upper?.mid;
  const bvid = isHistory ? historyItem!.bvid : favoriteItem!.bvid;
  const viewTime = isHistory ? historyItem!.view_at : (favoriteItem!.fav_time || favoriteItem!.ctime);
  const business = isHistory ? historyItem!.business : null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <a
        href={`https://www.bilibili.com/video/${bvid}`}
        target="_blank"
        rel="noopener noreferrer"
        className="no-underline text-inherit"
      >
        <div>
          <div className="relative w-full aspect-video">
            <img
              src={`${cover}@760w_428h_1c.avif`}
              alt={title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {isHistory && business && getTypeTag(business) !== "视频" && (
              <span className="absolute bottom-2 right-2 px-2 py-1 rounded text-xs text-white bg-[#fb7299]">
                {getTypeTag(business)}
              </span>
            )}
          </div>
          <div className="p-2.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="m-0 text-sm leading-[1.4] h-10 overflow-hidden line-clamp-2 flex-1">
                {title}
              </h3>
              {isHistory && (
                <button
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors shrink-0"
                  onClick={handleDelete}
                >
                  <Trash2 className="w-4 h-4 text-gray-500" />
                </button>
              )}
            </div>
            <div className="flex justify-between items-center text-gray-500 text-xs mt-1">
              <a
                href={`https://space.bilibili.com/${authorMid}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="hover:text-[#fb7299] transition-colors no-underline text-inherit"
              >
                {authorName}
              </a>
              <span className="shrink-0">
                {new Date(viewTime * 1000).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </a>
    </div>
  );
};
