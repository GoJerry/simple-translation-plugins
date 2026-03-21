/**
 * 划词翻译 - 内容脚本 v1.1.0
 * 支持划词翻译、悬浮取词、右键翻译、翻译历史
 */

(function() {
  'use strict';

  // 防止重复注入
  if (window.selectionTranslatorLoaded) return;
  window.selectionTranslatorLoaded = true;

  // 状态变量
  let translatePopup = null;
  let currentSelection = '';
  let lastHoverText = '';
  let hoverTimer = null;
  let currentTranslatedResult = null;
  let currentDetectedLang = '';
  let currentConfig = null;

  // 默认配置
  const defaultConfig = {
    targetLang: 'zh',
    sourceLang: 'auto',
    triggerMode: 'auto',
    showIcon: true,
    theme: 'light',
    autoPlay: false,
    maxLength: 5000,
    translationEngine: 'google',
    enableHistory: true,
    enableHover: true,
    hoverDelay: 300
  };

  // 语言列表
  const languages = {
    'auto': '自动检测', 'zh': '中文', 'en': '英语', 'ja': '日语',
    'ko': '韩语', 'fr': '法语', 'de': '德语', 'es': '西班牙语',
    'ru': '俄语', 'it': '意大利语', 'pt': '葡萄牙语', 'ar': '阿拉伯语',
    'th': '泰语', 'vi': '越南语', 'id': '印尼语', 'ms': '马来语',
    'tr': '土耳其语', 'pl': '波兰语', 'nl': '荷兰语', 'sv': '瑞典语'
  };

  // 初始化
  getConfig().then(config => { 
    currentConfig = config; 
    console.log('[Selection Translator] Config loaded:', config);
  });

  async function getConfig() {
    try {
      const result = await chrome.storage.sync.get(defaultConfig);
      return { ...defaultConfig, ...result };
    } catch (e) {
      return defaultConfig;
    }
  }

  // ==================== 翻译引擎 ====================

  async function translateText(text, from, to, engine) {
    if (text.length > 5000) text = text.substring(0, 5000);

    const engines = {
      google: googleTranslate,
      mymemory: myMemoryTranslate,
      libre: libreTranslate
    };

    const primary = engines[engine] || googleTranslate;
    try {
      return await primary(text, from, to);
    } catch (e) {
      // 主引擎失败，尝试其他引擎
      for (const [name, fn] of Object.entries(engines)) {
        if (name === engine) continue;
        try { return await fn(text, from, to); } catch (e2) { continue; }
      }
    }
    throw new Error('所有翻译服务暂时不可用，请检查网络连接');
  }

  async function googleTranslate(text, from, to) {
    // 添加超时处理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error('Google Translate failed');
      const data = await response.json();
      let translatedText = '';
      if (data && data[0]) {
        data[0].forEach(item => { if (item[0]) translatedText += item[0]; });
      }
      return { translatedText, detectedLang: data[2] || from, engine: 'Google' };
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  async function myMemoryTranslate(text, from, to) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    try {
      const langPair = from === 'auto' ? `|${to}` : `${from}|${to}`;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error('MyMemory failed');
      const data = await response.json();
      if (data.responseStatus !== 200) throw new Error(data.responseDetails || 'Translation failed');
      return {
        translatedText: data.responseData.translatedText,
        detectedLang: from === 'auto' ? data.responseData.detectedLanguage || 'auto' : from,
        engine: 'MyMemory'
      };
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  // 备用翻译：LibreTranslate（开源翻译API）
  async function libreTranslate(text, from, to) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    try {
      // 使用公共LibreTranslate实例
      const url = 'https://libretranslate.de/translate';
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: from === 'auto' ? 'auto' : from,
          target: to,
          format: 'text'
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error('LibreTranslate failed');
      const data = await response.json();
      return {
        translatedText: data.translatedText,
        detectedLang: from === 'auto' ? data.detectedLanguage?.language || 'auto' : from,
        engine: 'LibreTranslate'
      };
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  // ==================== UI组件 ====================

  function createTranslateIcon(rect, text) {
    removeTranslateIcon();
    const icon = document.createElement('div');
    icon.id = 'st-translate-icon';
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>';

    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    let left = rect.right + scrollX + 5;
    let top = rect.top + scrollY - 35;
    if (left + 40 > window.innerWidth + scrollX) left = rect.left + scrollX - 45;
    if (top < scrollY) top = rect.bottom + scrollY + 5;
    icon.style.left = `${left}px`;
    icon.style.top = `${top}px`;

    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      removeTranslateIcon();
      showPopup(rect, text);
    });
    document.body.appendChild(icon);
  }

  function removeTranslateIcon() {
    const icon = document.getElementById('st-translate-icon');
    if (icon) icon.remove();
  }

  function createPopup() {
    const popup = document.createElement('div');
    popup.id = 'st-translate-popup';
    popup.innerHTML = `
      <div class="st-popup-header">
        <div class="st-popup-header-left">
          <span class="st-popup-title">翻译结果</span>
          <select class="st-engine-select" title="选择翻译引擎">
            <option value="google">谷歌翻译</option>
            <option value="mymemory">MyMemory</option>
            <option value="libre">LibreTranslate</option>
          </select>
        </div>
        <div class="st-popup-actions">
          <button class="st-btn-icon st-btn-swap" title="互换语言">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>
          </button>
          <button class="st-btn-icon st-btn-copy" title="复制翻译">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
          <button class="st-btn-icon st-btn-speak-source" title="朗读原文">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
          </button>
          <button class="st-btn-icon st-btn-speak" title="朗读译文">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          </button>
          <button class="st-btn-icon st-btn-pin" title="固定弹窗">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 4.5l-4 4L7 10l-1.5 1.5 7 7L14 17l1.5-4 4-4"/></svg>
          </button>
          <button class="st-btn-icon st-btn-close" title="关闭">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="st-popup-content">
        <div class="st-source-text"></div>
        <div class="st-divider"></div>
        <div class="st-translated-text">
          <div class="st-loading"><div class="st-spinner"></div><span>翻译中...</span></div>
        </div>
      </div>
      <div class="st-popup-footer">
        <span class="st-lang-info"></span>
        <div class="st-footer-actions">
          <button class="st-btn-fullpage" title="全文翻译">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/></svg>
            <span>全文翻译</span>
          </button>
        </div>
      </div>
    `;

    // 绑定事件
    popup.querySelector('.st-btn-close').addEventListener('click', hidePopup);
    popup.querySelector('.st-btn-copy').addEventListener('click', copyResult);
    popup.querySelector('.st-btn-speak').addEventListener('click', () => speakTranslatedText());
    popup.querySelector('.st-btn-speak-source').addEventListener('click', () => speakSourceText());
    popup.querySelector('.st-btn-swap').addEventListener('click', swapLanguages);
    popup.querySelector('.st-btn-pin').addEventListener('click', togglePin);
    popup.querySelector('.st-btn-fullpage').addEventListener('click', translateFullPage);
    
    // 引擎选择事件
    const engineSelect = popup.querySelector('.st-engine-select');
    engineSelect.value = currentConfig?.translationEngine || 'google';
    engineSelect.addEventListener('change', async (e) => {
      const newEngine = e.target.value;
      // 更新配置
      currentConfig.translationEngine = newEngine;
      try {
        await chrome.storage.sync.set({ translationEngine: newEngine });
      } catch (e) {}
      // 重新翻译
      const sourceText = popup.querySelector('.st-source-text').textContent;
      if (sourceText && sourceText !== '翻译中...') {
        const translatedDiv = popup.querySelector('.st-translated-text');
        const langInfo = popup.querySelector('.st-lang-info');
        translatedDiv.textContent = '重新翻译中...';
        try {
          const result = await translateText(sourceText, currentConfig.sourceLang, currentConfig.targetLang, newEngine);
          translatedDiv.textContent = result.translatedText;
          currentDetectedLang = result.detectedLang;
          currentTranslatedResult = result;
          langInfo.textContent = `${languages[result.detectedLang] || result.detectedLang} → ${languages[currentConfig.targetLang]}`;
        } catch (error) {
          translatedDiv.innerHTML = `<span class="st-error">翻译失败: ${error.message}</span>`;
        }
      }
    });

    popup.addEventListener('click', (e) => e.stopPropagation());
    popup.addEventListener('mousedown', (e) => e.stopPropagation());

    return popup;
  }

  let isPinned = false;

  function togglePin() {
    isPinned = !isPinned;
    const btn = translatePopup.querySelector('.st-btn-pin');
    btn.classList.toggle('st-pinned', isPinned);
  }

  async function swapLanguages() {
    if (!currentTranslatedResult) return;
    const config = await getConfig();
    const source = translatePopup.querySelector('.st-source-text').textContent;
    const translated = translatePopup.querySelector('.st-translated-text').textContent;
    // 用译文作为原文重新翻译
    const newFrom = currentDetectedLang || 'auto';
    const newTo = config.sourceLang === 'auto' ? 'en' : config.sourceLang;
    showTranslatePopupDirect(source, translated, newFrom, newTo);
  }

  // ==================== 核心逻辑 ====================

  async function showPopup(rect, text) {
    hidePopup();
    const config = await getConfig();
    currentConfig = config;
    const popup = createPopup();

    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    let left = rect.left + scrollX;
    let top = rect.bottom + scrollY + 10;
    const popupWidth = 380;
    const popupHeight = 220;
    if (left + popupWidth > window.innerWidth + scrollX) left = window.innerWidth + scrollX - popupWidth - 20;
    if (top + popupHeight > window.innerHeight + scrollY) top = rect.top + scrollY - popupHeight - 10;

    popup.style.left = `${Math.max(10, left)}px`;
    popup.style.top = `${Math.max(10, top)}px`;
    if (config.theme === 'dark') popup.classList.add('st-dark-theme');

    const sourceText = popup.querySelector('.st-source-text');
    sourceText.textContent = text.length > 500 ? text.substring(0, 500) + '...' : text;

    document.body.appendChild(popup);
    translatePopup = popup;
    currentSelection = text;
    isPinned = false;

    // 执行翻译
    const translatedDiv = popup.querySelector('.st-translated-text');
    const langInfo = popup.querySelector('.st-lang-info');

    try {
      const result = await translateText(text, config.sourceLang, config.targetLang, config.translationEngine);
      translatedDiv.textContent = result.translatedText;
      currentDetectedLang = result.detectedLang;
      currentTranslatedResult = result;
      langInfo.textContent = `${languages[result.detectedLang] || result.detectedLang} → ${languages[config.targetLang]} · ${result.engine}`;

      // 保存到历史
      if (config.enableHistory) {
        try {
          chrome.runtime.sendMessage({
            action: 'save-to-history',
            data: { sourceText: text, translatedText: result.translatedText, sourceLang: result.detectedLang, targetLang: config.targetLang }
          });
        } catch (e) {}
      }

      if (config.autoPlay) speak(result.translatedText, config.targetLang);
    } catch (error) {
      translatedDiv.innerHTML = `<span class="st-error">翻译失败: ${error.message}</span>`;
    }
  }

  function showTranslatePopupDirect(sourceText, translatedText, from, to) {
    if (!translatePopup) return;
    const sourceDiv = translatePopup.querySelector('.st-source-text');
    const translatedDiv = translatePopup.querySelector('.st-translated-text');
    const langInfo = translatePopup.querySelector('.st-lang-info');
    sourceDiv.textContent = sourceText;
    translatedDiv.textContent = translatedText;
    langInfo.textContent = `${languages[from] || from} → ${languages[to] || to}`;
  }

  async function translateFullPage() {
    const config = await getConfig();
    const pageText = document.body.innerText;
    if (!pageText) return;

    // 创建全屏覆盖层
    const overlay = document.createElement('div');
    overlay.id = 'st-fullpage-overlay';
    overlay.innerHTML = `
      <div class="st-fullpage-container">
        <div class="st-fullpage-header">
          <h3>全文翻译中...</h3>
          <div class="st-fullpage-progress">
            <div class="st-fullpage-progress-bar"></div>
          </div>
          <span class="st-fullpage-count">0%</span>
          <button class="st-fullpage-close">关闭</button>
        </div>
        <div class="st-fullpage-content"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.st-fullpage-close').addEventListener('click', () => overlay.remove());

    // 分段翻译
    const paragraphs = pageText.split(/\n+/).filter(p => p.trim().length > 0);
    const content = overlay.querySelector('.st-fullpage-content');
    const progressBar = overlay.querySelector('.st-fullpage-progress-bar');
    const countSpan = overlay.querySelector('.st-fullpage-count');
    const headerH3 = overlay.querySelector('.st-fullpage-header h3');

    let completed = 0;
    const batchSize = 5; // 每次翻译5段

    for (let i = 0; i < paragraphs.length; i += batchSize) {
      const batch = paragraphs.slice(i, i + batchSize);
      const batchText = batch.join('\n');

      try {
        const result = await translateText(batchText, config.sourceLang, config.targetLang, config.translationEngine);
        const translatedParagraphs = result.translatedText.split('\n');

        batch.forEach((para, idx) => {
          const block = document.createElement('div');
          block.className = 'st-fullpage-block';
          block.innerHTML = `
            <div class="st-fullpage-source">${para.trim()}</div>
            <div class="st-fullpage-translated">${translatedParagraphs[idx]?.trim() || ''}</div>
          `;
          content.appendChild(block);
        });
      } catch (e) {
        batch.forEach(para => {
          const block = document.createElement('div');
          block.className = 'st-fullpage-block';
          block.innerHTML = `<div class="st-fullpage-source">${para.trim()}</div><div class="st-fullpage-translated st-error-text">翻译失败</div>`;
          content.appendChild(block);
        });
      }

      completed = Math.min(i + batchSize, paragraphs.length);
      const percent = Math.round((completed / paragraphs.length) * 100);
      progressBar.style.width = `${percent}%`;
      countSpan.textContent = `${percent}%`;
    }

    headerH3.textContent = '全文翻译完成';
  }

  function hidePopup() {
    if (translatePopup && !isPinned) {
      translatePopup.remove();
      translatePopup = null;
      currentTranslatedResult = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function forceHidePopup() {
    if (translatePopup) {
      translatePopup.remove();
      translatePopup = null;
      currentTranslatedResult = null;
      isPinned = false;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    const overlay = document.getElementById('st-fullpage-overlay');
    if (overlay) overlay.remove();
  }

  // ==================== 语音 ====================

  function speak(text, lang) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'zh' ? 'zh-CN' : (lang === 'ja' ? 'ja-JP' : (lang === 'ko' ? 'ko-KR' : lang));
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  function speakTranslatedText() {
    const text = translatePopup?.querySelector('.st-translated-text')?.textContent;
    if (text && currentConfig) speak(text, currentConfig.targetLang);
  }

  function speakSourceText() {
    if (currentSelection) speak(currentSelection, currentDetectedLang || 'auto');
  }

  // ==================== 复制 ====================

  async function copyResult() {
    const text = translatePopup?.querySelector('.st-translated-text')?.textContent;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const btn = translatePopup.querySelector('.st-btn-copy');
      btn.classList.add('st-copied');
      setTimeout(() => btn.classList.remove('st-copied'), 1500);
    } catch (e) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  // ==================== 事件处理 ====================

  function getSelectedText() {
    return (window.getSelection().toString() || '').trim();
  }

  function getSelectionRect() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return null;
    return selection.getRangeAt(0).getBoundingClientRect();
  }

  async function handleMouseUp(e) {
    // 延迟执行，等待选区完成
    setTimeout(async () => {
      const text = getSelectedText();
      console.log('[ST] MouseUp, selected text:', text?.substring(0, 50));
      
      if (!text || text.length < 1) { 
        removeTranslateIcon(); 
        return; 
      }
      
      // 如果点击在弹窗内，不处理
      if (translatePopup && translatePopup.contains(e.target)) {
        console.log('[ST] Click inside popup, ignoring');
        return;
      }

      const config = await getConfig();
      currentConfig = config;
      const rect = getSelectionRect();
      
      console.log('[ST] Trigger mode:', config.triggerMode, 'Rect:', rect);
      
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        console.log('[ST] No valid selection rect');
        return;
      }

      if (config.triggerMode === 'auto') {
        console.log('[ST] Showing popup with text:', text.substring(0, 50));
        showPopup(rect, text);
      } else if (config.showIcon) {
        createTranslateIcon(rect, text);
      }
    }, 50);
  }

  // 悬浮取词
  async function handleMouseMove(e) {
    if (!currentConfig || !currentConfig.enableHover) return;
    if (getSelectedText()) return; // 有选中时不触发悬浮

    const target = e.target;
    if (!target || target.closest('#st-translate-popup') || target.closest('#st-translate-icon') || target.closest('#st-fullpage-overlay')) return;

    // 仅在文本节点上触发
    const node = document.caretPositionFromPoint?.(e.clientX, e.clientY)?.node || document.elementFromPoint(e.clientX, e.clientY);
    if (!node || node.nodeType !== Node.TEXT_NODE) {
      clearTimeout(hoverTimer);
      return;
    }

    const text = node.textContent?.trim();
    if (!text || text === lastHoverText || text.length > 100) return;
    lastHoverText = text;

    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(async () => {
      // 获取鼠标位置作为rect
      const rect = { left: e.clientX - 5, top: e.clientY + 15, right: e.clientX + 5, bottom: e.clientY + 15, width: 10, height: 10 };
      showPopup(rect, text);
      lastHoverText = '';
    }, currentConfig.hoverDelay || 300);
  }

  function handleDocumentClick(e) {
    if (translatePopup && !translatePopup.contains(e.target) && !isPinned) {
      hidePopup();
    }
    if (!e.target.closest('#st-translate-popup') && !e.target.closest('#st-translate-icon')) {
      removeTranslateIcon();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { forceHidePopup(); removeTranslateIcon(); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
      const text = getSelectedText();
      if (text) { const rect = getSelectionRect(); if (rect) showPopup(rect, text); }
    }
  }

  // 监听来自后台的消息
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'context-translate') {
      const text = request.text || getSelectedText();
      if (text) {
        const selection = window.getSelection();
        let rect;
        if (selection.rangeCount > 0) {
          rect = selection.getRangeAt(0).getBoundingClientRect();
        }
        if (!rect) {
          rect = { left: window.innerWidth / 2 - 175, top: window.innerHeight / 2 - 100, right: window.innerWidth / 2 + 175, bottom: window.innerHeight / 2 + 100, width: 350, height: 200 };
        }
        showPopup(rect, text);
      }
      sendResponse({ success: true });
    } else if (request.action === 'copy-translation') {
      // 右键复制：先翻译再复制
      const text = request.text || getSelectedText();
      if (text) {
        const config = currentConfig || defaultConfig;
        translateText(text, config.sourceLang, config.targetLang, config.translationEngine)
          .then(result => navigator.clipboard.writeText(result.translatedText))
          .catch(() => {});
      }
      sendResponse({ success: true });
    } else if (request.action === 'speak-selection') {
      speak(request.text || getSelectedText(), 'auto');
      sendResponse({ success: true });
    } else if (request.action === 'translate-selection') {
      const text = getSelectedText();
      if (text) {
        const rect = getSelectionRect();
        if (rect) showPopup(rect, text);
      }
      sendResponse({ success: true });
    }
    return true;
  });

  // 绑定事件
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleKeyDown);

  window.addEventListener('beforeunload', () => { forceHidePopup(); removeTranslateIcon(); });

  console.log('[Selection Translator] v1.1.0 loaded');
})();
