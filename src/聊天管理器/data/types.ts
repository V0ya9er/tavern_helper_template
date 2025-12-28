/**
 * 聊天记录基本信息
 */
export interface ChatInfo {
  /** 聊天文件名 */
  file_name: string;
  /** 显示名称（去除时间戳等） */
  display_name: string;
  /** 创建时间 */
  created_at: Date;
  /** 最后更新时间 */
  updated_at: Date;
  /** 消息总数 */
  message_count: number;
  /** 第一条消息预览 */
  first_message_preview: string;
  /** 最后消息预览 */
  last_message_preview: string;
  /** 父聊天文件名（如果是分支） */
  parent_chat?: string;
  /** 分支起点楼层号 */
  branch_point?: number;
  /** 是否为检查点聊天 */
  is_checkpoint: boolean;
  /** 是否为当前聊天 */
  is_current: boolean;
}

/**
 * 聊天树节点
 */
export interface ChatTreeNode {
  /** 聊天信息 */
  chat: ChatInfo;
  /** 子节点 */
  children: ChatTreeNode[];
  /** 树深度 */
  depth: number;
  /** 是否展开 */
  is_expanded: boolean;
  /** 是否被选中 */
  is_selected: boolean;
}

/**
 * 排序方式
 */
export type SortBy = 'updated_at' | 'created_at' | 'name' | 'message_count';

/**
 * 排序方向
 */
export type SortOrder = 'asc' | 'desc';

/**
 * 排序配置
 */
export interface SortConfig {
  by: SortBy;
  order: SortOrder;
}

/**
 * 聊天管理器设置
 */
export interface ChatManagerSettings {
  /** 默认排序方式 */
  default_sort: SortConfig;
  /** 预览文字长度 */
  preview_length: number;
  /** 是否显示检查点 */
  show_checkpoints: boolean;
  /** 删除确认开关 */
  confirm_delete: boolean;
}

/**
 * 聊天管理器设置默认值
 */
export const DEFAULT_SETTINGS: ChatManagerSettings = {
  default_sort: { by: 'updated_at', order: 'desc' },
  preview_length: 50,
  show_checkpoints: true,
  confirm_delete: true,
};
