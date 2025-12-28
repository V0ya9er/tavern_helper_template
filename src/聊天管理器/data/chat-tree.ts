import { detectBranchRelations } from './chat-parser';
import type { ChatInfo, ChatTreeNode, SortConfig } from './types';

/**
 * 根据排序配置对聊天列表排序
 */
export function sortChats(chats: ChatInfo[], config: SortConfig): ChatInfo[] {
  const sorted = [...chats];
  const multiplier = config.order === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    switch (config.by) {
      case 'updated_at':
        return multiplier * (a.updated_at.getTime() - b.updated_at.getTime());
      case 'created_at':
        return multiplier * (a.created_at.getTime() - b.created_at.getTime());
      case 'name':
        return multiplier * a.display_name.localeCompare(b.display_name);
      case 'message_count':
        return multiplier * (a.message_count - b.message_count);
      default:
        return 0;
    }
  });

  return sorted;
}

/**
 * 过滤聊天列表
 */
export function filterChats(
  chats: ChatInfo[],
  options: {
    search?: string;
    show_checkpoints?: boolean;
  },
): ChatInfo[] {
  let result = [...chats];

  if (options.show_checkpoints === false) {
    result = result.filter(c => !c.is_checkpoint);
  }

  if (options.search?.trim()) {
    const keyword = options.search.toLowerCase().trim();
    result = result.filter(
      c =>
        c.display_name.toLowerCase().includes(keyword) ||
        c.first_message_preview.toLowerCase().includes(keyword) ||
        c.last_message_preview.toLowerCase().includes(keyword),
    );
  }

  return result;
}

/**
 * 将扁平聊天列表构建为树形结构
 */
export async function buildChatTree(
  chats: ChatInfo[],
  options?: {
    detect_branches?: boolean;
    sort_config?: SortConfig;
  },
): Promise<ChatTreeNode[]> {
  const { detect_branches = true, sort_config } = options || {};

  // 先排序
  const sorted_chats = sort_config ? sortChats(chats, sort_config) : chats;

  // 检测分支关系
  let relations = new Map<string, string>();
  if (detect_branches) {
    relations = await detectBranchRelations(sorted_chats);

    // 更新 chat 的 parent_chat 字段
    for (const chat of sorted_chats) {
      if (!chat.parent_chat && relations.has(chat.file_name)) {
        chat.parent_chat = relations.get(chat.file_name);
      }
    }
  }

  // 构建节点映射
  const node_map = new Map<string, ChatTreeNode>();
  for (const chat of sorted_chats) {
    node_map.set(chat.file_name, {
      chat,
      children: [],
      depth: 0,
      is_expanded: false,
      is_selected: false,
    });
  }

  // 构建树结构
  const roots: ChatTreeNode[] = [];

  for (const chat of sorted_chats) {
    const node = node_map.get(chat.file_name)!;

    if (chat.parent_chat && node_map.has(chat.parent_chat)) {
      const parent_node = node_map.get(chat.parent_chat)!;
      node.depth = parent_node.depth + 1;
      parent_node.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // 对每个节点的子节点进行排序
  function sortChildren(node: ChatTreeNode) {
    if (sort_config) {
      node.children = sortChats(
        node.children.map(n => n.chat),
        sort_config,
      ).map(c => node_map.get(c.file_name)!);
    }
    node.children.forEach(sortChildren);
  }
  roots.forEach(sortChildren);

  return roots;
}

/**
 * 获取所有被选中的节点
 */
export function getSelectedNodes(nodes: ChatTreeNode[]): ChatTreeNode[] {
  const selected: ChatTreeNode[] = [];

  function traverse(node: ChatTreeNode) {
    if (node.is_selected) {
      selected.push(node);
    }
    node.children.forEach(traverse);
  }

  nodes.forEach(traverse);
  return selected;
}

/**
 * 设置所有节点的选中状态
 */
export function setAllSelected(nodes: ChatTreeNode[], selected: boolean): void {
  function traverse(node: ChatTreeNode) {
    node.is_selected = selected;
    node.children.forEach(traverse);
  }

  nodes.forEach(traverse);
}

/**
 * 展开/折叠所有节点
 */
export function setAllExpanded(nodes: ChatTreeNode[], expanded: boolean): void {
  function traverse(node: ChatTreeNode) {
    node.is_expanded = expanded;
    node.children.forEach(traverse);
  }

  nodes.forEach(traverse);
}

/**
 * 统计节点总数
 */
export function countNodes(nodes: ChatTreeNode[]): number {
  let count = 0;

  function traverse(node: ChatTreeNode) {
    count++;
    node.children.forEach(traverse);
  }

  nodes.forEach(traverse);
  return count;
}

/**
 * 将树形结构扁平化为列表
 */
export function flattenTree(nodes: ChatTreeNode[]): ChatTreeNode[] {
  const result: ChatTreeNode[] = [];

  function traverse(node: ChatTreeNode) {
    result.push(node);
    if (node.is_expanded) {
      node.children.forEach(traverse);
    }
  }

  nodes.forEach(traverse);
  return result;
}
