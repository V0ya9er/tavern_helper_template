import { fetchChatList } from './data/chat-parser';
import {
  buildChatForest,
  countNodesInForest,
  filterChats,
  getSelectedNodesFromForest,
  setAllSelectedInForest,
  setAllTreesExpanded,
} from './data/chat-tree';
import { DEFAULT_SETTINGS } from './data/types';
import type { ChatCache, ChatForest, ChatInfo, ChatManagerSettings, SortConfig } from './data/types';

const SETTINGS_KEY = 'chat_manager_settings';

// 全局缓存（跨组件实例保持）
let global_cache: ChatCache | null = null;

export const useChatManagerStore = defineStore('chat-manager', () => {
  // 设置
  const settings = ref<ChatManagerSettings>(
    (() => {
      try {
        const saved = getVariables({ type: 'global' })?.[SETTINGS_KEY];
        return saved ? { ...DEFAULT_SETTINGS, ...saved } : { ...DEFAULT_SETTINGS };
      } catch {
        return { ...DEFAULT_SETTINGS };
      }
    })(),
  );

  // 状态
  const is_loading = ref(false);
  const is_background_loading = ref(false);
  const error_message = ref<string | null>(null);
  const chats = ref<ChatInfo[]>([]);
  const forest = ref<ChatForest>({ trees: [], total_count: 0 });
  const search_keyword = ref('');
  const sort_config = ref<SortConfig>(settings.value.default_sort);
  const cache_time = ref<Date | null>(null);

  // 计算属性
  const filtered_chats = computed(() =>
    filterChats(chats.value, {
      search: search_keyword.value,
      show_checkpoints: settings.value.show_checkpoints,
    }),
  );

  const selected_nodes = computed(() => getSelectedNodesFromForest(forest.value));
  const selected_count = computed(() => selected_nodes.value.length);
  const total_count = computed(() => countNodesInForest(forest.value));
  const current_chat = computed(() => chats.value.find(c => c.is_current));

  // 缓存相关
  function isCacheValid(): boolean {
    if (!global_cache) return false;
    const char_data = getCharData('current');
    if (!char_data) return false;

    const now = Date.now();
    const is_same_char = global_cache.character === char_data.name;
    const is_not_expired = now - global_cache.timestamp < 5 * 60 * 1000; // 5分钟

    return is_same_char && is_not_expired;
  }

  function updateCache(new_chats: ChatInfo[]) {
    const char_data = getCharData('current');
    if (!char_data) return;

    global_cache = {
      chats: new_chats,
      timestamp: Date.now(),
      character: char_data.name,
    };
    cache_time.value = new Date();
  }

  // 方法
  async function loadChats(force_refresh = false) {
    error_message.value = null;

    // 如果有有效缓存且不强制刷新，先显示缓存数据
    if (!force_refresh && isCacheValid() && global_cache) {
      console.info('[聊天管理器] 使用缓存数据');
      chats.value = global_cache.chats;
      cache_time.value = new Date(global_cache.timestamp);
      await rebuildForest();

      // 后台静默刷新
      refreshInBackground();
      return;
    }

    // 无缓存或强制刷新，显示加载状态
    is_loading.value = true;

    try {
      const new_chats = await fetchChatList(settings.value.preview_length);
      chats.value = new_chats;
      updateCache(new_chats);
      await rebuildForest();
      console.info(`[聊天管理器] 已加载 ${chats.value.length} 个聊天记录`);
    } catch (e) {
      error_message.value = e instanceof Error ? e.message : '加载聊天记录失败';
      console.error('[聊天管理器]', error_message.value, e);
    } finally {
      is_loading.value = false;
    }
  }

  async function refreshInBackground() {
    if (is_background_loading.value) return;

    is_background_loading.value = true;
    try {
      const new_chats = await fetchChatList(settings.value.preview_length);

      // 检查数据是否有变化
      if (JSON.stringify(new_chats.map(c => c.file_id)) !== JSON.stringify(chats.value.map(c => c.file_id))) {
        console.info('[聊天管理器] 后台刷新检测到变化，更新视图');
        chats.value = new_chats;
        updateCache(new_chats);
        await rebuildForest();
      } else {
        // 更新缓存时间
        updateCache(new_chats);
      }
    } catch (e) {
      console.warn('[聊天管理器] 后台刷新失败:', e);
    } finally {
      is_background_loading.value = false;
    }
  }

  async function rebuildForest() {
    forest.value = await buildChatForest(filtered_chats.value, {
      detect_branches: true,
      sort_config: sort_config.value,
    });
  }

  function selectAll(selected: boolean) {
    setAllSelectedInForest(forest.value, selected);
  }

  function expandAll(expanded: boolean) {
    setAllTreesExpanded(forest.value, expanded);
  }

  function invalidateCache() {
    global_cache = null;
    cache_time.value = null;
  }

  async function openChat(file_id: string) {
    try {
      // 使用 file_id（不带扩展名）调用 API
      await SillyTavern.openCharacterChat(file_id);
      toastr.success('已切换聊天');

      // 更新当前聊天标记
      for (const chat of chats.value) {
        chat.is_current = chat.file_id === file_id;
      }
    } catch (e) {
      toastr.error('切换聊天失败');
      console.error('[聊天管理器] 切换聊天失败:', e);
    }
  }

  /**
   * 使用原生 API 直接删除聊天，无需切换
   */
  async function deleteChatDirect(avatar_url: string, chat_file: string): Promise<boolean> {
    console.log('[聊天管理器] deleteChatDirect 输入:', { avatar_url, chat_file });

    // 确保文件名格式正确：移除所有 .jsonl 后缀（可能有多个），再添加一次
    let base_name = chat_file;
    let removed_count = 0;
    while (base_name.endsWith('.jsonl')) {
      base_name = base_name.slice(0, -6); // 移除 '.jsonl' (6个字符)
      removed_count++;
    }
    const chatfile = `${base_name}.jsonl`;

    console.log(`[聊天管理器] 文件名处理: 移除了 ${removed_count} 个 .jsonl, 最终: ${chatfile}`);

    // 计算预期的服务器端路径（用于调试）
    const expected_path = `chats/${avatar_url.replace('.png', '')}/${chatfile}`;
    console.log(`[聊天管理器] 预期服务器路径: ${expected_path}`);

    try {
      // 构建请求头
      const headers = SillyTavern.getRequestHeaders();

      // 构建请求体
      const body = { avatar_url, chatfile };

      console.info(`[聊天管理器] 请求详情:`, {
        url: '/api/chats/delete',
        method: 'POST',
        headers: JSON.stringify(headers),
        body: JSON.stringify(body),
      });

      const response = await fetch('/api/chats/delete', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const text = await response.text();
      console.info(
        `[聊天管理器] API 响应: status=${response.status}, statusText=${response.statusText}, body="${text}"`,
      );

      if (response.ok) {
        console.info(`[聊天管理器] ✅ 删除成功: ${chatfile}`);
        return true;
      }

      // 记录失败原因
      console.error(`[聊天管理器] ❌ 删除失败: HTTP ${response.status} - ${text}`);
      return false;
    } catch (e) {
      console.error('[聊天管理器] ❌ 删除请求异常:', e);
      return false;
    }
  }

  async function deleteChats(file_ids: string[]) {
    console.log('[聊天管理器] ========== 开始删除操作 ==========');
    console.log('[聊天管理器] 要删除的 file_ids:', file_ids);

    if (file_ids.length === 0) return;

    const char_data = getCharData('current');
    console.log('[聊天管理器] char_data:', JSON.stringify(char_data, null, 2));

    if (!char_data) {
      console.error('[聊天管理器] 无法获取角色信息');
      return;
    }

    const avatar_url = char_data.avatar;
    console.log('[聊天管理器] avatar_url:', avatar_url);

    // 验证请求头
    const test_headers = SillyTavern.getRequestHeaders();
    console.log('[聊天管理器] 验证请求头:', {
      'Content-Type': test_headers['Content-Type'],
      'X-CSRF-TOKEN': test_headers['X-CSRF-TOKEN'] ? '(已设置)' : '(未设置)',
    });

    // 构建 file_id -> file_name 映射
    const id_to_name = new Map<string, string>();
    for (const chat of chats.value) {
      id_to_name.set(chat.file_id, chat.file_name);
    }

    // 检查对应的 ChatInfo 对象
    for (const file_id of file_ids) {
      const chat_info = chats.value.find(c => c.file_id === file_id);
      console.log(`[聊天管理器] file_id "${file_id}" 对应的 ChatInfo:`, chat_info);
    }
    const original_file_id = current_chat.value?.file_id;
    const will_delete_original = original_file_id && file_ids.includes(original_file_id);

    // 本地即时更新：先从界面上移除，提高响应速度
    const deleted_ids = new Set(file_ids);
    const chats_backup = [...chats.value]; // 保存备份以便获取 file_name
    chats.value = chats.value.filter(c => !deleted_ids.has(c.file_id));
    await rebuildForest();

    let success_count = 0;
    let fail_count = 0;
    const failed_ids: string[] = [];

    // 使用原生 API 直接删除，使用 file_name 而非 file_id
    for (const file_id of file_ids) {
      // 优先使用 file_name（带正确扩展名），否则使用 file_id
      const chat_info = chats_backup.find(c => c.file_id === file_id);
      const chat_file = chat_info?.file_name || file_id;
      console.log(`[聊天管理器] 使用文件名: ${chat_file} (来自 file_name: ${!!chat_info?.file_name})`);

      const success = await deleteChatDirect(avatar_url, chat_file);
      if (success) {
        success_count++;
      } else {
        fail_count++;
        failed_ids.push(file_id);
      }

      // 每次请求间隔 100ms，防止服务器压力过大
      if (file_ids.length > 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // 等待 500ms 让文件系统同步
    await new Promise(r => setTimeout(r, 500));

    // 失效缓存并刷新列表
    invalidateCache();
    await loadChats(true);

    // 如果删除了当前聊天，切换到其他聊天
    if (will_delete_original && chats.value.length > 0) {
      const first_chat = chats.value[0];
      await SillyTavern.openCharacterChat(first_chat.file_id);
      first_chat.is_current = true;
    }

    if (fail_count > 0) {
      console.warn(`[聊天管理器] 删除完成: 成功 ${success_count}, 失败 ${fail_count}`, failed_ids);
      toastr.warning(`部分删除失败: 成功 ${success_count}, 失败 ${fail_count}`);
    }

    return { success_count, fail_count };
  }

  async function deleteSelected() {
    const to_delete = selected_nodes.value.map(n => n.chat.file_id);

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

  async function renameChat(file_id: string, new_name: string) {
    try {
      // renameChat 可能也需要使用 file_id
      await SillyTavern.renameChat(file_id, new_name);
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
  watch(sort_config, rebuildForest, { deep: true });
  watch(() => settings.value.show_checkpoints, rebuildForest);
  watch(search_keyword, rebuildForest);

  return {
    // 状态
    settings,
    is_loading,
    is_background_loading,
    error_message,
    chats,
    forest,
    search_keyword,
    sort_config,
    cache_time,

    // 计算属性
    filtered_chats,
    selected_nodes,
    selected_count,
    total_count,
    current_chat,

    // 方法
    loadChats,
    rebuildForest,
    selectAll,
    expandAll,
    openChat,
    deleteChats,
    deleteSelected,
    renameChat,
    saveSettings,
    invalidateCache,
  };
});
