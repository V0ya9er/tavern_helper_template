import { createScriptIdDiv, destroyScriptIdDiv, deteleportStyle, teleportStyle } from '@/util/script';
import MainPanel from './components/MainPanel.vue';

let is_open = false;
let app_instance: ReturnType<typeof createApp> | null = null;
let $container: JQuery<HTMLDivElement> | null = null;

function openChatManager() {
  if (is_open) {
    closeChatManager();
    return;
  }

  // 检查是否有选中的角色
  const char_data = getCharData('current');
  if (!char_data) {
    toastr.warning('请先选择一个角色卡');
    return;
  }

  // 创建容器
  $container = createScriptIdDiv();
  $container.addClass('chat-manager-container');
  $container.css({
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
  });

  // 点击背景关闭
  $container.on('click', (e) => {
    if (e.target === $container![0]) {
      closeChatManager();
    }
  });

  // 按 ESC 关闭
  $(document).on('keydown.chat-manager', (e) => {
    if (e.key === 'Escape') {
      closeChatManager();
    }
  });

  $('body').append($container);
  teleportStyle();

  // 创建内部挂载点
  const $app = $('<div>').appendTo($container);

  // 创建 Vue 应用
  app_instance = createApp(MainPanel, {
    onClose: closeChatManager,
  });
  app_instance.use(createPinia());
  app_instance.mount($app[0]);

  is_open = true;
  console.info('[聊天管理器] 已打开');
}

function closeChatManager() {
  if (!is_open) return;

  $(document).off('keydown.chat-manager');

  if (app_instance) {
    app_instance.unmount();
    app_instance = null;
  }

  if ($container) {
    $container.remove();
    $container = null;
  }

  deteleportStyle();
  is_open = false;
  console.info('[聊天管理器] 已关闭');
}

// 注册脚本按钮
$(() => {
  replaceScriptButtons([
    { name: '聊天管理器', visible: true },
  ]);

  eventOn(getButtonEvent('聊天管理器'), () => {
    errorCatched(openChatManager)();
  });

  console.info('[聊天管理器] 脚本已加载');
});

// 卸载时清理
$(window).on('pagehide', () => {
  closeChatManager();
  destroyScriptIdDiv();
});
