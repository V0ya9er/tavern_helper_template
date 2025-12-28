import { fetchChatList } from './data/chat-parser';
import {
  buildChatTree,
  countNodes,
  filterChats,
  getSelectedNodes,
  setAllExpanded,
  setAllSelected,
} from './data/chat-tree';
import type { ChatInfo, ChatManagerSettings, ChatTreeNode, SortConfig } from './data/types';

const SETTINGS_KEY = 'chat_manager_settings';

export const useChatManagerStore = defineStore('chat-manager', () => {
  // 设置
  const settings = ref<ChatManagerSettings>(
    (() => {
      try {
        const saved = getVariables({ type: 'global' })?.[SETTINGS_KEY];
        return saved
          ? { ...{ default_sort: { by: 'updated_at', order: 'desc' }, preview_length: 50, show_checkpoints: true, confirm_delete: true }, ...saved }
          : { default_sort: { by: 'updated_at', order: 'desc' }, preview_length: 50, show_checkpoints: true, confirm_delete: true };
      } catch {
        return { default_sort: { by: 'updated_at', order: 'desc' }, preview_length: 50, show_checkpoints: true, confirm_delete: true };
      }
    })(),
  );

  // 状态
  const is_loading = ref(false);
  const error_message = ref<string | null>(null);
  const chats = ref<ChatInfo[]>([]);
  const tree_nodes = ref<ChatTreeNode[]>([]);
  const search_keyword = ref('');
  const sort_config = ref<SortConfig>(settings.value.default_sort);

  // 计算属性
  const filtered_chats = computed(() =>
    filterChats(chats.value, {
      search: search_keyword.value,
      show_checkpoints: settings.value.show_checkpoints,
    }),
  );

  const selected_nodes = computed(() => getSelectedNodes(tree_nodes.value));
  const selected_count = computed(() => selected_nodes.value.length);
  const total_count = computed(() => countNodes(tree_nodes.value));
  const current_chat = computed(() => chats.value.find(c => c.is_current));

  // 方法
  async function loadChats() {
    is_loading.value = true;
    error_message.value = null;

    try {
      chats.value = await fetchChatList(settings.value.preview_length);
      await rebuildTree();
      console.info(`[聊天管理器] 已加载 ${chats.value.length} 个聊天记录`);
    } catch (e) {
      error_message.value = e instanceof Error ? e.message : '加载聊天记录失败';
      console.error('[聊天管理器]', error_message.value, e);
    } finally {
      is_loading.value = false;
    }
  }

  async function rebuildTree() {
    tree_nodes.value = await buildChatTree(filtered_chats.value, {
      detect_branches: true,
      sort_config: sort_config.value,
    });
  }

  function selectAll(selected: boolean) {
    setAllSelected(tree_nodes.value, selected);
  }

  function expandAll(expanded: boolean) {
    setAllExpanded(tree_nodes.value, expanded);
  }

  async function openChat(file_name: string) {
    try {
      await SillyTavern.openCharacterChat(file_name);
      toastr.success('已切换聊天');

      // 更新当前聊天标记
      for (const chat of chats.value) {
        chat.is_current = chat.file_name === file_name;
      }
    } catch (e) {
      toastr.error('切换聊天失败');
      console.error('[聊天管理器] 切换聊天失败:', e);
    }
  }

  async function deleteChats(file_names: string[]) {
    if (file_names.length === 0) return;

    const current = current_chat.value;

    for (const file_name of file_names) {
      try {
        // 如果要删除的是当前聊天，需要先切换到其他聊天
        if (current?.file_name === file_name) {
          const other = chats.value.find(c => c.file_name !== file_name);
          if (other) {
            await SillyTavern.openCharacterChat(other.file_name);
          }
        }

        // 切换到目标聊天再删除
        await SillyTavern.openCharacterChat(file_name);
        await triggerSlash('/delchat');

        console.info(`[聊天管理器] 已删除聊天: ${file_name}`);
      } catch (e) {
        console.error(`[聊天管理器] 删除聊天失败: ${file_name}`, e);
        throw e;
      }
    }

    // 刷新列表
    await loadChats();
  }

  async function deleteSelected() {
    const to_delete = selected_nodes.value.map(n => n.chat.file_name);

    if (to_delete.length === 0) {
      toastr.warning('请先选择要删除的聊天记录');
      return;
    }

    if (settings.value.confirm_delete) {
      const result = await SillyTavern.callGenericPopup(
        `确定要删除选中的 ${to_delete.length} 个聊天记录吗？\n\n此操作不可撤销！`,
        SillyTavern.POPUP_TYPE.CONFIRM,
      );

      if (result !== SillyTavern.POPUP_RESULT.AFFIRMATIVE) {
        return;
      }
    }

    try {
      is_loading.value = true;
      await deleteChats(to_delete);
      toastr.success(`已删除 ${to_delete.length} 个聊天记录`);
    } catch (e) {
      toastr.error('删除聊天记录时出错');
    } finally {
      is_loading.value = false;
    }
  }

  async function renameChat(file_name: string, new_name: string) {
    try {
      await SillyTavern.renameChat(file_name, new_name);
      toastr.success('重命名成功');
      await loadChats();
    } catch (e) {
      toastr.error('重命名失败');
      console.error('[聊天管理器] 重命名失败:', e);
    }
  }

  function saveSettings() {
    try {
      updateVariablesWith(
        vars => {
          vars[SETTINGS_KEY] = klona(settings.value);
          return vars;
        },
        { type: 'global' },
      );
    } catch (e) {
      console.error('[聊天管理器] 保存设置失败:', e);
    }
  }

  // 监听排序变化
  watch(sort_config, rebuildTree, { deep: true });
  watch(() => settings.value.show_checkpoints, rebuildTree);
  watch(search_keyword, rebuildTree);

  return {
    // 状态
    settings,
    is_loading,
    error_message,
    chats,
    tree_nodes,
    search_keyword,
    sort_config,

    // 计算属性
    filtered_chats,
    selected_nodes,
    selected_count,
    total_count,
    current_chat,

    // 方法
    loadChats,
    rebuildTree,
    selectAll,
    expandAll,
    openChat,
    deleteChats,
    deleteSelected,
    renameChat,
    saveSettings,
  };
});
