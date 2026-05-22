// GitHub API Client
class GitHubClient {
  constructor(token) {
    this.token = token;
    this.baseURL = 'https://api.github.com';
    this.headers = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    };
  }

  // جلب ملف pulse-app.json
  async fetchToolManifest(owner, repo, branch = 'main') {
    try {
      const response = await fetch(
        `${this.baseURL}/repos/${owner}/${repo}/contents/pulse-app.json?ref=${branch}`,
        { headers: this.headers }
      );
      
      if (!response.ok) {
        throw new Error('ملف pulse-app.json غير موجود');
      }
      
      const data = await response.json();
      const content = atob(data.content);
      return JSON.parse(content);
    } catch (error) {
      console.error('خطأ في جلب manifest:', error);
      return null;
    }
  }

  // جلب المناقشات من مستودع
  async fetchDiscussions(owner, repo, limit = 10) {
    try {
      const query = `
        query($owner: String!, $repo: String!, $first: Int!) {
          repository(owner: $owner, name: $repo) {
            discussions(first: $first, orderBy: {field: UPDATED_AT, direction: DESC}) {
              nodes {
                title
                body
                url
                createdAt
                author { login }
                comments(first: 0) { totalCount }
              }
            }
          }
        }
      `;
      
      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          query,
          variables: { owner, repo, first: limit }
        })
      });
      
      const json = await response.json();
      return json.data?.repository?.discussions?.nodes || [];
    } catch (error) {
      console.error('خطأ في جلب المناقشات:', error);
      return [];
    }
  }

  // جلب معلومات المستخدم
  async getUserInfo(username) {
    try {
      const response = await fetch(
        `${this.baseURL}/users/${username}`,
        { headers: this.headers }
      );
      return await response.json();
    } catch (error) {
      console.error('خطأ في جلب معلومات المستخدم:', error);
      return null;
    }
  }
}

// Tool Runner
class ToolRunner {
  constructor() {
    this.section = document.getElementById('tool-runner-section');
    this.iframe = document.getElementById('tool-iframe');
    this.nameEl = document.getElementById('tool-name');
    this.closeBtn = document.getElementById('close-tool-btn');
    
    this.closeBtn.addEventListener('click', () => this.close());
  }

  load(manifest, params = {}) {
    return new Promise((resolve, reject) => {
      // التحقق من الصلاحيات
      if (!this.checkPermissions(manifest.permissions || [])) {
        reject(new Error('الأداة تطلب صلاحيات لم توافق عليها'));
        return;
      }

      this.nameEl.textContent = manifest.name;
      
      // بناء الرابط
      const url = new URL(manifest.entry);
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });

      // إعداد الـ iframe
      this.iframe.sandbox = this.buildSandbox(manifest.permissions || []);
      this.iframe.src = url.toString();
      
      this.iframe.onload = () => {
        this.section.style.display = 'block';
        this.section.scrollIntoView({ behavior: 'smooth' });
        resolve();
      };
      
      this.iframe.onerror = () => reject(new Error('فشل تحميل الأداة'));
    });
  }

  buildSandbox(permissions) {
    const tokens = [
      'allow-scripts',
      'allow-forms',
      'allow-same-origin',
      'allow-popups-to-escape-sandbox'
    ];
    
    if (permissions.includes('download')) {
      tokens.push('allow-downloads');
    }
    if (permissions.includes('clipboard')) {
      tokens.push('allow-modals');
    }
    
    return tokens.join(' ');
  }

  checkPermissions(required) {
    if (!required.length) return true;
    
    const granted = JSON.parse(localStorage.getItem('granted-permissions') || '[]');
    return required.every(p => granted.includes(p));
  }

  close() {
    this.section.style.display = 'none';
    this.iframe.src = 'about:blank';
  }
}

// التطبيق الرئيسي
class DevPulseApp {
  constructor() {
    this.github = null;
    this.toolRunner = new ToolRunner();
    this.tools = JSON.parse(localStorage.getItem('installed-tools') || '[]');
    this.currentUser = null;
    
    this.init();
  }

  init() {
    // ربط الأحداث
    document.getElementById('connect-btn').addEventListener('click', () => this.connectGitHub());
    document.getElementById('logout-btn').addEventListener('click', () => this.logout());
    document.getElementById('add-tool-btn').addEventListener('click', () => this.showAddToolModal());
    document.getElementById('close-modal-btn').addEventListener('click', () => this.hideAddToolModal());
    document.getElementById('confirm-add-tool').addEventListener('click', () => this.addTool());
    
    // إغلاق النافذة عند النقر خارجها
    document.getElementById('add-tool-modal').addEventListener('click', (e) => {
      if (e.target.id === 'add-tool-modal') {
        this.hideAddToolModal();
      }
    });

    // التحقق من وجود اتصال محفوظ
    const savedToken = localStorage.getItem('github-token');
    const savedUsername = localStorage.getItem('github-username');
    
    if (savedToken && savedUsername) {
      this.github = new GitHubClient(savedToken);
      this.currentUser = savedUsername;
      this.showLoggedInUI(savedUsername);
      this.loadFeed();
    }
    
    this.renderTools();
  }

