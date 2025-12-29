<template>
  <div class="chat-manager-panel">
    <!-- 标题栏 -->
    <div class="panel-header">
      <h2>
        <i class="fa fa-comments-o"></i>
        聊天管理器
      </h2>
      <button class="close-btn" @click="$emit('close')">
        <i class="fa fa-times"></i>
      </button>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="search-box">
        <i class="fa fa-search"></i>
        <input v-model="store.search_keyword" type="text" placeholder="搜索聊天..." />
        <button v-if="store.search_keyword" class="clear-btn" @click="store.search_keyword = ''">
          <i class="fa fa-times-circle"></i>
        </button>
      </div>

      <div class="toolbar-actions">
        <select v-model="sort_by" class="sort-select">
          <option value="updated_at">按更新时间</option>
          <option value="created_at">按创建时间</option>
          <option value="name">按名称</option>
          <option value="message_count">按消息数</option>
        </select>

        <button class="icon-btn" :title="sort_order === 'desc' ? '降序' : '升序'" @click="toggle_sort_order">
          <i :class="sort_order === 'desc' ? 'fa fa-sort-amount-desc' : 'fa fa-sort-amount-asc'"></i>
        </button>

        <button class="icon-btn" title="刷新" @click="store.loadChats()">
          <i class="fa fa-refresh" :class="{ 'fa-spin': store.is_loading }"></i>
        </button>
      </div>
    </div>

    <!-- 批量操作栏 -->
    <div class="batch-bar">
      <label class="select-all">
        <input
          type="checkbox"
          :checked="is_all_selected"
          :indeterminate="is_partial_selected"
          @change="toggle_select_all"
        />
        <span>全选</span>
      </label>

      <div class="batch-actions">
        <button class="batch-btn" :disabled="store.selected_count === 0" @click="store.expandAll(true)">
          <i class="fa fa-expand"></i>
          展开全部
        </button>

        <button class="batch-btn" :disabled="store.selected_count === 0" @click="store.expandAll(false)">
          <i class="fa fa-compress"></i>
          折叠全部
        </button>

        <button class="batch-btn danger" :disabled="store.selected_count === 0" @click="store.deleteSelected()">
          <i class="fa fa-trash-o"></i>
          删除选中 ({{ store.selected_count }})
        </button>
      </div>
    </div>

    <!-- 聊天列表 -->
    <ForestView
      :forest="store.forest"
      @open-chat="handle_open_chat"
      @rename-chat="handle_rename_chat"
      @delete-chat="handle_delete_chat"
    />

    <!-- 状态栏 -->
    <div class="status-bar">
      <span v-if="store.error_message" class="error">
        <i class="fa fa-exclamation-triangle"></i>
        {{ store.error_message }}
      </span>
      <template v-else>
        <span>已选中 {{ store.selected_count }} 个 | 共 {{ store.total_count }} 个聊天</span>
        <span v-if="store.cache_time" class="cache-info">
          <i class="fa fa-database"></i>
          缓存: {{ format_cache_time(store.cache_time) }}
          <button v-if="store.is_background_loading" class="refreshing-indicator" disabled>
            <i class="fa fa-refresh fa-spin"></i>
          </button>
        </span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useChatManagerStore } from '../store';
import ForestView from './ForestView.vue';

defineEmits<{
  close: [];
}>();

const store = useChatManagerStore();

// 排序
const sort_by = computed({
  get: () => store.sort_config.by,
  set: value => {
    store.sort_config.by = value;
  },
});

const sort_order = computed({
  get: () => store.sort_config.order,
  set: value => {
    store.sort_config.order = value;
  },
});

function toggle_sort_order() {
  sort_order.value = sort_order.value === 'desc' ? 'asc' : 'desc';
}

// 选择状态
const is_all_selected = computed(() => store.total_count > 0 && store.selected_count === store.total_count);

const is_partial_selected = computed(() => store.selected_count > 0 && store.selected_count < store.total_count);

function toggle_select_all() {
  store.selectAll(!is_all_selected.value);
}

// 操作处理
async function handle_open_chat(file_id: string) {
  await store.openChat(file_id);
}

async function handle_rename_chat(file_id: string) {
  const chat = store.chats.find(c => c.file_id === file_id);
  if (!chat) return;

  const new_name = await SillyTavern.callGenericPopup(
    '请输入新的聊天名称:',
    SillyTavern.POPUP_TYPE.INPUT,
    chat.display_name,
  );

  if (new_name && typeof new_name === 'string' && new_name.trim()) {
    await store.renameChat(file_id, new_name.trim());
  }
}

async function handle_delete_chat(file_id: string) {
  const chat = store.chats.find(c => c.file_id === file_id);
  if (!chat) return;

  if (chat.is_current) {
    toastr.warning('无法删除当前正在使用的聊天');
    return;
  }

  if (store.settings.confirm_delete) {
    const result = await SillyTavern.callGenericPopup(
      `确定要删除聊天 "${chat.display_name}" 吗？\n\n此操作不可撤销！`,
      SillyTavern.POPUP_TYPE.CONFIRM,
    );

    if (result !== SillyTavern.POPUP_RESULT.AFFIRMATIVE) {
      return;
    }
  }

  try {
    await store.deleteChats([file_id]);
    toastr.success('已删除聊天');
  } catch {
    toastr.error('删除失败');
  }
}

// 格式化缓存时间
function format_cache_time(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 5) return '刚刚';
  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  return '已过期';
}

// 初始化
onMounted(() => {
  store.loadChats();
});
</script>

<style lang="scss" scoped>
.chat-manager-panel {
  display: flex;
  flex-direction: column;
  width: 95vw;
  max-width: 1200px;
  height: 90vh;
  background: var(--SmartThemeBlurTintColor, #1a1a2e);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  color: var(--SmartThemeBodyColor, #e0e0e0);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;

    i {
      opacity: 0.8;
    }
  }
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--SmartThemeBodyColor, #ccc);
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);

  i {
    opacity: 0.5;
  }

  input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: inherit;
    font-size: 14px;

    &::placeholder {
      color: var(--SmartThemeBodyColor, #888);
      opacity: 0.5;
    }
  }
}

.clear-btn {
  background: transparent;
  border: none;
  color: var(--SmartThemeBodyColor, #888);
  cursor: pointer;
  opacity: 0.6;

  &:hover {
    opacity: 1;
  }
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-select {
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: inherit;
  font-size: 13px;
  cursor: pointer;

  option {
    background: var(--SmartThemeBlurTintColor, #1a1a2e);
  }
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: var(--SmartThemeBodyColor, #ccc);
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.select-all {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;

  input {
    cursor: pointer;
  }
}

.batch-actions {
  display: flex;
  gap: 8px;
}

.batch-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: var(--SmartThemeBodyColor, #ccc);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  font-size: 12px;
  color: var(--SmartThemeBodyColor, #888);
  opacity: 0.7;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.1);

  .error {
    color: #ef4444;
    opacity: 1;

    i {
      margin-right: 4px;
    }
  }

  .cache-info {
    display: flex;
    align-items: center;
    gap: 6px;

    i {
      margin-right: 3px;
    }
  }

  .refreshing-indicator {
    background: transparent;
    border: none;
    color: inherit;
    padding: 0;
    margin-left: 4px;
  }
}
</style>
