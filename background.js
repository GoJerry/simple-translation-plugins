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

/**
 * proxyFetch 允许访问的域名白名单。
 * 后台持有 <all_urls> 权限，若不限制目标地址，任何能向后台发消息的
 * 调用方都能借它向任意地址（包括内网地址）转发请求、带出各引擎的
 * API 密钥。这里只放行 content.js / popup.js 实际使用的翻译引擎
 * 官方端点；新增引擎时需同步把其域名加进这里。
 * OCR 的 api.ocr.space 由 handleOcr 在后台直连（地址写死），不走
 * proxyFetch，因此不在此列。
 */
const PROXY_ALLOWED_HOSTS = new Set([
  'translate.googleapis.com',            // Google
  'api.mymemory.translated.net',         // MyMemory
  'libretranslate.de',                   // LibreTranslate
  'translate.argosopensecurity.com',     // LibreTranslate（备用实例）
  'lingva.ml',                           // Lingva
  'translate.plausible.io',              // Lingva（备用实例）
  'lingva.pussthecat.org',               // Lingva（备用实例）
  'lingva.garudalinux.org',              // Lingva（备用实例，popup 用）
  'translate.plausibility.cloud',        // Lingva（备用实例，popup 用）
  'fanyi-api.baidu.com',                 // 百度翻译
  'openapi.youdao.com',                  // 有道翻译
  'api.cognitive.microsofttranslator.com', // 微软翻译
  'api.deepl.com',                       // DeepL Pro
  'api-free.deepl.com',                  // DeepL Free
  'api.openai.com',                      // OpenAI
  'api.siliconflow.cn'                   // 硅基流动
]);

const PROXY_MAX_TIMEOUT_MS = 30000; // 现有最长超时是硅基流动的 30s

// 校验 proxyFetch 的目标地址：必须是 https 且域名在白名单内
function parseAllowedProxyUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (e) {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (!PROXY_ALLOWED_HOSTS.has(parsed.hostname)) return null;
  return parsed;
}

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

    case 'proxyFetch': {
      // 后台代发网络请求：持有 <all_urls> host 权限，可绕过内容脚本的 CORS 限制
      // 安全校验：只接受本扩展自己的消息；目标地址只放行白名单域名和
      // https；只允许 GET/POST；超时设上限。防止这个通用代理被用来
      // 请求任意地址或把各引擎的 API 密钥带到白名单之外的站点。
      if (sender.id && chrome.runtime.id && sender.id !== chrome.runtime.id) {
        sendResponse({ error: 'proxyFetch: 不允许的调用方' });
        return true;
      }
      const { url, options, timeoutMs } = request;
      const parsedUrl = parseAllowedProxyUrl(url);
      if (!parsedUrl) {
        sendResponse({ error: 'proxyFetch: 不在白名单内的请求地址' });
        return true;
      }
      const method = ((options && options.method) || 'GET').toUpperCase();
      if (method !== 'GET' && method !== 'POST') {
        sendResponse({ error: 'proxyFetch: 不允许的请求方法' });
        return true;
      }
      const timeout = (Number.isFinite(timeoutMs) && timeoutMs > 0)
        ? Math.min(timeoutMs, PROXY_MAX_TIMEOUT_MS) : 8000;
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), timeout);
      const opts = Object.assign({}, options || {});
      delete opts.signal; // 信号不可序列化，后台自建
      try {
        fetch(parsedUrl.href, Object.assign(opts, { signal: controller.signal }))
          .then(async (res) => {
            clearTimeout(tid);
            const ct = res.headers && res.headers.get ? (res.headers.get('content-type') || '') : '';
            let json = null, text = null;
            try {
              if (ct.indexOf('application/json') !== -1) json = await res.json();
              else text = await res.text();
            } catch (e) {
              try { text = await res.text(); } catch (e2) { text = ''; }
            }
            sendResponse({ ok: res.ok, status: res.status, json, text });
          })
          .catch((err) => {
            clearTimeout(tid);
            sendResponse({
              error: (err && err.name === 'AbortError') ? '请求超时' :
                     (err && err.message ? err.message : String(err))
            });
          });
      } catch (e) {
        clearTimeout(tid);
        sendResponse({ error: e.message || String(e) });
      }
      return true; // 异步响应
    }

    case 'ocr': {
      handleOcr(request, sendResponse);
      return true; // 异步响应
    }
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
    // 尊重设置页的「启用快捷键」开关
    chrome.storage.sync.get({ enableShortcut: true }, function(result) {
      if (!result.enableShortcut) return;
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'translate-selection' });
        }
      });
    });
  }
});

/**
 * 截图翻译功能
 */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'capture-screenshot') {
    // 获取当前活动标签页
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        // 截取当前标签页的屏幕
        chrome.tabs.captureVisibleTab(tabs[0].windowId, { format: 'png' }, function(dataUrl) {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ screenshot: dataUrl });
          }
        });
      } else {
        sendResponse({ error: 'No active tab found' });
      }
    });
    return true; // 异步响应
  }
});

/**
 * 免费 OCR：调用 OCR.space 的文字识别接口。
 * 这里是「调用远程服务接口」，不是「加载远程代码」，
 * 因此符合 MV3 的 CSP 约束（不会再触发 Insecure CSP value 报错）。
 * 默认使用官方公开的免费体验 key（有频率与体积限制），
 * 用户可在设置页填入自己申请的免费 key 以获得更高配额。
 */
async function handleOcr(request, sendResponse) {
  try {
    const stored = await chrome.storage.sync.get({ ocrKey: '' });
    const apiKey = (stored.ocrKey && String(stored.ocrKey).trim()) || 'helloworld';

    const body = new URLSearchParams();
    body.set('apikey', apiKey);
    body.set('base64Image', request.image);
    body.set('language', request.lang || 'chs');
    body.set('isOverlayRequired', 'false');
    body.set('detectOrientation', 'true');
    body.set('scale', 'true');

    const res = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    if (!res.ok) throw new Error('OCR 服务返回 HTTP ' + res.status);

    const data = await res.json();
    if (data.IsErroredOnProcessing) {
      const msg =
        (data.ErrorMessage && data.ErrorMessage[0]) ||
        (data.ParsedResults && data.ParsedResults[0] && data.ParsedResults[0].ErrorMessage) ||
        'OCR 处理失败';
      throw new Error(String(msg));
    }
    const results = data.ParsedResults || [];
    const text = results.map(r => (r.ParsedText || '')).join('\n').trim();
    sendResponse({ text });
  } catch (e) {
    sendResponse({ error: (e && e.message) ? e.message : 'OCR 识别失败' });
  }
}

console.log('[Selection Translator] 后台服务已启动');