  async connectGitHub() {
    const username = document.getElementById('github-username').value.trim();
    const token = document.getElementById('github-token').value.trim();
    
    if (!username || !token) {
      alert('⚠️ الرجاء إدخال اسم المستخدم والـ Token');
      return;
    }

    // اختبار الاتصال
    const client = new GitHubClient(token);
    const userInfo = await client.getUserInfo(username);
    
    if (!userInfo) {
      alert('❌ فشل الاتصال. تأكد من صحة البيانات');
      return;
    }

    // حفظ البيانات
    localStorage.setItem('github-token', token);
    localStorage.setItem('github-username', username);
    
    this.github = client;
    this.currentUser = username;
    this.showLoggedInUI(username);
    this.loadFeed();
    
    // مسح الحقول
    document.getElementById('github-username').value = '';
    document.getElementById('github-token').value = '';
  }

  showLoggedInUI(username) {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('user-info').style.display = 'flex';
    document.getElementById('user-name').textContent = `👤 ${username}`;
    document.getElementById('welcome-section').style.display = 'none';
    document.getElementById('feed-section').style.display = 'block';
  }

  logout() {
    localStorage.removeItem('github-token');
    localStorage.removeItem('github-username');
    location.reload();
  }

  async loadFeed() {
    const container = document.getElementById('feed-container');
    container.innerHTML = '<div class="loading">جاري جلب البيانات من مستودع جيت هب...</div>';
    
    // جلب مناقشات من مستودع المجتمع (يمكن تغييره)
    const discussions = await this.github.fetchDiscussions('pythouz', 'devpulse', 10);
    
    if (discussions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>📭 لا توجد منشورات بعد</p>
          <p class="text-secondary">كن أول من ينشر في المجتمع!</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = discussions.map(disc => `
      <article class="feed-item">
        <h3><a href="${disc.url}" target="_blank">${this.escapeHtml(disc.title)}</a></h3>
        <p>${this.escapeHtml(disc.body.substring(0, 200))}${disc.body.length > 200 ? '...' : ''}</p>
        <div class="meta">
          <span>👤 @${this.escapeHtml(disc.author.login)}</span>
          <span>📅 ${new Date(disc.createdAt).toLocaleDateString('ar-EG')}</span>
          <span>💬 ${disc.comments.totalCount} تعليق</span>
        </div>
      </article>
    `).join('');
  }

  showAddToolModal() {
    document.getElementById('add-tool-modal').classList.add('active');
    document.getElementById('repo-url').focus();
  }

  hideAddToolModal() {
    document.getElementById('add-tool-modal').classList.remove('active');
    document.getElementById('repo-url').value = '';
  }

  async addTool() {
    const repoUrl = document.getElementById('repo-url').value.trim();
    
    if (!repoUrl) {
      alert('⚠️ الرجاء إدخال رابط المستودع');
      return;
    }
    
    // استخراج owner/repo من الرابط
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      alert('❌ رابط غير صحيح. الصيغة الصحيحة: https://github.com/user/repo');
      return;
    }
    
    const [, owner, repo] = match;
    const manifest = await this.github.fetchToolManifest(owner, repo);
    
    if (!manifest) {
      alert('❌ لم يتم العثور على pulse-app.json في هذا المستودع');
      return;
    }
    
    // عرض التفاصيل للتأكيد
    const confirmed = confirm(
      `🔧 إضافة أداة جديدة:\n\n` +
      `الاسم: ${manifest.name}\n` +
      `الوصف: ${manifest.description}\n` +
      `الصلاحيات: ${(manifest.permissions || []).join(', ') || 'لا يوجد'}\n\n` +
      `هل توافق على الإضافة؟`
    );
    
    if (!confirmed) return;
    
    // حفظ الصلاحيات
    if (manifest.permissions?.length) {
      const granted = JSON.parse(localStorage.getItem('granted-permissions') || '[]');
      manifest.permissions.forEach(p => {
        if (!granted.includes(p)) granted.push(p);
      });
      localStorage.setItem('granted-permissions', JSON.stringify(granted));
    }
    
    // إضافة الأداة
    const tool = {
      id: `${owner}/${repo}`,
      ...manifest,
      installedAt: new Date().toISOString()
    };
    
    if (!this.tools.find(t => t.id === tool.id)) {
      this.tools.push(tool);
      localStorage.setItem('installed-tools', JSON.stringify(this.tools));
      this.renderTools();
      
      alert('✅ تمت إضافة الأداة بنجاح!');
      this.hideAddToolModal();
    } else {
      alert('⚠️ الأداة مثبتة بالفعل');
    }
  }

  renderTools() {
    const container = document.getElementById('tools-list');
    const countEl = document.getElementById('tools-count');
    
    countEl.textContent = this.tools.length;
    
    if (this.tools.length === 0) {
      container.innerHTML = '<p class="empty-message">لا توجد أدوات مثبتة</p>';
      return;
    }
    
    container.innerHTML = this.tools.map(tool => `
      <div class="tool-item" data-id="${tool.id}">
        <h4>${this.escapeHtml(tool.name)}</h4>
        <p>${this.escapeHtml(tool.description)}</p>
      </div>
    `).join('');
    
    // ربط الأحداث
    container.querySelectorAll('.tool-item').forEach(item => {
      item.addEventListener('click', () => {
        const tool = this.tools.find(t => t.id === item.dataset.id);
        if (tool) {
          this.toolRunner.load(tool);
        }
      });
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// بدء التطبيق
document.addEventListener('DOMContentLoaded', () => {
  new DevPulseApp();
});
