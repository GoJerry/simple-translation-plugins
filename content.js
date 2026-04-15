/**
 * 划词翻译 - 内容脚本 v1.4.3
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
    engines: ['google'], // 默认启用的引擎列表
    engineConfigs: {},   // 引擎API配置
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

  // 引擎显示名称映射
  const engineDisplayNames = {
    'google': 'Google翻译',
    'mymemory': 'MyMemory',
    'libre': 'LibreTranslate',
    'baidu': '百度翻译',
    'youdao': '有道翻译',
    'tencent': '腾讯翻译君',
    'aliyun': '阿里翻译',
    'microsoft': '微软翻译',
    'deepl': 'DeepL',
    'openai': 'OpenAI',
    'silicon': '硅基流动',
    'volcengine': '火山引擎'
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
      libre: libreTranslate,
      baidu: baiduTranslate,
      youdao: youdaoTranslate,
      tencent: tencentTranslate,
      aliyun: aliyunTranslate,
      microsoft: microsoftTranslate,
      deepl: deeplTranslate,
      openai: openaiTranslate,
      silicon: siliconTranslate,
      volcengine: volcengineTranslate
    };

    const primary = engines[engine] || googleTranslate;
    try {
      return await primary(text, from, to);
    } catch (e) {
      console.log(`[ST] Engine ${engine} failed:`, e.message);
      // 主引擎失败，尝试其他启用的引擎
      const config = await getConfig();
      const enabledEngines = config.engines || ['google'];
      for (const name of enabledEngines) {
        if (name === engine || !engines[name]) continue;
        try { 
          return await engines[name](text, from, to); 
        } catch (e2) { 
          console.log(`[ST] Fallback engine ${name} failed:`, e2.message);
          continue; 
        }
      }
    }
    throw new Error('所有翻译服务暂时不可用，请检查网络连接或API配置');
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

  // ==================== 第三方翻译引擎（需API密钥）====================

  // 获取引擎配置
  async function getEngineConfig(key) {
    const config = await getConfig();
    const value = config.engineConfigs?.[key] || '';
    console.log(`[ST] getEngineConfig(${key}):`, value ? '已配置' : '未配置');
    return value;
  }

  // 百度翻译
  async function baiduTranslate(text, from, to) {
    const appid = await getEngineConfig('baidu-appid');
    const key = await getEngineConfig('baidu-key');
    if (!appid || !key) throw new Error('百度翻译需要配置App ID和密钥');
    
    const salt = Date.now();
    const sign = md5(appid + text + salt + key);
    const url = `https://fanyi-api.baidu.com/api/trans/vip/translate?q=${encodeURIComponent(text)}&from=${from}&to=${to}&appid=${appid}&salt=${salt}&sign=${sign}`;
    
    const response = await fetch(url);
    const data = await response.json();
    if (data.error_code) throw new Error(data.error_msg);
    return {
      translatedText: data.trans_result.map(r => r.dst).join('\n'),
      detectedLang: from === 'auto' ? data.from : from,
      engine: '百度翻译'
    };
  }

  // 有道翻译
  async function youdaoTranslate(text, from, to) {
    const appid = await getEngineConfig('youdao-appid');
    const key = await getEngineConfig('youdao-key');
    if (!appid || !key) throw new Error('有道翻译需要配置应用ID和密钥');
    
    const salt = Date.now();
    const curtime = Math.round(Date.now() / 1000);
    const input = text.length <= 20 ? text : text.substring(0, 10) + text.length + text.substring(text.length - 10);
    const sign = sha256(appid + input + salt + curtime + key);
    
    const url = `https://openapi.youdao.com/api?q=${encodeURIComponent(text)}&from=${from}&to=${to}&appKey=${appid}&salt=${salt}&sign=${sign}&signType=v3&curtime=${curtime}`;
    
    const response = await fetch(url);
    const data = await response.json();
    if (data.errorCode !== '0') throw new Error(data.errorMsg || '有道翻译失败');
    return {
      translatedText: data.translation.join('\n'),
      detectedLang: from === 'auto' ? data.l : from,
      engine: '有道翻译'
    };
  }

  // 腾讯翻译
  async function tencentTranslate(text, from, to) {
    const secretId = await getEngineConfig('tencent-secretid');
    const secretKey = await getEngineConfig('tencent-secretkey');
    if (!secretId || !secretKey) throw new Error('腾讯翻译需要配置Secret ID和Secret Key');
    
    // 腾讯翻译API需要签名，这里简化处理
    throw new Error('腾讯翻译API需要服务端签名，请使用其他引擎');
  }

  // 阿里翻译
  async function aliyunTranslate(text, from, to) {
    const accessKeyId = await getEngineConfig('aliyun-accesskeyid');
    const accessKeySecret = await getEngineConfig('aliyun-accesskeysecret');
    if (!accessKeyId || !accessKeySecret) throw new Error('阿里翻译需要配置Access Key');
    
    // 阿里翻译API需要签名，这里简化处理
    throw new Error('阿里翻译API需要服务端签名，请使用其他引擎');
  }

  // 微软翻译
  async function microsoftTranslate(text, from, to) {
    const key = await getEngineConfig('microsoft-key');
    const region = await getEngineConfig('microsoft-region') || 'global';
    if (!key) throw new Error('微软翻译需要配置Subscription Key');
    
    const url = 'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Ocp-Apim-Subscription-Region': region,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{ Text: text }]),
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return {
      translatedText: data[0].translations[0].text,
      detectedLang: from === 'auto' ? data[0].detectedLanguage?.language : from,
      engine: '微软翻译'
    };
  }

  // DeepL翻译
  async function deeplTranslate(text, from, to) {
    const key = await getEngineConfig('deepl-key');
    if (!key) throw new Error('DeepL需要配置API Key');
    
    const isPro = await getEngineConfig('deepl-type') === 'pro';
    const url = isPro ? 'https://api.deepl.com/v2/translate' : 'https://api-free.deepl.com/v2/translate';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `auth_key=${key}&text=${encodeURIComponent(text)}&source_lang=${from}&target_lang=${to.toUpperCase()}`
    });
    
    const data = await response.json();
    if (data.message) throw new Error(data.message);
    return {
      translatedText: data.translations[0].text,
      detectedLang: from === 'auto' ? data.translations[0].detected_source_language : from,
      engine: 'DeepL'
    };
  }

  // OpenAI翻译
  async function openaiTranslate(text, from, to) {
    const key = await getEngineConfig('openai-key');
    const model = await getEngineConfig('openai-model') || 'gpt-3.5-turbo';
    if (!key) throw new Error('OpenAI需要配置API Key');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [{
          role: 'system',
          content: `You are a translator. Translate the following text from ${from} to ${to}. Only return the translation, no explanations.`
        }, {
          role: 'user',
          content: text
        }],
        temperature: 0.3
      })
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return {
      translatedText: data.choices[0].message.content,
      detectedLang: from,
      engine: 'OpenAI'
    };
  }

  // 硅基流动翻译
  async function siliconTranslate(text, from, to) {
    const key = await getEngineConfig('silicon-key');
    const model = await getEngineConfig('silicon-model') || 'deepseek-ai/DeepSeek-V2.5';
    if (!key) throw new Error('硅基流动需要配置API Key');
    
    // 语言名称映射
    const langNames = {
      'zh': '中文', 'zh-TW': '繁体中文', 'en': '英语', 'ja': '日语', 'ko': '韩语',
      'fr': '法语', 'de': '德语', 'es': '西班牙语', 'ru': '俄语', 'it': '意大利语',
      'pt': '葡萄牙语', 'ar': '阿拉伯语', 'th': '泰语', 'vi': '越南语', 'id': '印尼语',
      'ms': '马来语', 'tr': '土耳其语', 'pl': '波兰语', 'nl': '荷兰语', 'sv': '瑞典语'
    };
    
    const sourceLangName = langNames[from] || from;
    const targetLangName = langNames[to] || to;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
    
    try {
      const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{
            role: 'system',
            content: `你是一个专业的翻译助手。请将用户提供的文本从${sourceLangName}翻译成${targetLangName}。只返回翻译结果，不要添加任何解释、注释或额外内容。`
          }, {
            role: 'user',
            content: text
          }],
          temperature: 0.3,
          max_tokens: 4096
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format');
      }
      
      return {
        translatedText: data.choices[0].message.content,
        detectedLang: from,
        engine: '硅基流动'
      };
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        throw new Error('硅基流动翻译超时，请检查网络或API Key');
      }
      throw e;
    }
  }

  // 火山引擎翻译
  async function volcengineTranslate(text, from, to) {
    const accessKeyId = await getEngineConfig('volcengine-accesskeyid');
    const secretKey = await getEngineConfig('volcengine-secretkey');
    if (!accessKeyId || !secretKey) throw new Error('火山引擎需要配置Access Key');
    
    // 火山引擎需要签名，这里简化处理
    throw new Error('火山引擎API需要服务端签名，请使用其他引擎');
  }

  // MD5哈希函数（纯JavaScript实现）
  function md5(string) {
    function rotateLeft(lValue, iShiftBits) {
      return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }
    function addUnsigned(lX, lY) {
      const lX8 = (lX & 0x80000000), lY8 = (lY & 0x80000000);
      const lX4 = (lX & 0x40000000), lY4 = (lY & 0x40000000);
      const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
      if (lX4 & lY4) return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
      if (lX4 | lY4) {
        if (lResult & 0x40000000) return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
        return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
      }
      return (lResult ^ lX8 ^ lY8);
    }
    function f(x, y, z) { return (x & y) | ((~x) & z); }
    function g(x, y, z) { return (x & z) | (y & (~z)); }
    function h(x, y, z) { return (x ^ y ^ z); }
    function i(x, y, z) { return (y ^ (x | (~z))); }
    function ff(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function gg(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function hh(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function ii(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function convertToWordArray(string) {
      let lWordCount;
      const lMessageLength = string.length;
      const lNumberOfWordsTemp1 = lMessageLength + 8;
      const lNumberOfWordsTemp2 = (lNumberOfWordsTemp1 - (lNumberOfWordsTemp1 % 64)) / 64;
      const lNumberOfWords = (lNumberOfWordsTemp2 + 1) * 16;
      const lWordArray = new Array(lNumberOfWords - 1);
      let lBytePosition = 0, lByteCount = 0;
      while (lByteCount < lMessageLength) {
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
        lByteCount++;
      }
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
      lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
      lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
      return lWordArray;
    }
    function wordToHex(lValue) {
      let wordToHexValue = '', wordToHexValueTemp = '', lByte, lCount;
      for (lCount = 0; lCount <= 3; lCount++) {
        lByte = (lValue >>> (lCount * 8)) & 255;
        wordToHexValueTemp = '0' + lByte.toString(16);
        wordToHexValue = wordToHexValue + wordToHexValueTemp.substr(wordToHexValueTemp.length - 2, 2);
      }
      return wordToHexValue;
    }
    let x = [], k, AA, BB, CC, DD, a, b, c, d;
    const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    const S41 = 6, S42 = 10, S43 = 15, S44 = 21;
    string = unescape(encodeURIComponent(string));
    x = convertToWordArray(string);
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
    for (k = 0; k < x.length; k += 16) {
      AA = a; BB = b; CC = c; DD = d;
      a = ff(a, b, c, d, x[k + 0], S11, 0xD76AA478);
      d = ff(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
      c = ff(c, d, a, b, x[k + 2], S13, 0x242070DB);
      b = ff(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
      a = ff(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
      d = ff(d, a, b, c, x[k + 5], S12, 0x4787C62A);
      c = ff(c, d, a, b, x[k + 6], S13, 0xA8304613);
      b = ff(b, c, d, a, x[k + 7], S14, 0xFD469501);
      a = ff(a, b, c, d, x[k + 8], S11, 0x698098D8);
      d = ff(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
      c = ff(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
      b = ff(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
      a = ff(a, b, c, d, x[k + 12], S11, 0x6B901122);
      d = ff(d, a, b, c, x[k + 13], S12, 0xFD987193);
      c = ff(c, d, a, b, x[k + 14], S13, 0xA679438E);
      b = ff(b, c, d, a, x[k + 15], S14, 0x49B40821);
      a = gg(a, b, c, d, x[k + 1], S21, 0xF61E2562);
      d = gg(d, a, b, c, x[k + 6], S22, 0xC040B340);
      c = gg(c, d, a, b, x[k + 11], S23, 0x265E5A51);
      b = gg(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
      a = gg(a, b, c, d, x[k + 5], S21, 0xD62F105D);
      d = gg(d, a, b, c, x[k + 10], S22, 0x2441453);
      c = gg(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
      b = gg(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
      a = gg(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
      d = gg(d, a, b, c, x[k + 14], S22, 0xC33707D6);
      c = gg(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
      b = gg(b, c, d, a, x[k + 8], S24, 0x455A14ED);
      a = gg(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
      d = gg(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
      c = gg(c, d, a, b, x[k + 7], S23, 0x676F02D9);
      b = gg(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
      a = hh(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
      d = hh(d, a, b, c, x[k + 8], S32, 0x8771F681);
      c = hh(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
      b = hh(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
      a = hh(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
      d = hh(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
      c = hh(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
      b = hh(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
      a = hh(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
      d = hh(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
      c = hh(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
      b = hh(b, c, d, a, x[k + 6], S34, 0x4881D05);
      a = hh(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
      d = hh(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
      c = hh(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
      b = hh(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
      a = ii(a, b, c, d, x[k + 0], S41, 0xF4292244);
      d = ii(d, a, b, c, x[k + 7], S42, 0x432AFF97);
      c = ii(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
      b = ii(b, c, d, a, x[k + 5], S44, 0xFC93A039);
      a = ii(a, b, c, d, x[k + 12], S41, 0x655B59C3);
      d = ii(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
      c = ii(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
      b = ii(b, c, d, a, x[k + 1], S44, 0x85845DD1);
      a = ii(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
      d = ii(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
      c = ii(c, d, a, b, x[k + 6], S43, 0xA3014314);
      b = ii(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
      a = ii(a, b, c, d, x[k + 4], S41, 0xF7537E82);
      d = ii(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
      c = ii(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
      b = ii(b, c, d, a, x[k + 9], S44, 0xEB86D391);
      a = addUnsigned(a, AA); b = addUnsigned(b, BB); c = addUnsigned(c, CC); d = addUnsigned(d, DD);
    }
    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
  }

  // SHA256哈希函数（纯JavaScript实现）
  function sha256(string) {
    function rotateRight(n, x) { return (x >>> n) | (x << (32 - n)); }
    function choice(x, y, z) { return (x & y) ^ (~x & z); }
    function majority(x, y, z) { return (x & y) ^ (x & z) ^ (y & z); }
    function sigma0256(x) { return rotateRight(2, x) ^ rotateRight(13, x) ^ rotateRight(22, x); }
    function sigma1256(x) { return rotateRight(6, x) ^ rotateRight(11, x) ^ rotateRight(25, x); }
    function gamma0256(x) { return rotateRight(7, x) ^ rotateRight(18, x) ^ (x >>> 3); }
    function gamma1256(x) { return rotateRight(17, x) ^ rotateRight(19, x) ^ (x >>> 10); }
    function sha256_Sigma0(x) { return rotateRight(2, x) ^ rotateRight(13, x) ^ rotateRight(22, x); }
    function sha256_Sigma1(x) { return rotateRight(6, x) ^ rotateRight(11, x) ^ rotateRight(25, x); }
    
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    
    string = unescape(encodeURIComponent(string));
    const length = string.length;
    const bitLength = length * 8;
    const paddedLength = Math.ceil((length + 9) / 64) * 64;
    const words = new Array(paddedLength / 4);
    
    for (let i = 0; i < length; i++) {
      words[i >> 2] |= (string.charCodeAt(i) & 0xff) << ((3 - i) % 4 << 3);
    }
    words[length >> 2] |= 0x80 << ((3 - length) % 4 << 3);
    words[words.length - 1] = bitLength;
    
    for (let i = 0; i < words.length; i += 16) {
      const w = new Array(64);
      for (let t = 0; t < 16; t++) w[t] = words[i + t];
      for (let t = 16; t < 64; t++) {
        w[t] = (gamma1256(w[t - 2]) + w[t - 7] + gamma0256(w[t - 15]) + w[t - 16]) | 0;
      }
      
      let [a, b, c, d, e, f, g, h] = H;
      
      for (let t = 0; t < 64; t++) {
        const T1 = (h + sigma1256(e) + choice(e, f, g) + K[t] + w[t]) | 0;
        const T2 = (sigma0256(a) + majority(a, b, c)) | 0;
        h = g; g = f; f = e; e = (d + T1) | 0; d = c; c = b; b = a; a = (T1 + T2) | 0;
      }
      
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
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

  async function createPopup() {
    const popup = document.createElement('div');
    popup.id = 'st-translate-popup';
    
    // 获取启用的引擎列表
    const config = await getConfig();
    const enabledEngines = config.engines || ['google'];
    const primaryEngine = config.primaryEngine || enabledEngines[0] || 'google';
    
    console.log('[ST] createPopup - enabledEngines:', enabledEngines);
    console.log('[ST] createPopup - primaryEngine:', primaryEngine);
    console.log('[ST] createPopup - engineConfigs:', config.engineConfigs);
    
    // 生成引擎选项HTML（用于主引擎选择）
    const engineOptions = enabledEngines.map(engine => 
      `<option value="${engine}" ${engine === primaryEngine ? 'selected' : ''}>${engineDisplayNames[engine] || engine}</option>`
    ).join('');
    
    // 生成多翻译结果容器
    const multiResultsHtml = enabledEngines.map((engine, index) => `
      <div class="st-translation-result ${engine === primaryEngine ? 'st-primary-result' : 'st-secondary-result'}" data-engine="${engine}" style="${index > 2 ? 'display:none;' : ''}">
        <div class="st-engine-label">
          <span class="st-engine-name">${engineDisplayNames[engine] || engine}</span>
          ${engine === primaryEngine ? '<span class="st-primary-badge">主</span>' : ''}
        </div>
        <div class="st-engine-text st-loading">
          <div class="st-spinner"></div>
          <span>翻译中...</span>
        </div>
      </div>
    `).join('');
    
    const showMoreBtn = enabledEngines.length > 3 ? `
      <button class="st-btn-show-more" data-expanded="false">
        <span>展开更多翻译 (${enabledEngines.length - 3})</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M6 9l6 6 6-6"/></svg>
      </button>
    ` : '';
    
    popup.innerHTML = `
      <div class="st-popup-header">
        <div class="st-popup-header-left">
          <span class="st-popup-title">翻译结果</span>
          <select class="st-engine-select" title="选择主翻译引擎">
            ${engineOptions}
          </select>
        </div>
        <div class="st-popup-actions">
          <button class="st-btn-icon st-btn-swap" title="互换语言">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>
          </button>
          <button class="st-btn-icon st-btn-copy" title="复制主翻译">
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
        <div class="st-translations-container">
          ${multiResultsHtml}
        </div>
        ${showMoreBtn}
      </div>
      <div class="st-popup-footer">
        <span class="st-lang-info"></span>
        <div class="st-footer-actions">
          <button class="st-btn-screenshot" title="截图翻译">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            <span>截图翻译</span>
          </button>
          <button class="st-btn-fullpage" title="全文翻译">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/></svg>
            <span>全文翻译</span>
          </button>
        </div>
      </div>
    `;

    // 绑定事件
    popup.querySelector('.st-btn-close').addEventListener('click', (e) => {
      e.stopPropagation();
      hidePopup();
    });
    popup.querySelector('.st-btn-copy').addEventListener('click', (e) => {
      e.stopPropagation();
      copyResult();
    });
    popup.querySelector('.st-btn-speak').addEventListener('click', (e) => {
      e.stopPropagation();
      speakTranslatedText();
    });
    popup.querySelector('.st-btn-speak-source').addEventListener('click', (e) => {
      e.stopPropagation();
      speakSourceText();
    });
    popup.querySelector('.st-btn-swap').addEventListener('click', (e) => {
      e.stopPropagation();
      swapLanguages();
    });
    popup.querySelector('.st-btn-pin').addEventListener('click', (e) => {
      e.stopPropagation();
      togglePin();
    });
    popup.querySelector('.st-btn-fullpage').addEventListener('click', (e) => {
      e.stopPropagation();
      translateFullPage();
    });
    popup.querySelector('.st-btn-screenshot').addEventListener('click', (e) => {
      e.stopPropagation();
      captureAndTranslate();
    });
    
    // 展开更多翻译按钮
    const showMoreBtnEl = popup.querySelector('.st-btn-show-more');
    if (showMoreBtnEl) {
      showMoreBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const expanded = showMoreBtnEl.dataset.expanded === 'true';
        const hiddenResults = popup.querySelectorAll('.st-translation-result:nth-child(n+4)');
        hiddenResults.forEach(el => el.style.display = expanded ? 'none' : 'block');
        showMoreBtnEl.dataset.expanded = !expanded;
        showMoreBtnEl.querySelector('span').textContent = expanded ? 
          `展开更多翻译 (${enabledEngines.length - 3})` : '收起';
        showMoreBtnEl.classList.toggle('expanded', !expanded);
      });
    }
    
    // 引擎选择事件（切换主引擎）
    const engineSelect = popup.querySelector('.st-engine-select');
    engineSelect.addEventListener('change', async (e) => {
      const newEngine = e.target.value;
      // 更新主引擎样式
      popup.querySelectorAll('.st-translation-result').forEach(el => {
        const isPrimary = el.dataset.engine === newEngine;
        el.classList.toggle('st-primary-result', isPrimary);
        el.classList.toggle('st-secondary-result', !isPrimary);
        const badge = el.querySelector('.st-primary-badge');
        if (badge) badge.style.display = isPrimary ? 'inline' : 'none';
      });
      // 保存主引擎设置
      try {
        await chrome.storage.sync.set({ primaryEngine: newEngine });
      } catch (e) {}
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
    if (!currentTranslatedResult || !translatePopup) return;
    
    const sourceText = translatePopup.querySelector('.st-source-text').textContent;
    const currentSourceLang = currentConfig.currentSourceLang || 'auto';
    const currentTargetLang = currentConfig.currentTargetLang || currentConfig.targetLang;
    
    // 互换语言
    const newSourceLang = currentTargetLang;
    const newTargetLang = currentSourceLang === 'auto' ? 'en' : currentSourceLang;
    
    console.log('[ST] Swapping languages:', currentSourceLang, '->', currentTargetLang, 'to', newSourceLang, '->', newTargetLang);
    
    // 更新源文本显示
    const primaryResultEl = translatePopup.querySelector('.st-translation-result.st-primary-result .st-engine-text .st-translated-content');
    if (primaryResultEl) {
      const translatedText = primaryResultEl.textContent;
      translatePopup.querySelector('.st-source-text').textContent = translatedText;
      
      // 清空所有翻译结果并重新翻译
      translatePopup.querySelectorAll('.st-translation-result').forEach(el => {
        const textEl = el.querySelector('.st-engine-text');
        textEl.innerHTML = '<div class="st-loading"><div class="st-spinner"></div><span>翻译中...</span></div>';
      });
      
      // 使用互换后的语言重新翻译
      const enabledEngines = currentConfig.engines || ['google'];
      const primaryEngine = currentConfig.primaryEngine || enabledEngines[0] || 'google';
      
      enabledEngines.forEach(async (engineName) => {
        const resultEl = translatePopup.querySelector(`.st-translation-result[data-engine="${engineName}"] .st-engine-text`);
        if (!resultEl) return;
        
        try {
          const result = await translateText(translatedText, newSourceLang, newTargetLang, engineName);
          resultEl.innerHTML = `<div class="st-translated-content">${escapeHtml(result.translatedText)}</div>`;
          
          if (engineName === primaryEngine) {
            currentDetectedLang = result.detectedLang;
            currentTranslatedResult = result;
            currentConfig.currentSourceLang = newSourceLang;
            currentConfig.currentTargetLang = newTargetLang;
            translatePopup.querySelector('.st-lang-info').textContent = 
              `${languages[result.detectedLang] || result.detectedLang} → ${languages[newTargetLang]}`;
          }
        } catch (error) {
          resultEl.innerHTML = `<span class="st-error">${error.message}</span>`;
        }
      });
    }
  }

  // ==================== 核心逻辑 ====================

  async function showPopup(rect, text) {
    hidePopup();
    const config = await getConfig();
    currentConfig = config;
    const popup = await createPopup();

    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    let left = rect.left + scrollX;
    let top = rect.bottom + scrollY + 10;
    const popupWidth = 420;
    const popupHeight = 300;
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

    const langInfo = popup.querySelector('.st-lang-info');
    const enabledEngines = config.engines || ['google'];
    const primaryEngine = config.primaryEngine || enabledEngines[0] || 'google';
    
    // 智能语言检测：如果源语言是auto，检测文本是否为中文
    let sourceLang = config.sourceLang;
    let targetLang = config.targetLang;
    
    // 检测文本是否主要是中文
    const chineseRegex = /[\u4e00-\u9fa5]/;
    const isChinese = chineseRegex.test(text);
    
    if (sourceLang === 'auto' && isChinese) {
      // 如果文本是中文，默认翻译成英文
      sourceLang = 'zh';
      targetLang = 'en';
      console.log('[ST] Detected Chinese text, translating to English');
    } else if (sourceLang === 'auto' && !isChinese) {
      // 如果不是中文，按用户设置的目标语言翻译
      targetLang = config.targetLang;
    }
    
    // 存储所有翻译结果
    const allResults = [];
    let primaryResult = null;

    // 同时启动所有引擎的翻译
    const translationPromises = enabledEngines.map(async (engineName) => {
      const resultEl = popup.querySelector(`.st-translation-result[data-engine="${engineName}"] .st-engine-text`);
      if (!resultEl) return;
      
      try {
        const result = await translateText(text, sourceLang, targetLang, engineName);
        resultEl.classList.remove('st-loading');
        resultEl.innerHTML = `<div class="st-translated-content">${escapeHtml(result.translatedText)}</div>`;
        
        // 添加点击复制功能
        resultEl.addEventListener('click', () => {
          navigator.clipboard.writeText(result.translatedText);
          showToast('已复制到剪贴板');
        });
        
        allResults.push({ engine: engineName, ...result });
        
        if (engineName === primaryEngine) {
          primaryResult = result;
          currentDetectedLang = result.detectedLang;
          currentTranslatedResult = result;
          // 更新当前配置的语言设置，用于互换语言功能
          currentConfig.currentSourceLang = sourceLang;
          currentConfig.currentTargetLang = targetLang;
          langInfo.textContent = `${languages[result.detectedLang] || result.detectedLang} → ${languages[targetLang]}`;
          
          // 保存到历史（只保存主引擎结果）
          if (config.enableHistory) {
            try {
              chrome.runtime.sendMessage({
                action: 'save-to-history',
                data: { sourceText: text, translatedText: result.translatedText, sourceLang: result.detectedLang, targetLang: config.targetLang }
              });
            } catch (e) {}
          }
          
          if (config.autoPlay) speak(result.translatedText, config.targetLang);
        }
      } catch (error) {
        resultEl.classList.remove('st-loading');
        resultEl.innerHTML = `<span class="st-error">${error.message}</span>`;
      }
    });

    // 等待所有翻译完成
    await Promise.allSettled(translationPromises);
  }

  // HTML转义函数
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 显示提示
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'st-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('st-toast-show');
      setTimeout(() => {
        toast.classList.remove('st-toast-show');
        setTimeout(() => toast.remove(), 300);
      }, 1500);
    }, 10);
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

  /**
   * 截图翻译功能
   */
  async function captureAndTranslate() {
    try {
      // 先隐藏弹窗，避免截到弹窗本身
      if (translatePopup) {
        translatePopup.style.display = 'none';
      }
      
      // 请求后台截取屏幕
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'capture-screenshot' }, resolve);
      });
      
      // 恢复弹窗显示
      if (translatePopup) {
        translatePopup.style.display = 'block';
      }
      
      if (response.error) {
        showToast('截图失败: ' + response.error);
        return;
      }
      
      // 显示截图预览和提示
      showScreenshotPreview(response.screenshot);
      
    } catch (error) {
      console.error('[ST] Screenshot error:', error);
      showToast('截图失败，请重试');
      if (translatePopup) {
        translatePopup.style.display = 'block';
      }
    }
  }
  
  /**
   * 显示截图预览
   */
  function showScreenshotPreview(screenshotDataUrl) {
    // 创建截图预览层
    const preview = document.createElement('div');
    preview.id = 'st-screenshot-preview';
    preview.innerHTML = `
      <div class="st-screenshot-overlay">
        <div class="st-screenshot-container">
          <div class="st-screenshot-header">
            <span>截图翻译 - 选择要翻译的区域</span>
            <button class="st-screenshot-close">×</button>
          </div>
          <div class="st-screenshot-image-container">
            <img src="${screenshotDataUrl}" class="st-screenshot-image" />
            <div class="st-screenshot-selection"></div>
          </div>
          <div class="st-screenshot-footer">
            <span class="st-screenshot-hint">拖动选择区域，或点击图像识别文字</span>
            <button class="st-screenshot-cancel">取消</button>
            <button class="st-screenshot-confirm" disabled>识别文字</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(preview);
    
    // 绑定关闭事件
    preview.querySelector('.st-screenshot-close').addEventListener('click', () => {
      preview.remove();
    });
    preview.querySelector('.st-screenshot-cancel').addEventListener('click', () => {
      preview.remove();
    });
    
    // 点击预览图关闭（简化版：直接提示用户此功能需要OCR支持）
    preview.querySelector('.st-screenshot-image').addEventListener('click', () => {
      showToast('截图已保存到剪贴板，请使用OCR工具识别文字');
      // 复制图片到剪贴板
      copyImageToClipboard(screenshotDataUrl);
      preview.remove();
    });
  }
  
  /**
   * 复制图片到剪贴板
   */
  async function copyImageToClipboard(dataUrl) {
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      showToast('截图已复制到剪贴板');
    } catch (err) {
      console.error('[ST] Copy image failed:', err);
      showToast('复制失败，请手动保存图片');
    }
  }

  async function translateFullPage() {
    const config = await getConfig();
    
    // 获取页面主要内容，过滤掉导航、广告等
    const mainContent = getMainContent();
    if (!mainContent || mainContent.length === 0) {
      showToast('未找到可翻译的内容');
      return;
    }

    // 创建全屏覆盖层
    const overlay = document.createElement('div');
    overlay.id = 'st-fullpage-overlay';
    overlay.innerHTML = `
      <div class="st-fullpage-container">
        <div class="st-fullpage-header">
          <div class="st-fullpage-title">
            <h3>📖 双语对照翻译</h3>
            <span class="st-fullpage-stats">已翻译 0 / ${mainContent.length} 段</span>
          </div>
          <div class="st-fullpage-controls">
            <button class="st-fullpage-btn st-btn-original" title="显示原文">原文</button>
            <button class="st-fullpage-btn st-btn-bilingual active" title="双语对照">对照</button>
            <button class="st-fullpage-btn st-btn-translated" title="仅译文">译文</button>
            <button class="st-fullpage-btn st-btn-copy" title="复制全部译文">📋 复制</button>
            <button class="st-fullpage-close">✕</button>
          </div>
        </div>
        <div class="st-fullpage-progress">
          <div class="st-fullpage-progress-bar"></div>
        </div>
        <div class="st-fullpage-content"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    // 关闭按钮
    overlay.querySelector('.st-fullpage-close').addEventListener('click', () => overlay.remove());
    
    // 视图切换按钮
    const content = overlay.querySelector('.st-fullpage-content');
    overlay.querySelector('.st-btn-original').addEventListener('click', () => {
      content.className = 'st-fullpage-content view-original';
      updateActiveBtn(overlay, '.st-btn-original');
    });
    overlay.querySelector('.st-btn-bilingual').addEventListener('click', () => {
      content.className = 'st-fullpage-content view-bilingual';
      updateActiveBtn(overlay, '.st-btn-bilingual');
    });
    overlay.querySelector('.st-btn-translated').addEventListener('click', () => {
      content.className = 'st-fullpage-content view-translated';
      updateActiveBtn(overlay, '.st-btn-translated');
    });
    
    // 复制全部译文
    overlay.querySelector('.st-btn-copy').addEventListener('click', async () => {
      const translations = [];
      overlay.querySelectorAll('.st-fullpage-translated').forEach(el => {
        if (el.textContent && !el.classList.contains('st-translating')) {
          translations.push(el.textContent);
        }
      });
      if (translations.length > 0) {
        await navigator.clipboard.writeText(translations.join('\n\n'));
        showToast(`已复制 ${translations.length} 段译文`);
      }
    });

    const progressBar = overlay.querySelector('.st-fullpage-progress-bar');
    const statsSpan = overlay.querySelector('.st-fullpage-stats');

    let completed = 0;
    const batchSize = 3; // 每次翻译3段，提高稳定性

    // 智能语言检测
    let sourceLang = config.sourceLang;
    let targetLang = config.targetLang;
    const sampleText = mainContent.slice(0, 3).join(' ');
    const chineseRegex = /[\u4e00-\u9fa5]/;
    if (sourceLang === 'auto' && chineseRegex.test(sampleText)) {
      sourceLang = 'zh';
      targetLang = 'en';
    }

    // 创建段落块（先显示原文）
    mainContent.forEach((para, idx) => {
      const block = document.createElement('div');
      block.className = 'st-fullpage-block';
      block.dataset.index = idx;
      block.innerHTML = `
        <div class="st-fullpage-source">${escapeHtml(para)}</div>
        <div class="st-fullpage-translated st-translating">
          <div class="st-mini-spinner"></div>
          <span>翻译中...</span>
        </div>
      `;
      content.appendChild(block);
    });

    // 分批翻译
    for (let i = 0; i < mainContent.length; i += batchSize) {
      const batch = mainContent.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (para, idx) => {
        const actualIdx = i + idx;
        const block = content.querySelector(`.st-fullpage-block[data-index="${actualIdx}"]`);
        const translatedEl = block?.querySelector('.st-fullpage-translated');
        
        if (!block || !translatedEl) return;

        try {
          // 跳过太短的文本
          if (para.trim().length < 3) {
            translatedEl.innerHTML = escapeHtml(para);
            translatedEl.classList.remove('st-translating');
          } else {
            const result = await translateText(para, sourceLang, targetLang, config.primaryEngine || config.engines?.[0] || 'google');
            translatedEl.innerHTML = escapeHtml(result.translatedText);
            translatedEl.classList.remove('st-translating');
          }
        } catch (error) {
          translatedEl.innerHTML = `<span class="st-error-text">翻译失败: ${error.message}</span>`;
          translatedEl.classList.remove('st-translating');
        }
        
        completed++;
      }));

      // 更新进度
      const percent = Math.round((completed / mainContent.length) * 100);
      progressBar.style.width = `${percent}%`;
      statsSpan.textContent = `已翻译 ${completed} / ${mainContent.length} 段`;
      
      // 滚动到最新翻译的内容
      const lastTranslated = content.querySelector(`.st-fullpage-block[data-index="${Math.min(i + batchSize - 1, mainContent.length - 1)}"]`);
      if (lastTranslated) {
        lastTranslated.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    progressBar.style.width = '100%';
    statsSpan.textContent = `翻译完成！共 ${mainContent.length} 段`;
  }

  // 获取页面主要内容
  function getMainContent() {
    // 尝试找到主要内容区域
    const selectors = [
      'article', 'main', '[role="main"]',
      '.post-content', '.article-content', '.entry-content',
      '.content', '.main-content',
      '#content', '#main-content',
      '.markdown-body', '.post'
    ];
    
    let mainElement = null;
    for (const selector of selectors) {
      mainElement = document.querySelector(selector);
      if (mainElement) break;
    }
    
    // 如果没找到，使用 body
    if (!mainElement) {
      mainElement = document.body;
    }
    
    // 提取文本段落
    const paragraphs = [];
    const elements = mainElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote');
    
    elements.forEach(el => {
      // 过滤掉导航、广告等
      if (el.closest('nav, header, footer, aside, .sidebar, .advertisement, .ads, script, style')) {
        return;
      }
      
      const text = el.innerText?.trim();
      if (text && text.length > 0 && text.length < 5000) {
        paragraphs.push(text);
      }
    });
    
    // 去重并过滤
    return [...new Set(paragraphs)].filter(p => p.length > 0);
  }

  // 更新活动按钮状态
  function updateActiveBtn(overlay, activeSelector) {
    overlay.querySelectorAll('.st-fullpage-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    overlay.querySelector(activeSelector)?.classList.add('active');
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
    // 查找主翻译结果（带 st-primary-result 类的元素中的 st-translated-content）
    const primaryResult = translatePopup?.querySelector('.st-primary-result .st-translated-content');
    const text = primaryResult?.textContent;
    if (!text) {
      showToast('暂无翻译结果可复制');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      const btn = translatePopup.querySelector('.st-btn-copy');
      btn.classList.add('st-copied');
      showToast('已复制到剪贴板');
      setTimeout(() => btn.classList.remove('st-copied'), 1500);
    } catch (e) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('已复制到剪贴板');
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
      
      // 纯数字不需要翻译
      if (/^\d+$/.test(text)) {
        console.log('[ST] Pure number, skip translation');
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

  console.log('[Selection Translator] v1.4.3 loaded');
})();
