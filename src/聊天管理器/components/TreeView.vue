<template>
  <div class="tree-view">
    <div v-if="nodes.length === 0" class="empty-state">
      <i class="fa fa-inbox"></i>
      <p>暂无聊天记录</p>
    </div>

    <TransitionGroup name="list" tag="div" class="tree-list">
      <div v-for="item in visible_nodes_with_info" :key="item.node.chat.file_id" class="tree-row">
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
