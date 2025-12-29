<template>
  <div class="forest-view">
    <div v-if="forest.trees.length === 0" class="empty-state">
      <i class="fa fa-inbox"></i>
      <p>暂无聊天记录</p>
    </div>

    <div v-else class="forest-list">
      <div v-for="tree in forest.trees" :key="tree.id" class="tree-group">
        <!-- 树标题栏 -->
        <div class="tree-header" :class="{ 'has-current': tree.has_current }" @click="toggle_tree(tree)">
          <button class="expand-btn">
            <i :class="tree.is_expanded ? 'fa fa-chevron-down' : 'fa fa-chevron-right'"></i>
          </button>

          <i :class="tree.node_count > 1 ? 'fa fa-code-fork' : 'fa fa-file-text-o'" class="tree-icon"></i>

          <div class="tree-info">
            <span class="tree-name">{{ tree.display_name }}</span>
            <span v-if="tree.has_current" class="current-badge">当前</span>
          </div>

          <div class="tree-meta">
            <span class="node-count">
              <i class="fa fa-comments-o"></i>
              {{ tree.node_count }} 个聊天
            </span>
            <span class="update-time">
              <i class="fa fa-clock-o"></i>
              {{ format_time(tree.latest_update) }}
            </span>
          </div>

          <button class="select-all-btn" title="选择整棵树" @click.stop="select_tree(tree, !is_tree_selected(tree))">
            <i :class="is_tree_selected(tree) ? 'fa fa-check-square-o' : 'fa fa-square-o'"></i>
          </button>
        </div>

        <!-- 树节点列表 -->
        <TransitionGroup v-if="tree.is_expanded" name="list" tag="div" class="tree-nodes">
          <div v-for="item in get_visible_nodes(tree)" :key="item.node.chat.file_id" class="tree-row">
            <!-- 分支线单元格 -->
            <div class="branch-cell">
              <!-- 祖先层级的垂直延续线 -->
              <span
                v-for="i in Math.max(0, item.node.depth - 1)"
                :key="'line-' + i"
                class="continuation-line"
                :class="{ active: item.ancestorContinuations[i - 1] }"
              ></span>
              <!-- 当前节点的L形连接线 -->
              <span v-if="item.node.depth > 0" class="branch-line" :class="{ 'is-last': item.isLastChild }"></span>
            </div>
            <!-- 卡片内容 -->
            <ChatCard
              :node="item.node"
              @toggle-expand="toggle_node_expand(item.node)"
              @toggle-select="toggle_node_select(item.node)"
              @open="$emit('open-chat', item.node.chat.file_id)"
              @rename="$emit('rename-chat', item.node.chat.file_id)"
              @delete="$emit('delete-chat', item.node.chat.file_id)"
            />
          </div>
        </TransitionGroup>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatForest, ChatTree, ChatTreeNode } from '../data/types';
import ChatCard from './ChatCard.vue';

const props = defineProps<{
  forest: ChatForest;
}>();

defineEmits<{
  'open-chat': [file_id: string];
  'rename-chat': [file_id: string];
  'delete-chat': [file_id: string];
}>();

interface VisibleNodeInfo {
  node: ChatTreeNode;
  isLastChild: boolean;
  ancestorContinuations: boolean[];
}

function get_visible_nodes(tree: ChatTree): VisibleNodeInfo[] {
  const result: VisibleNodeInfo[] = [];

  function traverse(nodes: ChatTreeNode[], continuations: boolean[] = []) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const isLast = i === nodes.length - 1;

      result.push({
        node,
        isLastChild: isLast,
        ancestorContinuations: [...continuations],
      });

      if (node.is_expanded && node.children.length > 0) {
        traverse(node.children, [...continuations, !isLast]);
      }
    }
  }

  traverse([tree.root]);
  return result;
}

function toggle_tree(tree: ChatTree) {
  tree.is_expanded = !tree.is_expanded;
}

