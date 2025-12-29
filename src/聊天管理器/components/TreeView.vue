<template>
  <div class="tree-view">
    <div v-if="nodes.length === 0" class="empty-state">
      <i class="fa fa-inbox"></i>
      <p>暂无聊天记录</p>
    </div>

    <TransitionGroup name="list" tag="div" class="tree-list">
      <div v-for="item in visible_nodes_with_info" :key="item.node.chat.file_id" class="tree-row">
        <!-- 分支线单元格 - 宽度由子元素自动计算 -->
        <div class="branch-cell">
          <!-- 祖先层级的垂直延续线 -->
          <div
            v-for="i in Math.max(0, item.node.depth - 1)"
            :key="'line-' + i"
            class="indent-unit"
            :class="{ 'has-line': item.ancestorContinuations[i] }"
          ></div>
          <!-- 当前节点的L形连接线 -->
          <div v-if="item.node.depth > 0" class="branch-unit" :class="{ 'is-last': item.isLastChild }"></div>
        </div>
        <!-- 卡片内容 -->
        <ChatCard
          :node="item.node"
          @toggle-expand="toggle_expand(item.node)"
          @toggle-select="toggle_select(item.node)"
          @open="$emit('open-chat', item.node.chat.file_id)"
          @rename="$emit('rename-chat', item.node.chat.file_id)"
          @delete="$emit('delete-chat', item.node.chat.file_id)"
        />
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import type { ChatTreeNode } from '../data/types';
import ChatCard from './ChatCard.vue';

const props = defineProps<{
  nodes: ChatTreeNode[];
}>();

defineEmits<{
  'open-chat': [file_name: string];
  'rename-chat': [file_name: string];
  'delete-chat': [file_name: string];
}>();

// 带有连接线信息的可见节点
interface VisibleNodeInfo {
  node: ChatTreeNode;
  isLastChild: boolean;
  ancestorContinuations: boolean[];
}

// 可见节点（展开的节点及其可见子节点，附带连接线信息）
const visible_nodes_with_info = computed(() => {
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
        // 传递给子节点的延续信息：当前层级不是最后一个，则需要延续线
        traverse(node.children, [...continuations, !isLast]);
      }
    }
  }

  traverse(props.nodes);
  return result;
});

function toggle_expand(node: ChatTreeNode) {
  node.is_expanded = !node.is_expanded;
}

function toggle_select(node: ChatTreeNode) {
  node.is_selected = !node.is_selected;
}
</script>

<style lang="scss" scoped>
.tree-view {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.tree-list {
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
  flex-wrap: nowrap;
  align-self: stretch;
}

// 缩进单元和分支单元的公共样式
.indent-unit,
.branch-unit {
  flex: 0 0 20px; // 固定宽度 20px
  position: relative;
  width: 20px;
  min-height: 60px; // 确保最小高度
}

// 祖先延续线 - 纯缩进或带垂直线
.indent-unit {
  // 有后续兄弟节点时显示垂直线
  &.has-line::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 2px;
    transform: translateX(-50%);
    background: rgba(0, 200, 200, 0.5);
  }
}

// L形连接线
.branch-unit {
  // 垂直部分 - 从顶部到中间
  &::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 0;
    width: 2px;
    height: 50%;
    transform: translateX(-50%);
    background: rgba(0, 200, 200, 0.5);
  }

  // 水平部分 - 从中间延伸到卡片
  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    right: -20px; // 延伸进入卡片的 margin 区域
    height: 2px;
    transform: translateY(-50%);
    background: rgba(0, 200, 200, 0.5);
  }

  // 非最后一个子节点：垂直线贯穿整个高度
  &:not(.is-last)::before {
    height: 100%;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--SmartThemeBodyColor, #888);
  opacity: 0.6;

  i {
    font-size: 48px;
    margin-bottom: 12px;
  }

  p {
    margin: 0;
    font-size: 14px;
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
