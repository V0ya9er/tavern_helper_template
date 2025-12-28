import type { ChatInfo } from './types';

/**
 * 解析聊天文件名中的时间戳
 * 酒馆聊天文件名格式通常为: 角色名 - 时间戳.jsonl
 */
function parseFileTimestamp(file_name: string): Date | null {
  // 尝试匹配常见的时间戳格式
  const patterns = [
    /(\d{4}-\d{2}-\d{2})@(\d{2})h(\d{2})m(\d{2})s/,  // 2024-12-28@10h30m45s
    /(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/,   // 20241228-103045
    /(\d{13})/,                                       // Unix timestamp in ms
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
    .replace(/\d{4}-\d{2}-\d{2}@\d{2}h\d{2}m\d{2}s/, '')
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
 * 获取当前角色的所有聊天记录
 */
export async function fetchChatList(preview_length = 50): Promise<ChatInfo[]> {
  const char_data = getCharData('current');
  if (!char_data) {
    console.warn('[聊天管理器] 未选择角色卡');
    return [];
  }

  const char_name = char_data.name;
  const current_chat = char_data.chat;

  // 获取聊天历史摘要
  const chat_briefs = await getChatHistoryBrief('current');
  if (!chat_briefs || chat_briefs.length === 0) {
    console.info('[聊天管理器] 该角色没有聊天记录');
    return [];
  }

  // 获取聊天详情
  const chat_details = await getChatHistoryDetail(chat_briefs, false);
  if (!chat_details) {
    console.warn('[聊天管理器] 无法获取聊天详情');
    return [];
  }

  const result: ChatInfo[] = [];

  for (const brief of chat_briefs) {
    const file_name = brief.file_name as string;
    const messages = chat_details[file_name] as SillyTavern.ChatMessage[] | undefined;

    if (!messages || messages.length === 0) continue;

    const first_msg = messages[0];
    const last_msg = messages[messages.length - 1];
    const { is_checkpoint, parent_hint } = detectBranchInfo(file_name);

    // 解析时间
    const file_timestamp = parseFileTimestamp(file_name);
    const created_at = file_timestamp || new Date(brief.file_size ? Date.now() : 0);

    // 尝试从消息中获取更新时间
    let updated_at = created_at;
    if (last_msg.extra?.gen_started) {
      updated_at = new Date(last_msg.extra.gen_started);
    } else if (last_msg.extra?.gen_finished) {
      updated_at = new Date(last_msg.extra.gen_finished);
    }

    result.push({
      file_name,
      display_name: extractDisplayName(file_name, char_name),
      created_at,
      updated_at,
      message_count: messages.length,
      first_message_preview: truncatePreview(first_msg.mes || '', preview_length),
      last_message_preview: truncatePreview(last_msg.mes || '', preview_length),
      parent_chat: parent_hint,
      is_checkpoint,
      is_current: file_name === current_chat,
    });
  }

  return result;
}

/**
 * 通过比较消息内容检测分支关系
 */
export async function detectBranchRelations(chats: ChatInfo[]): Promise<Map<string, string>> {
  const relations = new Map<string, string>();

  // 获取所有聊天的详细内容用于比对
  const chat_briefs = await getChatHistoryBrief('current');
  if (!chat_briefs) return relations;

  const chat_details = await getChatHistoryDetail(chat_briefs, false);
  if (!chat_details) return relations;

  // 创建消息哈希映射
  const message_hashes = new Map<string, string[]>();

  for (const chat of chats) {
    const messages = chat_details[chat.file_name] as SillyTavern.ChatMessage[] | undefined;
    if (!messages) continue;

    // 取前 5 条消息的内容作为特征
    const feature_messages = messages.slice(0, 5).map(m => m.mes || '');
    message_hashes.set(chat.file_name, feature_messages);
  }

  // 比较每对聊天的相似性
  const chat_files = Array.from(message_hashes.keys());
  for (let i = 0; i < chat_files.length; i++) {
    for (let j = i + 1; j < chat_files.length; j++) {
      const file_a = chat_files[i];
      const file_b = chat_files[j];
      const msgs_a = message_hashes.get(file_a)!;
      const msgs_b = message_hashes.get(file_b)!;

      // 找到共同前缀长度
      let common_prefix = 0;
      const min_len = Math.min(msgs_a.length, msgs_b.length);
      for (let k = 0; k < min_len; k++) {
        if (msgs_a[k] === msgs_b[k]) {
          common_prefix++;
        } else {
          break;
        }
      }

      // 如果有共同前缀，说明存在分支关系
      if (common_prefix >= 2) {
        const chat_a = chats.find(c => c.file_name === file_a)!;
        const chat_b = chats.find(c => c.file_name === file_b)!;

        // 消息更多的是父聊天（或创建时间更早的）
        if (chat_a.message_count > chat_b.message_count ||
            (chat_a.message_count === chat_b.message_count && chat_a.created_at < chat_b.created_at)) {
          relations.set(file_b, file_a);
        } else {
          relations.set(file_a, file_b);
        }
      }
    }
  }

  return relations;
}
