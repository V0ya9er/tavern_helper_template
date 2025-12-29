import { detectBranchRelations } from './chat-parser';
import type { ChatForest, ChatInfo, ChatTree, ChatTreeNode, SortConfig } from './types';

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

    // 更新 chat 的 parent_chat 字段（使用 file_id）
    for (const chat of sorted_chats) {
      if (!chat.parent_chat && relations.has(chat.file_id)) {
        chat.parent_chat = relations.get(chat.file_id);
      }
    }
  }

  // 构建节点映射（使用 file_id 作为键）
  const node_map = new Map<string, ChatTreeNode>();
  for (const chat of sorted_chats) {
    node_map.set(chat.file_id, {
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
    const node = node_map.get(chat.file_id)!;

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
      ).map(c => node_map.get(c.file_id)!);
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

/**
 * 构建聊天森林 - 将多个独立的对话树分组显示
 * 每棵树按最新更新时间排序，树内节点也按时间排序（最新在前）
 */
export async function buildChatForest(
  chats: ChatInfo[],
  options?: {
    detect_branches?: boolean;
    sort_config?: SortConfig;
  },
): Promise<ChatForest> {
  const { detect_branches = true, sort_config } = options || {};

  // 先按时间排序（最新在前）
  const effective_sort: SortConfig = sort_config || { by: 'updated_at', order: 'desc' };
  const sorted_chats = sortChats(chats, effective_sort);

  // 检测分支关系
  let relations = new Map<string, string>();
  if (detect_branches) {
    relations = await detectBranchRelations(sorted_chats);

    // 更新 chat 的 parent_chat 字段
    for (const chat of sorted_chats) {
      if (!chat.parent_chat && relations.has(chat.file_id)) {
        chat.parent_chat = relations.get(chat.file_id);
      }
    }
  }

  // 构建节点映射
  const node_map = new Map<string, ChatTreeNode>();
  for (const chat of sorted_chats) {
    node_map.set(chat.file_id, {
      chat,
      children: [],
      depth: 0,
      is_expanded: true, // 默认展开
      is_selected: false,
    });
  }

  // 构建树结构
  const roots: ChatTreeNode[] = [];

  for (const chat of sorted_chats) {
    const node = node_map.get(chat.file_id)!;

    if (chat.parent_chat && node_map.has(chat.parent_chat)) {
      const parent_node = node_map.get(chat.parent_chat)!;
      node.depth = parent_node.depth + 1;
      parent_node.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // 对每个节点的子节点进行排序（最新在前）
  function sortChildrenDesc(node: ChatTreeNode) {
    if (node.children.length > 0) {
      node.children.sort((a, b) => b.chat.updated_at.getTime() - a.chat.updated_at.getTime());
      node.children.forEach(sortChildrenDesc);
    }
  }
  roots.forEach(sortChildrenDesc);

  // 将根节点转换为树结构
  const trees: ChatTree[] = roots.map(root => {
    const tree_nodes = flattenTreeAll(root);
    const latest = tree_nodes.reduce(
      (max, n) => (n.chat.updated_at > max ? n.chat.updated_at : max),
      root.chat.updated_at,
    );
    const has_current = tree_nodes.some(n => n.chat.is_current);

    return {
      id: root.chat.file_id,
      root,
      display_name: root.chat.display_name,
      node_count: tree_nodes.length,
      latest_update: latest,
      has_current,
      is_expanded: has_current || tree_nodes.length <= 5, // 包含当前聊天或节点少时默认展开
    };
  });

  // 按最新更新时间排序树（最新在前），包含当前聊天的树优先
  trees.sort((a, b) => {
    if (a.has_current && !b.has_current) return -1;
    if (!a.has_current && b.has_current) return 1;
    return b.latest_update.getTime() - a.latest_update.getTime();
  });

  return {
    trees,
    total_count: chats.length,
  };
}

/**
 * 扁平化一棵树的所有节点（包括未展开的）
 */
function flattenTreeAll(node: ChatTreeNode): ChatTreeNode[] {
  const result: ChatTreeNode[] = [node];
  for (const child of node.children) {
    result.push(...flattenTreeAll(child));
  }
  return result;
}

/**
 * 统计森林中所有选中的节点
 */
export function getSelectedNodesFromForest(forest: ChatForest): ChatTreeNode[] {
  const selected: ChatTreeNode[] = [];
  for (const tree of forest.trees) {
    selected.push(...getSelectedNodes([tree.root]));
  }
  return selected;
}

/**
 * 设置森林中所有节点的选中状态
 */
export function setAllSelectedInForest(forest: ChatForest, selected: boolean): void {
  for (const tree of forest.trees) {
    setAllSelected([tree.root], selected);
  }
}

/**
 * 展开/折叠森林中所有树
 */
export function setAllTreesExpanded(forest: ChatForest, expanded: boolean): void {
  for (const tree of forest.trees) {
    tree.is_expanded = expanded;
    setAllExpanded([tree.root], expanded);
  }
}

/**
 * 统计森林中的总节点数
 */
export function countNodesInForest(forest: ChatForest): number {
  return forest.total_count;
}
