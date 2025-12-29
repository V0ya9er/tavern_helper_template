import type { ChatInfo } from './types';

/**
 * 清理文件名中重复的 .jsonl 后缀
 * 返回基础名称（不带后缀）和完整文件名（只有一个 .jsonl 后缀）
 */
function cleanFileName(name: string): { base: string; full: string } {
  let base = name;
  // 移除所有 .jsonl 后缀
  while (base.endsWith('.jsonl')) {
    base = base.slice(0, -6);
  }
  return {
    base,
    full: `${base}.jsonl`,
  };
}

/**
 * 解析聊天文件名中的时间戳
 * 酒馆聊天文件名格式通常为: 角色名 - 时间戳.jsonl
 */
function parseFileTimestamp(file_name: string): Date | null {
  // 尝试匹配常见的时间戳格式
  const patterns = [
    /(\d{4}-\d{2}-\d{2})@(\d{2})h(\d{2})m(\d{2})s/, // 2024-12-28@10h30m45s
    /(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/, // 20241228-103045
    /(\d{13})/, // Unix timestamp in ms
  ];

  for (const pattern of patterns) {
    const match = file_name.match(pattern);
    if (match) {
      if (pattern === patterns[0]) {
        const [, date, h, m, s] = match;
        return new Date(`${date}T${h}:${m}:${s}`);
      } else if (pattern === patterns[1]) {
        const [, y, mo, d, h, mi, s] = match;
        return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`);
      } else if (pattern === patterns[2]) {
        return new Date(parseInt(match[1]));
      }
    }
  }
  return null;
}

/**
 * 提取显示名称（去除时间戳和扩展名）
 */
function extractDisplayName(file_name: string, char_name: string): string {
  let name = file_name
    .replace(/\.jsonl?$/, '')
    .replace(/\d{4}-\d{2}-\d{2}@\d{2}h\d{2}m\d{2}s\s*\d*ms/, '')
    .replace(/\d{13}/, '')
    .replace(new RegExp(`^${_.escapeRegExp(char_name)}\\s*-?\\s*`), '')
    .trim();

  if (!name) {
    name = file_name.replace(/\.jsonl?$/, '');
  }

  return name || '未命名聊天';
}

/**
 * 截取消息预览
 */
function truncatePreview(message: string, max_length: number): string {
  if (!message) return '';

  // 移除 markdown 和 HTML 标签
  const clean = message
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/```[\s\S]*?```/g, '[代码块]')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();

  if (clean.length <= max_length) return clean;
  return clean.slice(0, max_length) + '...';
}

/**
 * 检测是否为分支/检查点聊天
 */
function detectBranchInfo(file_name: string): { is_checkpoint: boolean; parent_hint?: string } {
  const is_checkpoint = file_name.includes('checkpoint') || file_name.includes('_cp_');
  const branch_match = file_name.match(/_branch_from_(.+?)(?:_|\.)/);

  return {
    is_checkpoint,
    parent_hint: branch_match?.[1],
  };
}

/**
 * 使用 SillyTavern 原生 API 获取带 metadata 的聊天列表
 * 这样可以获取 chat_metadata.main_chat 来确定分支关系
 */
async function fetchChatsWithMetadata(): Promise<any[]> {
  try {
    const response = await fetch('/api/chats/recent', {
      method: 'POST',
      headers: SillyTavern.getRequestHeaders(),
      body: JSON.stringify({ metadata: true, max: 9999 }),
    });

    if (!response.ok) {
      console.warn('[聊天管理器] 获取聊天 metadata 失败:', response.status);
      return [];
    }

    return await response.json();
  } catch (e) {
    console.error('[聊天管理器] 获取聊天 metadata 出错:', e);
    return [];
  }
}

/**
 * 获取当前角色的所有聊天记录
 * 使用 SillyTavern 原生 API 获取带 metadata 的聊天列表
 * 以便获取 chat_metadata.main_chat 确定分支关系
 */
export async function fetchChatList(preview_length = 100): Promise<ChatInfo[]> {
  const char_data = getCharData('current');
  if (!char_data) {
    console.warn('[聊天管理器] 未选择角色卡');
    return [];
  }

  const char_name = char_data.name;
  const char_avatar = char_data.avatar;
  const current_chat = char_data.chat;
  console.info('[聊天管理器] 当前角色:', char_name, '当前聊天:', current_chat);

  // 使用原生 API 获取带 metadata 的聊天列表
  const all_chats = await fetchChatsWithMetadata();

  // 筛选当前角色的聊天
  const char_chats = all_chats.filter((c: any) => c.avatar === char_avatar);

  if (char_chats.length === 0) {
    // 回退到 getChatHistoryBrief
    console.info('[聊天管理器] 原生 API 无数据，回退到 getChatHistoryBrief');
    const chat_briefs = await getChatHistoryBrief('current');
    if (!chat_briefs || chat_briefs.length === 0) {
      console.info('[聊天管理器] 该角色没有聊天记录');
      return [];
    }
    return parseBriefChats(chat_briefs, char_name, current_chat, preview_length);
  }

  console.info('[聊天管理器] 获取到', char_chats.length, '个聊天记录 (带 metadata)');

  const result: ChatInfo[] = [];

  for (const chat of char_chats) {
    // 使用统一的清理函数处理 file_id
    const raw_file_id = chat.file_id as string;
    const { base: file_id, full: file_name } = cleanFileName(raw_file_id);

    console.debug(`[聊天管理器] 清理文件名: "${raw_file_id}" -> file_id="${file_id}", file_name="${file_name}"`);

    const message_count = chat.chat_items || 0;
    const mes_preview = chat.mes || '';

    // 从 chat_metadata 获取父聊天
    const main_chat = chat.chat_metadata?.main_chat as string | undefined;

    const { is_checkpoint } = detectBranchInfo(file_name);

    // 解析时间
    const file_timestamp = parseFileTimestamp(file_name);
    const created_at = file_timestamp || new Date();

    result.push({
      file_id,
      file_name,
      display_name: extractDisplayName(file_name, char_name),
      created_at,
      updated_at: created_at,
      message_count,
      first_message_preview: truncatePreview(mes_preview, preview_length),
      last_message_preview: truncatePreview(mes_preview, preview_length),
      parent_chat: main_chat, // 使用 chat_metadata.main_chat
      is_checkpoint,
      is_current: file_id === current_chat || file_name === current_chat,
    });
  }

  console.info('[聊天管理器] 解析完成，共', result.length, '个聊天记录');
  return result;
}

/**
 * 解析 brief 格式的聊天数据（回退方案）
 */
function parseBriefChats(
  chat_briefs: any[],
  char_name: string,
  current_chat: string,
  preview_length: number,
): ChatInfo[] {
  const result: ChatInfo[] = [];

  for (const brief of chat_briefs) {
    // 使用统一的清理函数处理
    const raw_file_id = brief.file_id as string;
    const { base: file_id, full: file_name } = cleanFileName(raw_file_id);

    const message_count = brief.chat_items || 0;
    const mes_preview = brief.mes || '';

    const { is_checkpoint, parent_hint } = detectBranchInfo(file_name);

    const file_timestamp = parseFileTimestamp(file_name);
    const created_at = file_timestamp || new Date();

    result.push({
      file_id,
      file_name,
      display_name: extractDisplayName(file_name, char_name),
      created_at,
      updated_at: created_at,
      message_count,
      first_message_preview: truncatePreview(mes_preview, preview_length),
      last_message_preview: truncatePreview(mes_preview, preview_length),
      parent_chat: parent_hint,
      is_checkpoint,
      is_current: file_id === current_chat || file_name === current_chat,
    });
  }

  return result;
}

/**
 * 基于 chat_metadata.main_chat 检测分支关系
 *
 * 数据来源：fetchChatList 已经从 API 获取了 parent_chat 字段
 * 此函数仅需将 parent_chat（父聊天 file_name）转换为 file_id
 *
 * @returns Map<子file_id, 父file_id>
 */
export async function detectBranchRelations(chats: ChatInfo[]): Promise<Map<string, string>> {
  const relations = new Map<string, string>();

  // 构建 file_name -> file_id 映射
  const name_to_id = new Map<string, string>();
  for (const chat of chats) {
    // main_chat 存储的是不带扩展名的文件名
    name_to_id.set(chat.file_id, chat.file_id);
    name_to_id.set(chat.file_name, chat.file_id);
    name_to_id.set(chat.file_name.replace(/\.jsonl?$/, ''), chat.file_id);
  }

  // 建立分支关系
  for (const chat of chats) {
    if (chat.parent_chat) {
      const parent_id = name_to_id.get(chat.parent_chat);
      if (parent_id && parent_id !== chat.file_id) {
        relations.set(chat.file_id, parent_id);
        console.info(`[聊天管理器] 分支关系: ${chat.file_id} -> ${parent_id}`);
      }
    }
  }

  console.info(`[聊天管理器] 检测到 ${relations.size} 个分支关系`);
  return relations;
}
