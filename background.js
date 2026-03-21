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
      theme: 'light',
      translationEngine: 'google',
      enableHistory: true
    });

    // 创建右键菜单
    createContextMenus();

    // 打开欢迎页面或设置页面
    chrome.tabs.create({
      url: 'options.html'
    });
  } else if (details.reason === 'update') {
    // 更新时重新创建菜单
    createContextMenus();
  }
});

/**
 * 创建右键菜单
 */
function createContextMenus() {
  // 清除现有菜单
  chrome.contextMenus.removeAll(function() {
    // 主菜单
    chrome.contextMenus.create({
      id: 'selection-translator',
      title: '划词翻译',
      contexts: ['selection']
    });

    // 翻译选中文本
    chrome.contextMenus.create({
      id: 'translate-selection',
      parentId: 'selection-translator',
      title: '翻译选中文本',
      contexts: ['selection']
    });

    // 分隔线
    chrome.contextMenus.create({
      id: 'separator-1',
      parentId: 'selection-translator',
      type: 'separator',
      contexts: ['selection']
    });

    // 复制翻译结果
    chrome.contextMenus.create({
      id: 'copy-translation',
      parentId: 'selection-translator',
      title: '复制翻译结果',
      contexts: ['selection']
    });

    // 朗读选中文本
    chrome.contextMenus.create({
      id: 'speak-selection',
      parentId: 'selection-translator',
      title: '朗读选中文本',
      contexts: ['selection']
    });

    // 分隔线
    chrome.contextMenus.create({
      id: 'separator-2',
      parentId: 'selection-translator',
      type: 'separator',
      contexts: ['selection']
    });

    // 打开设置
    chrome.contextMenus.create({
      id: 'open-settings',
      parentId: 'selection-translator',
      title: '打开设置',
      contexts: ['selection']
    });
  });
}

// 监听右键菜单点击
chrome.contextMenus.onClicked.addListener(function(info, tab) {
  switch (info.menuItemId) {
    case 'translate-selection':
      chrome.tabs.sendMessage(tab.id, { 
        action: 'context-translate',
        text: info.selectionText 
      });
      break;
    
    case 'copy-translation':
      chrome.tabs.sendMessage(tab.id, { 
        action: 'copy-translation',
        text: info.selectionText 
      });
      break;
    
    case 'speak-selection':
      chrome.tabs.sendMessage(tab.id, { 
        action: 'speak-selection',
        text: info.selectionText 
      });
      break;
    
    case 'open-settings':
      chrome.runtime.openOptionsPage();
      break;
  }
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  switch (request.action) {
    case 'translate':
      // 后台翻译逻辑
      sendResponse({ success: true });
      break;
    
    case 'save-to-history':
      // 保存到翻译历史
      saveToHistory(request.data);
      sendResponse({ success: true });
      break;
    
    case 'get-history':
      // 获取翻译历史
      getHistory(function(history) {
        sendResponse({ history: history });
      });
      return true; // 异步响应
    
    case 'clear-history':
      // 清空历史
      clearHistory();
      sendResponse({ success: true });
      break;
  }
  return true;
});

/**
 * 保存到翻译历史
 */
function saveToHistory(data) {
  chrome.storage.local.get(['translationHistory'], function(result) {
    let history = result.translationHistory || [];
    
    // 添加新记录到开头
    history.unshift({
      id: Date.now(),
      sourceText: data.sourceText,
      translatedText: data.translatedText,
      sourceLang: data.sourceLang,
      targetLang: data.targetLang,
      timestamp: new Date().toISOString()
    });
    
    // 只保留最近100条
    if (history.length > 100) {
      history = history.slice(0, 100);
    }
    
    chrome.storage.local.set({ translationHistory: history });
  });
}

/**
 * 获取翻译历史
 */
function getHistory(callback) {
  chrome.storage.local.get(['translationHistory'], function(result) {
    callback(result.translationHistory || []);
  });
}

/**
 * 清空历史
 */
function clearHistory() {
  chrome.storage.local.remove(['translationHistory']);
}

// 添加快捷键命令监听
chrome.commands.onCommand.addListener(function(command) {
  if (command === 'translate-selection') {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'translate-selection' });
      }
    });
  }
});

console.log('[Selection Translator] 后台服务已启动');