function toggle_node_expand(node: ChatTreeNode) {
  node.is_expanded = !node.is_expanded;
}

function toggle_node_select(node: ChatTreeNode) {
  node.is_selected = !node.is_selected;
}

function is_tree_selected(tree: ChatTree): boolean {
  function check(node: ChatTreeNode): boolean {
    if (!node.is_selected) return false;
    return node.children.every(check);
  }
  return check(tree.root);
}

function select_tree(tree: ChatTree, selected: boolean) {
  function set(node: ChatTreeNode) {
    node.is_selected = selected;
    node.children.forEach(set);
  }
  set(tree.root);
}

function format_time(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
</script>

<style lang="scss" scoped>
.forest-view {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.forest-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tree-group {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  overflow: hidden;
}

.tree-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: rgba(0, 0, 0, 0.25);
  }

  &.has-current {
    border-left: 3px solid #22c55e;
    background: rgba(34, 197, 94, 0.08);
  }
}

.expand-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--SmartThemeBodyColor, #ccc);
  cursor: pointer;
  opacity: 0.7;

  &:hover {
    opacity: 1;
  }
}

.tree-icon {
  font-size: 16px;
  color: var(--SmartThemeBodyColor, #aaa);
  opacity: 0.8;
}

.tree-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.tree-name {
  font-weight: 500;
  color: var(--SmartThemeBodyColor, #fff);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.current-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #22c55e;
  color: #fff;
  font-weight: 500;
}

.tree-meta {
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: var(--SmartThemeBodyColor, #888);
  opacity: 0.7;

  i {
    margin-right: 4px;
  }
}

.select-all-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--SmartThemeBodyColor, #aaa);
  cursor: pointer;
  opacity: 0.6;
  transition: all 0.15s;

  &:hover {
    opacity: 1;
    color: #3b82f6;
  }
}

.tree-nodes {
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 0; // 移除间隙，让分支线连续
}

// 每行：分支线 + 卡片
.tree-row {
  display: flex;
  align-items: stretch;
}

// 分支线单元格 - 独立于卡片，不受卡片背景影响
.branch-cell {
  display: flex;
  flex-shrink: 0;
  align-self: stretch;
}

// 延续线和分支线的公共样式
.continuation-line,
.branch-line {
  display: block; // 确保能正确获取高度
  position: relative;
  flex: 0 0 20px; // 固定宽度，不压缩不拉伸
  width: 20px;
  min-height: 100%;
}

// 祖先延续线容器
.continuation-line {
  // 有后续兄弟节点时显示垂直线
  &.active::after {
    content: '';
    position: absolute;
    left: 50%;
    top: -1px; // 延伸超出边界消除间隙
    bottom: -1px;
    width: 2px;
    transform: translateX(-50%);
    background: rgba(0, 200, 200, 0.5);
  }
}

// L形连接线
.branch-line {
  // 垂直部分
  &::before {
    content: '';
    position: absolute;
    left: 50%;
    top: -1px; // 延伸超出边界消除间隙
    width: 2px;
    height: calc(50% + 1px);
    transform: translateX(-50%);
    background: rgba(0, 200, 200, 0.5);
  }

  // 水平部分
  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    right: 0;
    height: 2px;
    transform: translateY(-50%);
    background: rgba(0, 200, 200, 0.5);
  }

  // 非最后一个子节点：垂直线贯穿整个高度
  &:not(.is-last)::before {
    height: calc(100% + 2px); // 延伸超出边界
    bottom: -1px;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--SmartThemeBodyColor, #888);
  opacity: 0.6;

  i {
    font-size: 56px;
    margin-bottom: 16px;
  }

  p {
    margin: 0;
    font-size: 15px;
  }
}

// 列表动画
.list-enter-active,
.list-leave-active {
  transition: all 0.2s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

.list-move {
  transition: transform 0.2s ease;
}
</style>
