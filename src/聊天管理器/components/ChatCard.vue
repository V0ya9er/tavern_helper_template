<template>
  <div
    class="chat-card"
    :class="{
      'is-current': node.chat.is_current,
      'is-selected': node.is_selected,
      'is-checkpoint': node.chat.is_checkpoint,
      'has-children': node.children.length > 0,
    }"
  >
    <!-- 树形连接线区域 -->
    <div class="tree-lines">
      <!-- 祖先层级的垂直延续线 -->
      <span
        v-for="index in Math.max(0, node.depth - 1)"
        :key="'line-' + index"
        class="tree-line"
        :class="{ 'has-continuation': shouldShowContinuation(index - 1) }"
      ></span>
      <!-- 当前节点的L形连接线 -->
      <span v-if="node.depth > 0" class="tree-branch" :class="{ 'is-last': isLastChild }"></span>
    </div>

    <!-- 展开/折叠按钮 -->
    <button v-if="node.children.length > 0" class="expand-btn" @click.stop="$emit('toggle-expand')">
      <i :class="node.is_expanded ? 'fa fa-chevron-down' : 'fa fa-chevron-right'"></i>
    </button>
    <span v-else class="expand-placeholder"></span>

    <!-- 选择框 -->
    <input type="checkbox" :checked="node.is_selected" @change="$emit('toggle-select')" @click.stop />

    <!-- 图标 -->
    <i :class="icon_class" class="chat-icon"></i>

    <!-- 聊天信息 -->
    <div class="chat-info" @click="$emit('open')">
      <div class="chat-header">
        <span class="chat-name" :title="node.chat.file_name">
          {{ node.chat.display_name }}
        </span>
        <span v-if="node.chat.is_current" class="current-badge">当前</span>
        <span v-if="node.chat.is_checkpoint" class="checkpoint-badge">检查点</span>
      </div>

      <div class="chat-meta">
        <span class="message-count">
          <i class="fa fa-comment-o"></i>
          {{ node.chat.message_count }} 条
        </span>
        <span class="update-time">
          <i class="fa fa-clock-o"></i>
          {{ format_time(node.chat.updated_at) }}
        </span>
      </div>

      <div class="chat-preview" :title="node.chat.last_message_preview">
        {{ node.chat.last_message_preview || '(空)' }}
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="chat-actions">
      <button class="action-btn" title="打开" @click.stop="$emit('open')">
        <i class="fa fa-sign-out fa-flip-horizontal"></i>
      </button>
      <button class="action-btn" title="重命名" @click.stop="$emit('rename')">
        <i class="fa fa-pencil"></i>
      </button>
      <button class="action-btn danger" title="删除" :disabled="node.chat.is_current" @click.stop="$emit('delete')">
        <i class="fa fa-trash-o"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatTreeNode } from '../data/types';

const props = defineProps<{
  node: ChatTreeNode;
  isLastChild?: boolean;
  ancestorContinuations?: boolean[];
}>();

// 判断某一层级是否需要显示垂直延续线
function shouldShowContinuation(level: number): boolean {
  if (!props.ancestorContinuations) return false;
  return props.ancestorContinuations[level] ?? false;
}

defineEmits<{
  'toggle-expand': [];
  'toggle-select': [];
  open: [];
  rename: [];
  delete: [];
}>();

const icon_class = computed(() => {
  if (props.node.chat.is_checkpoint) return 'fa fa-bookmark';
  if (props.node.children.length > 0) return 'fa fa-folder-o';
  return 'fa fa-file-text-o';
});

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
.chat-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  padding-left: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  position: relative;

  &:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  &.is-selected {
    background-color: rgba(59, 130, 246, 0.15);
  }

  &.is-current {
    border-left: 3px solid #22c55e;
    background-color: rgba(34, 197, 94, 0.1);
  }

  &.is-checkpoint {
    opacity: 0.8;
  }
}

.expand-btn {
  width: 20px;
  height: 20px;
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

.expand-placeholder {
  width: 20px;
}

// 树形连接线容器 - 使用 flex 布局
.tree-lines {
  display: flex;
  flex-shrink: 0;
  align-self: stretch;
}

// 每个层级的垂直延续线容器
.tree-line {
  position: relative;
  width: 20px;

  // 垂直延续线（祖先层级还有后续兄弟节点时显示）
  &.has-continuation::after {
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

// 当前节点的 L 形连接线
.tree-branch {
  position: relative;
  width: 20px;

  // 垂直部分（从顶部到中心）
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

  // 水平部分（从中心向右）
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
    height: 100%;
  }
}

input[type='checkbox'] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.chat-icon {
  color: var(--SmartThemeBodyColor, #aaa);
  font-size: 14px;
}

.chat-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.chat-name {
  font-weight: 500;
  color: var(--SmartThemeBodyColor, #fff);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.current-badge,
.checkpoint-badge {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 500;
}

.current-badge {
  background-color: #22c55e;
  color: #fff;
}

.checkpoint-badge {
  background-color: #f59e0b;
  color: #fff;
}

.chat-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--SmartThemeBodyColor, #888);
  opacity: 0.7;

  i {
    margin-right: 3px;
  }
}

.chat-preview {
  font-size: 12px;
  color: var(--SmartThemeBodyColor, #999);
  opacity: 0.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;

  .chat-card:hover & {
    opacity: 1;
  }
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: var(--SmartThemeBodyColor, #ccc);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  &.danger:hover {
    background: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}
</style>
