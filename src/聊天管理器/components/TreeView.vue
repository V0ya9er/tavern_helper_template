<template>
  <div class="tree-view">
    <div v-if="nodes.length === 0" class="empty-state">
      <i class="fa fa-inbox"></i>
      <p>暂无聊天记录</p>
    </div>

    <TransitionGroup name="list" tag="div" class="tree-list">
      <ChatCard
        v-for="node in visible_nodes"
        :key="node.chat.file_name"
        :node="node"
        @toggle-expand="toggle_expand(node)"
        @toggle-select="toggle_select(node)"
        @open="$emit('open-chat', node.chat.file_name)"
        @rename="$emit('rename-chat', node.chat.file_name)"
        @delete="$emit('delete-chat', node.chat.file_name)"
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

// 可见节点（展开的节点及其可见子节点）
const visible_nodes = computed(() => {
  const result: ChatTreeNode[] = [];

  function traverse(nodes: ChatTreeNode[]) {
    for (const node of nodes) {
      result.push(node);
      if (node.is_expanded && node.children.length > 0) {
        traverse(node.children);
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
