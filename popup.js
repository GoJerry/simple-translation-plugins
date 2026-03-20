/**
 * 划词翻译 - 弹出窗口脚本
 */

document.addEventListener('DOMContentLoaded', function() {
  const inputText = document.getElementById('inputText');
  const translateBtn = document.getElementById('translateBtn');
  const resultBox = document.getElementById('resultBox');
  const sourceLang = document.getElementById('sourceLang');
  const targetLang = document.getElementById('targetLang');

  // 加载保存的语言设置
  chrome.storage.sync.get(['sourceLang', 'targetLang'], function(result) {
    if (result.sourceLang) sourceLang.value = result.sourceLang;
    if (result.targetLang) targetLang.value = result.targetLang;
  });

  // 翻译按钮点击事件
  translateBtn.addEventListener('click', async function() {
    const text = inputText.value.trim();
    if (!text) return;

    await performTranslation(text);
  });

  // 回车键翻译
  inputText.addEventListener('keypress', async function(e) {
    if (e.key === 'Enter') {
      const text = inputText.value.trim();
      if (!text) return;
      await performTranslation(text);
    }
  });

  // 语言选择变化时保存设置
  sourceLang.addEventListener('change', function() {
    chrome.storage.sync.set({ sourceLang: sourceLang.value });
  });

  targetLang.addEventListener('change', function() {
    chrome.storage.sync.set({ targetLang: targetLang.value });
  });

  // 执行翻译
  async function performTranslation(text) {
    resultBox.className = 'result-box loading';
    resultBox.innerHTML = '<div class="spinner"></div><span>翻译中...</span>';
    translateBtn.disabled = true;

    try {
      const result = await translate(text, sourceLang.value, targetLang.value);
      resultBox.className = 'result-box';
      resultBox.textContent = result.translatedText;
    } catch (error) {
      resultBox.className = 'result-box';
      resultBox.innerHTML = `<span style="color: #ff4d4f;">翻译失败: ${error.message}</span>`;
    } finally {
      translateBtn.disabled = false;
    }
  }

  // 翻译函数
  async function translate(text, from, to) {
    // 尝试 Google Translate
    try {
      return await googleTranslate(text, from, to);
    } catch (e) {
      console.log('Google Translate failed, trying fallback...');
    }

    // 备用：MyMemory API
    try {
      return await myMemoryTranslate(text, from, to);
    } catch (e) {
      throw new Error('翻译服务暂时不可用，请稍后重试');
    }
  }

  // Google Translate API
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

  // MyMemory API
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

  // 获取当前选中的文本
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0]) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: () => window.getSelection().toString().trim()
      }, (results) => {
        if (results && results[0] && results[0].result) {
          inputText.value = results[0].result;
          inputText.focus();
        }
      });
    }
  });
});
