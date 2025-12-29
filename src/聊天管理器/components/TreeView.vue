<template>
  <div class="tree-view">
    <div v-if="nodes.length === 0" class="empty-state">
      <i class="fa fa-inbox"></i>
      <p>暂无聊天记录</p>
    </div>

    <TransitionGroup name="list" tag="div" class="tree-list">
      <ChatCard
        v-for="item in visible_nodes_with_info"
        :key="item.node.chat.file_id"
        :node="item.node"
        :is-last-child="item.isLastChild"
        :ancestor-continuations="item.ancestorContinuations"
        @toggle-expand="toggle_expand(item.node)"
        @toggle-select="toggle_select(item.node)"
        @open="$emit('open-chat', item.node.chat.file_id)"
        @rename="$emit('rename-chat', item.node.chat.file_id)"
        @delete="$emit('delete-chat', item.node.chat.file_id)"
      />
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
  gap: 2px;
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
