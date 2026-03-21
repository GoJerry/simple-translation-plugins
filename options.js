document.addEventListener('DOMContentLoaded', function() {
  const defaults = {
    targetLang: 'zh', sourceLang: 'auto', triggerMode: 'auto',
    showIcon: true, autoPlay: false, theme: 'light',
    engines: ['google'], // 默认启用Google
    engineConfigs: {},
    enableHistory: true,
    enableHover: true, hoverDelay: 300
  };

  // 所有可用引擎
  const availableEngines = [
    'google', 'mymemory', 'libre', // 免费
    'baidu', 'youdao', 'tencent', 'aliyun', 'microsoft',
    'deepl', 'openai', 'silicon', 'volcengine' // 需密钥
  ];

  function loadSettings() {
    chrome.storage.sync.get(defaults, function(result) {
      document.getElementById('targetLang').value = result.targetLang;
      document.getElementById('sourceLang').value = result.sourceLang;
      document.getElementById('showIcon').checked = result.showIcon;
      document.getElementById('autoPlay').checked = result.autoPlay;
      document.getElementById('enableHistory').checked = result.enableHistory;
      document.getElementById('enableHover').checked = result.enableHover;
      document.getElementById('hoverDelay').value = result.hoverDelay;

      document.querySelectorAll('input[name="triggerMode"]').forEach(r => { 
        r.checked = r.value === result.triggerMode; 
      });
      document.querySelectorAll('input[name="theme"]').forEach(r => { 
        r.checked = r.value === result.theme; 
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
      showIcon: document.getElementById('showIcon').checked,
      autoPlay: document.getElementById('autoPlay').checked,
      enableHistory: document.getElementById('enableHistory').checked,
      enableHover: document.getElementById('enableHover').checked,
      hoverDelay: parseInt(document.getElementById('hoverDelay').value) || 300,
      engines: selectedEngines.length > 0 ? selectedEngines : ['google'],
      engineConfigs: engineConfigs
    };

    chrome.storage.sync.set(settings, function() { 
      showToast('设置已保存'); 
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

  loadSettings();
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
});
