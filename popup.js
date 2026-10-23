/**
 * 划词翻译 - 弹出窗口脚本 v1.4.4
 * 参考 DeepL / Google 翻译插件交互：语言互换、引擎选择、复制/朗读、自动翻译选中文本
 */

// ===== 语言列表（与 content.js languages 保持一致，30+ 种）=====
const LANGUAGES = [
  ['zh', '中文'], ['zh-TW', '繁体中文'], ['en', '英语'], ['ja', '日语'], ['ko', '韩语'],
  ['fr', '法语'], ['de', '德语'], ['es', '西班牙语'], ['ru', '俄语'], ['it', '意大利语'],
  ['pt', '葡萄牙语'], ['ar', '阿拉伯语'], ['th', '泰语'], ['vi', '越南语'], ['id', '印尼语'],
  ['ms', '马来语'], ['tr', '土耳其语'], ['pl', '波兰语'], ['nl', '荷兰语'], ['sv', '瑞典语'],
  ['hi', '印地语'], ['uk', '乌克兰语'], ['el', '希腊语'], ['he', '希伯来语'], ['fa', '波斯语'],
  ['tl', '菲律宾语'], ['fi', '芬兰语'], ['da', '丹麦语'], ['no', '挪威语'], ['hu', '匈牙利语'],
  ['ro', '罗马尼亚语'], ['cs', '捷克语'], ['sk', '斯洛伐克语'], ['bg', '保加利亚语'],
  ['hr', '克罗地亚语'], ['sr', '塞尔维亚语'], ['bn', '孟加拉语'], ['ur', '乌尔都语'],
  ['ta', '泰米尔语'], ['sw', '斯瓦希里语']
];
const LANG_NAME = Object.fromEntries(LANGUAGES);

// ===== 引擎规范顺序（与 content.js ENGINE_ORDER 一致，硅基流动第三）=====
const ENGINE_ORDER = ['google', 'mymemory', 'silicon', 'libre', 'lingva', 'baidu',
                      'youdao', 'tencent', 'aliyun', 'microsoft', 'deepl', 'openai', 'volcengine'];
const ENGINE_NAMES = {
  'google': 'Google 翻译', 'mymemory': 'MyMemory', 'silicon': '硅基流动 (AI)',
  'libre': 'LibreTranslate', 'lingva': 'Lingva', 'baidu': '百度翻译',
  'youdao': '有道翻译', 'tencent': '腾讯翻译君', 'aliyun': '阿里翻译',
  'microsoft': '微软翻译', 'deepl': 'DeepL', 'openai': 'OpenAI (AI)', 'volcengine': '火山引擎'
};
// 弹窗内无法完成本地签名的引擎（需在网页划词中使用）
const UNSUPPORTED_IN_POPUP = ['baidu', 'youdao', 'tencent', 'aliyun', 'volcengine'];
// 免密钥引擎，可作回退
const KEYLESS_ENGINES = ['google', 'mymemory', 'libre', 'lingva'];

