document.addEventListener('DOMContentLoaded', function() {
  const defaults = {
    targetLang: 'zh', sourceLang: 'auto', triggerMode: 'auto',
    showIcon: true, autoPlay: false, theme: 'light',
    engines: ['google'], // 默认启用Google
    engineConfigs: {},
    enableHistory: true,
    enableHover: true, hoverDelay: 300,
    primaryEngine: 'google', // 主翻译引擎
    showMultipleTranslations: true, // 是否显示多个翻译结果
    autoCopy: false, // 是否自动复制翻译结果
    popupPosition: 'auto', // 弹窗位置
    fontSize: 'medium', // 字体大小
    enableShortcut: true, // 启用快捷键
    enableContextMenu: true, // 启用右键菜单
    enableScreenshot: true, // 启用截图翻译
    enableFullPage: true, // 启用全文翻译
    enableTTS: true, // 启用语音朗读
    maxTranslations: 3 // 最多同时显示的翻译数量
  };

  // 所有可用引擎
  const availableEngines = [
    'google', 'mymemory', 'libre', // 免费
    'baidu', 'youdao', 'tencent', 'aliyun', 'microsoft',
    'deepl', 'openai', 'silicon', 'volcengine' // 需密钥
  ];

  // 引擎配置要求
  const engineConfigRequirements = {
    'baidu': ['baidu-appid', 'baidu-key'],
    'youdao': ['youdao-appid', 'youdao-key'],
    'tencent': ['tencent-secretid', 'tencent-secretkey'],
    'aliyun': ['aliyun-accesskeyid', 'aliyun-accesskeysecret'],
    'microsoft': ['microsoft-key'],
    'deepl': ['deepl-key'],
    'openai': ['openai-key'],
    'silicon': ['silicon-key'],
    'volcengine': ['volcengine-accesskeyid', 'volcengine-secretkey']
  };

  // 检查引擎是否已配置
  function isEngineConfigured(engine, engineConfigs) {
    const requirements = engineConfigRequirements[engine];
    if (!requirements) return true; // 免费引擎不需要配置
    return requirements.every(key => engineConfigs[key] && engineConfigs[key].trim() !== '');
  }

  // 更新引擎标签显示
  function updateEngineTags(engineConfigs) {
    document.querySelectorAll('.engine-item').forEach(item => {
      const checkbox = item.querySelector('input[name="engine"]');
      const tag = item.querySelector('.engine-tag');
      if (checkbox && tag) {
        const engine = checkbox.value;
        if (engineConfigRequirements[engine]) {
          const configured = isEngineConfigured(engine, engineConfigs);
          tag.textContent = configured ? '已配置' : '需密钥';
          tag.className = 'engine-tag ' + (configured ? 'configured' : 'key');
        }
      }
    });
  }

  function loadSettings() {
    chrome.storage.sync.get(defaults, function(result) {
      document.getElementById('targetLang').value = result.targetLang;
      document.getElementById('sourceLang').value = result.sourceLang;
      document.getElementById('showIcon').checked = result.showIcon;
      document.getElementById('autoPlay').checked = result.autoPlay;
      document.getElementById('enableHistory').checked = result.enableHistory;
      document.getElementById('enableHover').checked = result.enableHover;
      document.getElementById('hoverDelay').value = result.hoverDelay;
      
      // 新设置项
      const showMultiple = document.getElementById('showMultipleTranslations');
      if (showMultiple) showMultiple.checked = result.showMultipleTranslations !== false;
      const autoCopy = document.getElementById('autoCopy');
      if (autoCopy) autoCopy.checked = result.autoCopy || false;
      const enableContextMenu = document.getElementById('enableContextMenu');
      if (enableContextMenu) enableContextMenu.checked = result.enableContextMenu !== false;
      const enableShortcut = document.getElementById('enableShortcut');
      if (enableShortcut) enableShortcut.checked = result.enableShortcut !== false;
      const enableScreenshot = document.getElementById('enableScreenshot');
      if (enableScreenshot) enableScreenshot.checked = result.enableScreenshot !== false;
      const enableFullPage = document.getElementById('enableFullPage');
      if (enableFullPage) enableFullPage.checked = result.enableFullPage !== false;
      const enableTTS = document.getElementById('enableTTS');
      if (enableTTS) enableTTS.checked = result.enableTTS !== false;
      const maxTranslations = document.getElementById('maxTranslations');
      if (maxTranslations) maxTranslations.value = result.maxTranslations || 5000;

      document.querySelectorAll('input[name="triggerMode"]').forEach(r => { 
        r.checked = r.value === result.triggerMode; 
      });
      document.querySelectorAll('input[name="theme"]').forEach(r => { 
        r.checked = r.value === result.theme; 
      });
      document.querySelectorAll('input[name="popupPosition"]').forEach(r => { 
        r.checked = r.value === (result.popupPosition || 'auto'); 
      });
      document.querySelectorAll('input[name="fontSize"]').forEach(r => { 
        r.checked = r.value === (result.fontSize || 'medium'); 
      });

      // 加载引擎选择
      const engines = result.engines || ['google'];
      document.querySelectorAll('input[name="engine"]').forEach(cb => {
        cb.checked = engines.includes(cb.value);
        // 显示/隐藏配置区域
        const configDiv = document.querySelector(`.engine-config[data-engine="${cb.value}"]`);
        if (configDiv) {
          configDiv.classList.toggle('active', cb.checked);
        }
      });

      // 加载引擎配置
      const engineConfigs = result.engineConfigs || {};
      Object.keys(engineConfigs).forEach(key => {
        const input = document.querySelector(`.api-input[data-key="${key}"]`);
        if (input) input.value = engineConfigs[key];
      });

      // 更新引擎标签
      updateEngineTags(engineConfigs);
    });
  }

  function saveSettings() {
    // 收集选中的引擎
    const selectedEngines = [];
    document.querySelectorAll('input[name="engine"]:checked').forEach(cb => {
      selectedEngines.push(cb.value);
    });

    // 收集引擎配置
    const engineConfigs = {};
    document.querySelectorAll('.api-input').forEach(input => {
      if (input.value) {
        engineConfigs[input.dataset.key] = input.value;
      }
    });

    const settings = {
      targetLang: document.getElementById('targetLang').value,
      sourceLang: document.getElementById('sourceLang').value,
      triggerMode: document.querySelector('input[name="triggerMode"]:checked').value,
      theme: document.querySelector('input[name="theme"]:checked').value,
      popupPosition: document.querySelector('input[name="popupPosition"]:checked')?.value || 'auto',
      fontSize: document.querySelector('input[name="fontSize"]:checked')?.value || 'medium',
      showIcon: document.getElementById('showIcon').checked,
      autoPlay: document.getElementById('autoPlay').checked,
      enableHistory: document.getElementById('enableHistory').checked,
      enableHover: document.getElementById('enableHover').checked,
      hoverDelay: parseInt(document.getElementById('hoverDelay').value) || 300,
      engines: selectedEngines.length > 0 ? selectedEngines : ['google'],
      engineConfigs: engineConfigs,
      // 新设置项
      showMultipleTranslations: document.getElementById('showMultipleTranslations')?.checked !== false,
      autoCopy: document.getElementById('autoCopy')?.checked || false,
      enableContextMenu: document.getElementById('enableContextMenu')?.checked !== false,
      enableShortcut: document.getElementById('enableShortcut')?.checked !== false,
      enableScreenshot: document.getElementById('enableScreenshot')?.checked !== false,
      enableFullPage: document.getElementById('enableFullPage')?.checked !== false,
      enableTTS: document.getElementById('enableTTS')?.checked !== false,
      maxTranslations: parseInt(document.getElementById('maxTranslations')?.value) || 5000
    };

    chrome.storage.sync.set(settings, function() { 
      showToast('设置已保存'); 
      console.log('[Selection Translator] Settings saved:', settings);
      // 更新引擎标签
      updateEngineTags(settings.engineConfigs);
    });
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
  }

  // 引擎选择切换时显示/隐藏配置区域
  document.querySelectorAll('input[name="engine"]').forEach(cb => {
    cb.addEventListener('change', function() {
      const configDiv = document.querySelector(`.engine-config[data-engine="${this.value}"]`);
      if (configDiv) {
        configDiv.classList.toggle('active', this.checked);
      }
    });
  });

  // 清空历史
  document.getElementById('clearHistoryBtn')?.addEventListener('click', function() {
    if (confirm('确定要清空所有翻译历史吗？')) {
      chrome.storage.local.remove('translationHistory', function() {
        showToast('翻译历史已清空');
      });
    }
  });

  // 恢复默认设置
  document.getElementById('resetSettingsBtn')?.addEventListener('click', function() {
    if (confirm('确定要恢复默认设置吗？所有自定义配置将丢失。')) {
      chrome.storage.sync.clear(function() {
        showToast('已恢复默认设置');
        loadSettings();
      });
    }
  });

  // 导出设置
  document.getElementById('exportSettingsBtn')?.addEventListener('click', function() {
    chrome.storage.sync.get(null, function(data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'selection-translator-settings.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('设置已导出');
    });
  });

  // 导入设置
  document.getElementById('importSettingsBtn')?.addEventListener('click', function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(event) {
        try {
          const settings = JSON.parse(event.target.result);
          chrome.storage.sync.set(settings, function() {
            showToast('设置已导入');
            loadSettings();
          });
        } catch (err) {
          showToast('导入失败：文件格式错误');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });

  loadSettings();
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
});
