const fs = require('fs');
let content = fs.readFileSync('public/index.html', 'utf8');

const authHtml = `
  <!-- Auth Modal Overlay -->
  <div id="auth-overlay" class="auth-overlay" style="display: none;">
    <div class="auth-card">
      <div class="auth-title">XinNote 智能云空间</div>
      <div class="auth-subtitle">全栈升级 v5.0 • 灵感无处不在</div>
      <div id="auth-error" class="auth-error">用户名或密码错误</div>
      <form id="auth-form" onsubmit="return false;">
        <div class="auth-input-group">
          <label>用户名</label>
          <input type="text" id="auth-username" class="auth-input" placeholder="输入您的用户名" required autocomplete="username">
        </div>
        <div class="auth-input-group" style="margin-bottom: 24px;">
          <label>密码</label>
          <input type="password" id="auth-password" class="auth-input" placeholder="输入您的密码" required autocomplete="current-password">
        </div>
        <button type="submit" id="btn-auth-submit" class="auth-btn">立即登录</button>
      </form>
      <div class="auth-toggle">
        还没有账号？ <span id="btn-auth-toggle">立即注册</span>
      </div>
    </div>
  </div>
`;

content = content.replace('<body>', '<body>' + authHtml);
fs.writeFileSync('public/index.html', content);
console.log('Injected Auth HTML into index.html');