document.addEventListener('DOMContentLoaded', function() {
  const inputText   = document.getElementById('inputText');
  const translateBtn = document.getElementById('translateBtn');
  const resultBox   = document.getElementById('resultBox');
  const resultMeta  = document.getElementById('resultMeta');
  const detectedChip = document.getElementById('detectedChip');
  const sourceLang  = document.getElementById('sourceLang');
  const targetLang  = document.getElementById('targetLang');
  const engineSelect = document.getElementById('engineSelect');
  const swapBtn     = document.getElementById('swapBtn');
  const clearBtn    = document.getElementById('clearBtn');
  const charCount   = document.getElementById('charCount');
  const settingsBtn = document.getElementById('settingsBtn');
  const copyBtn     = document.getElementById('copyBtn');
  const speakBtn    = document.getElementById('speakBtn');

  let engineConfigs = {};   // 各引擎密钥
  let enabledEngines = [];  // 启用的引擎（已排序）
  let lastResult = null;    // { text, from, to }

  // ===== 初始化 UI =====
  // 语言下拉
  const sourceHtml = '<option value="auto">🔍 自动检测</option>' +
    LANGUAGES.map(([c, n]) => `<option value="${c}">${n}</option>`).join('');
  const targetHtml = LANGUAGES.map(([c, n]) => `<option value="${c}">${n}</option>`).join('');
  sourceLang.innerHTML = sourceHtml;
  targetLang.innerHTML = targetHtml;

  // 加载设置
  chrome.storage.sync.get(['sourceLang', 'targetLang', 'engines', 'primaryEngine', 'engineConfigs'], function(result) {
    if (result.sourceLang) sourceLang.value = result.sourceLang;
    if (result.targetLang) targetLang.value = result.targetLang;
    engineConfigs = result.engineConfigs || {};
    enabledEngines = sortEngines(result.engines || ['google']);
    buildEngineSelect(result.primaryEngine);
  });

  function sortEngines(list) {
    const idx = (e) => { const i = ENGINE_ORDER.indexOf(e); return i === -1 ? ENGINE_ORDER.length : i; };
    return [...list].sort((a, b) => idx(a) - idx(b));
  }

  function isConfigured(engine) {
    if (KEYLESS_ENGINES.includes(engine)) return true;
    const need = {
      'silicon': ['silicon-key'], 'deepl': ['deepl-key'], 'openai': ['openai-key'],
      'microsoft': ['microsoft-key']
    }[engine];
    if (!need) return true;
    return need.every(k => (engineConfigs[k] || '').trim() !== '');
  }

  function buildEngineSelect(primary) {
    engineSelect.innerHTML = enabledEngines.map(e => {
      const ok = isConfigured(e);
      const name = ENGINE_NAMES[e] || e;
      return `<option value="${e}">${name}${ok ? '' : '（未配置密钥）'}</option>`;
    }).join('');
    if (primary && enabledEngines.includes(primary)) {
      engineSelect.value = primary;
    } else {
      // 主引擎不可用则选第一个已配置的
      const firstOk = enabledEngines.find(isConfigured);
      if (firstOk) engineSelect.value = firstOk;
    }
    engineSelect.addEventListener('change', function() {
      chrome.storage.sync.set({ primaryEngine: engineSelect.value });
    });
  }

  // ===== 设置按钮 =====
  settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

  // ===== 输入交互 =====
  function updateCharCount() {
    const len = inputText.value.length;
    charCount.textContent = len ? `${len} / 5000` : '';
    clearBtn.style.display = len ? 'block' : 'none';
  }
  inputText.addEventListener('input', updateCharCount);

  clearBtn.addEventListener('click', () => {
    inputText.value = '';
    updateCharCount();
    setResultPlaceholder();
    inputText.focus();
  });

  // 回车 / Ctrl+Enter 翻译
  inputText.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doTranslate();
    }
  });
  translateBtn.addEventListener('click', doTranslate);

  // ===== 交换语言 =====
  swapBtn.addEventListener('click', function() {
    const s = sourceLang.value, t = targetLang.value;
    sourceLang.value = t;
    // 原来源是自动检测时，目标语言用上一次检测结果
    targetLang.value = (s === 'auto') ? (lastResult?.detected || 'en') : s;
    chrome.storage.sync.set({ sourceLang: sourceLang.value, targetLang: targetLang.value });
    // 已有译文则按新方向重译
    if (lastResult && inputText.value.trim()) {
      inputText.value = lastResult.text;
      doTranslate();
    }
  });

  // ===== 复制 / 朗读 =====
  copyBtn.addEventListener('click', function() {
    if (!lastResult?.text) return;
    navigator.clipboard.writeText(lastResult.text).then(() => {
      copyBtn.textContent = '✅ 已复制';
      setTimeout(() => { copyBtn.textContent = '📋 复制'; }, 1500);
    });
  });

  speakBtn.addEventListener('click', function() {
    if (!lastResult?.text) return;
    const u = new SpeechSynthesisUtterance(lastResult.text);
    const map = { 'zh': 'zh-CN', 'en': 'en-US', 'ja': 'ja-JP', 'ko': 'ko-KR' };
    u.lang = map[lastResult.to] || lastResult.to;
    u.rate = 0.95;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  });

  // ===== 翻译主流程 =====
  async function doTranslate() {
    const text = inputText.value.trim();
    if (!text) return;

    const from = sourceLang.value;
    const to = targetLang.value;
    translateBtn.disabled = true;
    resultBox.className = 'result-text';
    resultBox.innerHTML = '<div class="loading-row"><div class="spinner"></div><span>翻译中…</span></div>';
    resultMeta.style.display = 'none';
    lastResult = null;

    const engine = engineSelect.value;
    // 首选引擎 → 其余已启用引擎依次回退
    const chain = [engine, ...enabledEngines.filter(e => e !== engine)];
    let lastError = null;

    for (const e of chain) {
      try {
        const result = await translateWith(e, text, from, to);
        lastResult = { text: result.translatedText, from, to, detected: result.detectedLang };
        resultBox.textContent = result.translatedText;
        // 检测语言标签
        if (from === 'auto' && result.detectedLang && result.detectedLang !== 'auto') {
          detectedChip.textContent = `检测到：${LANG_NAME[result.detectedLang] || result.detectedLang}`;
          resultMeta.style.display = 'flex';
        } else {
          resultMeta.style.display = 'flex';
          detectedChip.textContent = `${LANG_NAME[from] || from} → ${LANG_NAME[to] || to}`;
        }
        translateBtn.disabled = false;
        return;
      } catch (err) {
        lastError = err;
        console.log(`[Popup] 引擎 ${e} 失败:`, err.message);
      }
    }

    resultBox.className = 'result-text error';
    resultBox.textContent = `翻译失败：${lastError ? lastError.message : '未知错误'}`;
    translateBtn.disabled = false;
  }

  async function translateWith(engine, text, from, to) {
    switch (engine) {
      case 'google':    return await googleTranslate(text, from, to);
      case 'mymemory':  return await myMemoryTranslate(text, from, to);
      case 'libre':     return await libreTranslate(text, from, to);
      case 'lingva':    return await lingvaTranslate(text, from, to);
      case 'silicon':   return await siliconTranslate(text, from, to);
      case 'deepl':     return await deeplTranslate(text, from, to);
      case 'openai':    return await openaiTranslate(text, from, to);
      case 'microsoft': return await microsoftTranslate(text, from, to);
      default:
        throw new Error(`${ENGINE_NAMES[engine] || engine} 暂不支持在弹窗中使用，请使用网页划词翻译`);
    }
  }

  // ===== 后台代理请求（绕过 CORS，与 content.js 一致）=====
  function bgFetch(url, options = {}, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'proxyFetch', url, options, timeoutMs }, (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!res) return reject(new Error('后台服务无响应'));
        if (res.error) return reject(new Error(res.error));
        resolve(res);
      });
    });
  }

  function extractApiError(resp, label) {
    const d = resp.json;
    let msg = '';
    if (d && typeof d === 'object') {
      msg = d.message || (d.error && (d.error.message || d.error.type)) || d.error_msg || d.detail || '';
    }
    if (!msg && resp.text) {
      const t = String(resp.text).trim().replace(/\s+/g, ' ');
      if (t) msg = t.length > 120 ? t.slice(0, 120) + '…' : t;
    }
    return msg ? `${label}: ${msg}` : `${label} (HTTP ${resp.status})`;
  }

  function cfg(key) { return (engineConfigs[key] || '').trim(); }

  // ===== 各引擎实现 =====
  async function googleTranslate(text, from, to) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
    const resp = await bgFetch(url);
    if (!resp.ok || !resp.json) throw new Error(extractApiError(resp, 'Google 请求失败'));
    let out = '';
    (resp.json[0] || []).forEach(item => { if (item[0]) out += item[0]; });
    return { translatedText: out, detectedLang: resp.json[2] || from };
  }

  async function myMemoryTranslate(text, from, to) {
    const pair = from === 'auto' ? `|${to}` : `${from}|${to}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`;
    const resp = await bgFetch(url);
    if (!resp.ok || !resp.json) throw new Error(extractApiError(resp, 'MyMemory 请求失败'));
    const d = resp.json;
    if (d.responseStatus !== 200) throw new Error(d.responseDetails || 'MyMemory 翻译失败');
    return { translatedText: d.responseData.translatedText, detectedLang: d.responseData.detectedLanguage || from };
  }

  async function libreTranslate(text, from, to) {
    const resp = await bgFetch('https://libretranslate.de/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: from, target: to, format: 'text' })
    });
    if (!resp.ok || !resp.json) throw new Error(extractApiError(resp, 'LibreTranslate 请求失败'));
    return { translatedText: resp.json.translatedText, detectedLang: resp.json.detectedLanguage?.language || from };
  }

  async function lingvaTranslate(text, from, to) {
    const instances = ['https://lingva.ml', 'https://lingva.garudalinux.org', 'https://translate.plausibility.cloud'];
    let lastErr = null;
    for (const base of instances) {
      try {
        const resp = await bgFetch(`${base}/api/v1/${from}/${to}/${encodeURIComponent(text)}`);
        if (!resp.ok || !resp.json) throw new Error(extractApiError(resp, 'Lingva 请求失败'));
        return { translatedText: resp.json.translation, detectedLang: resp.json.info?.detectedSource || from };
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('Lingva 所有实例均不可用');
  }

  async function siliconTranslate(text, from, to) {
    const key = cfg('silicon-key');
    if (!key) throw new Error('硅基流动需要配置 API Key（设置 → 翻译引擎）');
    const model = cfg('silicon-model') || 'deepseek-ai/DeepSeek-V3';
    const s = from === 'auto' ? '自动检测的语言' : (LANG_NAME[from] || from);
    const t = LANG_NAME[to] || to;
    const resp = await bgFetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: `你是一个专业的翻译助手。请将用户提供的文本从${s}翻译成${t}。只返回翻译结果，不要添加任何解释、注释或额外内容。保持原文的段落与换行格式。` },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 4096
      })
    }, 30000);
    if (!resp.ok) throw new Error(extractApiError(resp, '硅基流动请求失败'));
    const d = resp.json;
    if (!d.choices?.[0]?.message) throw new Error('硅基流动返回格式异常');
    return { translatedText: d.choices[0].message.content.trim(), detectedLang: from };
  }

  async function deeplTranslate(text, from, to) {
    const key = cfg('deepl-key');
    if (!key) throw new Error('DeepL 需要配置 API Key（设置 → 翻译引擎）');
    const isPro = key.endsWith(':fx') ? false : cfg('deepl-type') === 'pro';
    const url = isPro ? 'https://api.deepl.com/v2/translate' : 'https://api-free.deepl.com/v2/translate';
    const resp = await bgFetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: [text], target_lang: to.toUpperCase() })
    });
    if (!resp.ok) throw new Error(extractApiError(resp, 'DeepL 请求失败'));
    const d = resp.json;
    if (!d.translations?.[0]) throw new Error('DeepL 返回格式异常');
    return { translatedText: d.translations[0].text, detectedLang: d.translations[0].detected_source_language || from };
  }

  async function openaiTranslate(text, from, to) {
    const key = cfg('openai-key');
    if (!key) throw new Error('OpenAI 需要配置 API Key（设置 → 翻译引擎）');
    const model = cfg('openai-model') || 'gpt-3.5-turbo';
    const s = from === 'auto' ? 'auto-detect the source language' : (LANG_NAME[from] || from);
    const t = LANG_NAME[to] || to;
    const resp = await bgFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: `You are a translator. Translate the following text from ${s} to ${t}. Only return the translation, no explanations.` },
          { role: 'user', content: text }
        ],
        temperature: 0.3
      })
    }, 30000);
    if (!resp.ok) throw new Error(extractApiError(resp, 'OpenAI 请求失败'));
    const d = resp.json;
    if (!d.choices?.[0]?.message) throw new Error('OpenAI 返回格式异常');
    return { translatedText: d.choices[0].message.content.trim(), detectedLang: from };
  }

  async function microsoftTranslate(text, from, to) {
    const key = cfg('microsoft-key');
    if (!key) throw new Error('微软翻译需要配置 API Key（设置 → 翻译引擎）');
    const region = cfg('microsoft-region') || 'global';
    const resp = await bgFetch('https://api.cognitive.microsofttranslator.com/translate?api-version=3.0', {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Ocp-Apim-Subscription-Region': region,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{ Text: text }])
    });
    if (!resp.ok) throw new Error(extractApiError(resp, '微软翻译请求失败'));
    const d = resp.json;
    if (!d[0]?.translations?.[0]) throw new Error('微软翻译返回格式异常');
    return { translatedText: d[0].translations[0].text, detectedLang: d[0].detectedLanguage || from };
  }

  function setResultPlaceholder() {
    lastResult = null;
    resultMeta.style.display = 'none';
    resultBox.className = 'result-text placeholder';
    resultBox.textContent = '翻译结果将显示在这里';
  }

  // ===== 自动带入页面选中文本并翻译 =====
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs[0]) return;
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: () => window.getSelection().toString().trim()
    }, (results) => {
      if (results && results[0] && results[0].result) {
        inputText.value = results[0].result.slice(0, 5000);
        updateCharCount();
        doTranslate(); // 自动翻译
      } else {
        inputText.focus();
      }
    });
  });
});
