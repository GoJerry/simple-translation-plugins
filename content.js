/**
 * 划词翻译 - 内容脚本
 * 负责监听用户划词动作并显示翻译结果
 */

(function() {
  'use strict';

  // 防止重复注入
  if (window.selectionTranslatorLoaded) return;
  window.selectionTranslatorLoaded = true;

  // 翻译弹窗元素
  let translatePopup = null;
  let currentSelection = '';
  let hideTimeout = null;

  // 默认配置
  const defaultConfig = {
    targetLang: 'zh',           // 默认目标语言
    sourceLang: 'auto',         // 自动检测源语言
    triggerMode: 'auto',        // 触发模式: auto(自动), click(点击图标)
    showIcon: true,             // 是否显示翻译图标
    position: 'follow',         // 弹窗位置: follow(跟随鼠标), fixed(固定)
    theme: 'light',             // 主题: light, dark
    autoPlay: false,            // 是否自动播放发音
    maxLength: 5000             // 最大翻译长度
  };

  // 语言列表
  const languages = {
    'auto': '自动检测',
    'zh': '中文',
    'en': '英语',
    'ja': '日语',
    'ko': '韩语',
    'fr': '法语',
    'de': '德语',
    'es': '西班牙语',
    'ru': '俄语',
    'it': '意大利语',
    'pt': '葡萄牙语',
    'ar': '阿拉伯语',
    'th': '泰语',
    'vi': '越南语',
    'id': '印尼语',
    'ms': '马来语',
    'tr': '土耳其语',
    'pl': '波兰语',
    'nl': '荷兰语',
    'sv': '瑞典语'
  };

  /**
   * 获取用户配置
   */
  async function getConfig() {
    try {
      const result = await chrome.storage.sync.get(defaultConfig);
      return { ...defaultConfig, ...result };
    } catch (e) {
      return defaultConfig;
    }
  }

  /**
   * 创建翻译图标
   */
  function createTranslateIcon() {
    const icon = document.createElement('div');
    icon.id = 'st-translate-icon';
    icon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
      </svg>
    `;
    return icon;
  }

  /**
   * 创建翻译弹窗
   */
  function createTranslatePopup() {
    const popup = document.createElement('div');
    popup.id = 'st-translate-popup';
    popup.innerHTML = `
      <div class="st-popup-header">
        <span class="st-popup-title">翻译结果</span>
        <div class="st-popup-actions">
          <button class="st-btn-copy" title="复制">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button class="st-btn-close" title="关闭">×</button>
        </div>
      </div>
      <div class="st-popup-content">
        <div class="st-source-text"></div>
        <div class="st-divider"></div>
        <div class="st-translated-text">
          <div class="st-loading">
            <div class="st-spinner"></div>
            <span>翻译中...</span>
          </div>
        </div>
      </div>
      <div class="st-popup-footer">
        <span class="st-lang-info"></span>
        <button class="st-btn-speak" title="朗读">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
        </button>
      </div>
    `;

    // 绑定事件
    popup.querySelector('.st-btn-close').addEventListener('click', hidePopup);
    popup.querySelector('.st-btn-copy').addEventListener('click', copyResult);
    popup.querySelector('.st-btn-speak').addEventListener('click', speakText);

    // 阻止冒泡，防止点击弹窗时关闭
    popup.addEventListener('click', (e) => e.stopPropagation());
    popup.addEventListener('mousedown', (e) => e.stopPropagation());

    return popup;
  }

  /**
   * 显示翻译图标
   */
  function showTranslateIcon(rect, text) {
    removeTranslateIcon();
    
    const icon = createTranslateIcon();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    // 计算位置：在选中文本的右上角
    let left = rect.right + scrollX + 5;
    let top = rect.top + scrollY - 35;
    
    // 边界检查
    if (left + 40 > window.innerWidth + scrollX) {
      left = rect.left + scrollX - 45;
    }
    if (top < scrollY) {
      top = rect.bottom + scrollY + 5;
    }
    
    icon.style.left = `${left}px`;
    icon.style.top = `${top}px`;
    
    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      removeTranslateIcon();
      showTranslatePopup(rect, text);
    });
    
    document.body.appendChild(icon);
  }

  /**
   * 移除翻译图标
   */
  function removeTranslateIcon() {
    const icon = document.getElementById('st-translate-icon');
    if (icon) icon.remove();
  }

  /**
   * 显示翻译弹窗
   */
  async function showTranslatePopup(rect, text) {
    hidePopup();
    
    const config = await getConfig();
    const popup = createTranslatePopup();
    
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    // 计算位置
    let left = rect.left + scrollX;
    let top = rect.bottom + scrollY + 10;
    
    // 边界检查
    const popupWidth = 350;
    const popupHeight = 200;
    
    if (left + popupWidth > window.innerWidth + scrollX) {
      left = window.innerWidth + scrollX - popupWidth - 20;
    }
    if (top + popupHeight > window.innerHeight + scrollY) {
      top = rect.top + scrollY - popupHeight - 10;
    }
    
    popup.style.left = `${Math.max(10, left)}px`;
    popup.style.top = `${Math.max(10, top)}px`;
    
    // 设置主题
    if (config.theme === 'dark') {
      popup.classList.add('st-dark-theme');
    }
    
    // 显示原文
    const sourceText = popup.querySelector('.st-source-text');
    sourceText.textContent = text.length > 200 ? text.substring(0, 200) + '...' : text;
    
    document.body.appendChild(popup);
    translatePopup = popup;
    currentSelection = text;
    
    // 执行翻译
    performTranslation(text, config);
  }

  /**
   * 执行翻译
   */
  async function performTranslation(text, config) {
    const translatedDiv = translatePopup.querySelector('.st-translated-text');
    const langInfo = translatePopup.querySelector('.st-lang-info');
    
    try {
      const result = await translate(text, config.sourceLang, config.targetLang);
      
      translatedDiv.textContent = result.translatedText;
      langInfo.textContent = `${languages[result.detectedLang] || result.detectedLang} → ${languages[config.targetLang]}`;
      
      // 自动播放
      if (config.autoPlay) {
        speak(result.translatedText, config.targetLang);
      }
    } catch (error) {
      translatedDiv.innerHTML = `<span class="st-error">翻译失败: ${error.message}</span>`;
    }
  }

  /**
   * 翻译函数 - 使用多种翻译源
   */
  async function translate(text, from, to) {
    // 限制长度
    if (text.length > 5000) {
      text = text.substring(0, 5000);
    }

    // 尝试使用 Google Translate
    try {
      return await googleTranslate(text, from, to);
    } catch (e) {
      console.log('Google Translate failed, trying fallback...');
    }

    // 备用：使用 MyMemory API
    try {
      return await myMemoryTranslate(text, from, to);
    } catch (e) {
      console.log('MyMemory Translate failed...');
    }

    // 最后的备用
    throw new Error('所有翻译服务暂时不可用，请稍后重试');
  }

  /**
   * Google Translate API (免费接口)
   */
  async function googleTranslate(text, from, to) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Google Translate request failed');
    
    const data = await response.json();
    
    let translatedText = '';
    if (data && data[0]) {
      data[0].forEach(item => {
        if (item[0]) translatedText += item[0];
      });
    }
    
    return {
      translatedText: translatedText,
      detectedLang: data[2] || from
    };
  }

  /**
   * MyMemory API (免费翻译API)
   */
  async function myMemoryTranslate(text, from, to) {
    const langPair = from === 'auto' ? `|${to}` : `${from}|${to}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('MyMemory request failed');
    
    const data = await response.json();
    
    if (data.responseStatus !== 200) {
      throw new Error(data.responseDetails || 'Translation failed');
    }
    
    return {
      translatedText: data.responseData.translatedText,
      detectedLang: from === 'auto' ? data.responseData.detectedLanguage || 'auto' : from
    };
  }

  /**
   * 朗读文本
   */
  function speak(text, lang) {
    if (!window.speechSynthesis) return;
    
    // 取消之前的朗读
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'zh' ? 'zh-CN' : lang;
    utterance.rate = 0.9;
    
    window.speechSynthesis.speak(utterance);
  }

  /**
   * 朗读按钮点击
   */
  function speakText() {
    const text = translatePopup.querySelector('.st-translated-text').textContent;
    const langMatch = translatePopup.querySelector('.st-lang-info').textContent.match(/→\s*(\w+)/);
    const lang = langMatch ? langMatch[1] : 'en';
    speak(text, lang);
  }

  /**
   * 复制翻译结果
   */
  async function copyResult() {
    const text = translatePopup.querySelector('.st-translated-text').textContent;
    try {
      await navigator.clipboard.writeText(text);
      const btn = translatePopup.querySelector('.st-btn-copy');
      btn.classList.add('st-copied');
      setTimeout(() => btn.classList.remove('st-copied'), 1500);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  }

  /**
   * 隐藏弹窗
   */
  function hidePopup() {
    if (translatePopup) {
      translatePopup.remove();
      translatePopup = null;
    }
    // 停止朗读
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * 获取选中的文本
   */
  function getSelectedText() {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    return text;
  }

  /**
   * 获取选中文本的位置
   */
  function getSelectionRect() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return null;
    
    const range = selection.getRangeAt(0);
    return range.getBoundingClientRect();
  }

  /**
   * 鼠标抬起事件处理
   */
  async function handleMouseUp(e) {
    // 延迟执行，等待选区完成
    setTimeout(async () => {
      const text = getSelectedText();
      
      if (!text || text.length < 2) {
        removeTranslateIcon();
        return;
      }

      // 如果点击的是弹窗内部，不处理
      if (translatePopup && translatePopup.contains(e.target)) return;

      const config = await getConfig();
      const rect = getSelectionRect();
      
      if (!rect) return;

      if (config.triggerMode === 'auto') {
        // 自动模式：直接显示翻译
        showTranslatePopup(rect, text);
      } else {
        // 点击模式：显示图标
        if (config.showIcon) {
          showTranslateIcon(rect, text);
        }
      }
    }, 10);
  }

  /**
   * 点击页面其他地方关闭弹窗
   */
  function handleDocumentClick(e) {
    if (translatePopup && !translatePopup.contains(e.target)) {
      hidePopup();
    }
    removeTranslateIcon();
  }

  /**
   * 键盘快捷键处理
   */
  function handleKeyDown(e) {
    // ESC 关闭弹窗
    if (e.key === 'Escape') {
      hidePopup();
      removeTranslateIcon();
    }
    
    // Ctrl/Cmd + Shift + T 翻译选中文本
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
      const text = getSelectedText();
      if (text) {
        const rect = getSelectionRect();
        if (rect) showTranslatePopup(rect, text);
      }
    }
  }

  // 绑定事件
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleKeyDown);

  // 页面卸载时清理
  window.addEventListener('beforeunload', () => {
    hidePopup();
    removeTranslateIcon();
  });

  console.log('[Selection Translator] 划词翻译插件已加载');
})();
