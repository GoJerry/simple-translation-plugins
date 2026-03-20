/**
 * 划词翻译 - 后台服务脚本
 */

// 安装时初始化
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    // 首次安装，设置默认配置
    chrome.storage.sync.set({
      targetLang: 'zh',
      sourceLang: 'auto',
      triggerMode: 'auto',
      showIcon: true,
      autoPlay: false,
      theme: 'light'
    });

    // 打开欢迎页面或设置页面
    chrome.tabs.create({
      url: 'options.html'
    });
  }
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'translate') {
    // 可以在这里添加后台翻译逻辑
    // 目前翻译直接在内容脚本中完成
    sendResponse({ success: true });
  }
  return true;
});

// 添加快捷键命令监听
chrome.commands.onCommand.addListener(function(command) {
  if (command === 'translate-selection') {
    // 获取当前活动标签页
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        // 向内容脚本发送消息执行翻译
        chrome.tabs.sendMessage(tabs[0].id, { action: 'translate-selection' });
      }
    });
  }
});

console.log('[Selection Translator] 后台服务已启动');
