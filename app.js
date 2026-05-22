// js/app.js
import { GitHubClient } from './github.js';
import { ToolRunner } from './tool-runner.js';

// تهيئة التطبيق
class DevPulseApp {
  constructor() {
    this.github = null;
    this.toolRunner = new ToolRunner('tool-runner');
    this.installedTools = JSON.parse(localStorage.getItem('installed-tools') || '[]');
    
    this.init();
  }

  init() {
    // ربط الأحداث
    document.getElementById('connect-btn').onclick = () => this.connectGitHub();
    document.getElementById('add-tool-btn').onclick = () => this.addNewTool();
    document.getElementById('close-tool').onclick = () => this.toolRunner.close();
    
    // تحميل الأدوات المثبتة
    this.renderInstalledTools();
    
    // تحميل الفيد إذا كان متصل
    const token = localStorage.getItem('github-token');
    if (token) {
      this.github = new GitHubClient(token);
      this.loadFeed();
    }
  }

  async connectGitHub() {
    const username = document.getElementById('github-username').value.trim();
    const token = document.getElementById('github-token').value.trim();
    
    if (!username || !token) {
      alert('⚠️ من فضلك أدخل اسم المستخدم والـ Token');
      return;
    }

    // حفظ محليًا (في تطبيق حقيقي نستخدم OAuth)
    localStorage.setItem('github-username', username);
    localStorage.setItem('github-token', token);
    
    this.github = new GitHubClient(token);
    alert('✅ تم الربط بنجاح!');
    this.loadFeed();
  }

  async loadFeed() {
    const feedEl = document.getElementById('feed-items');
    feedEl.innerHTML = '🔄 جاري التحميل...';
    
    // مثال: جلب مناقشات من ريبو تجريبي
    // في التطبيق الحقيقي: نجلب من ريبوز المستخدمين
    const discussions = await this.github.fetchDiscussions('devpulse', 'community');
    
    if (discussions.length === 0) {
      feedEl.innerHTML = '📭 لا توجد منشورات بعد. كن أول من ينشر!';
      return;
    }
    
    feedEl.innerHTML = discussions.map(disc => `
      <article class="feed-item">
        <h4><a href="${disc.url}" target="_blank">${disc.title}</a></h4>
        <p>${disc.body.substring(0, 200)}...</p>
        <small>بواسطة @${disc.author.login} • ${new Date(disc.createdAt).toLocaleDateString('ar-EG')}</small>
      </article>
    `).join('');
  }

  async addNewTool() {
    const repoUrl = prompt('أدخل رابط الريبو الذي يحتوي على pulse-app.json:\nمثال: https://github.com/user/repo');
    if (!repoUrl) return;
    
    // استخراج owner/repo من الرابط
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      alert('❌ رابط غير صحيح');
      return;
    }
    
    const [, owner, repo] = match;
    const manifest = await this.github.fetchToolManifest(owner, repo);
    
    if (!manifest) {
      alert('❌ لم يتم العثور على pulse-app.json في هذا الريبو');
      return;
    }
    
    // عرض تفاصيل الأداة للتأكيد
    const confirmed = confirm(
      `🔧 إضافة أداة جديدة:\n\n` +
      `الاسم: ${manifest.name}\n` +
      `الوصف: ${manifest.description}\n` +
      `الصلاحيات المطلوبة: ${manifest.permissions?.join(', ') || 'لا يوجد'}\n\n` +
      `هل توافق على إضافة هذه الأداة؟`
    );
    
    if (confirmed) {
      // حفظ الصلاحيات إذا وافق المستخدم
      if (manifest.permissions?.length) {
        const granted = JSON.parse(localStorage.getItem('granted-permissions') || '[]');
        manifest.permissions.forEach(p => {
          if (!granted.includes(p)) granted.push(p);
        });
        localStorage.setItem('granted-permissions', JSON.stringify(granted));
      }
      
      // إضافة للأدوات المثبتة
      const tool = {
        id: `${owner}/${repo}`,
        ...manifest,
        installedAt: new Date().toISOString()
      };
      
      this.installedTools.push(tool);
      localStorage.setItem('installed-tools', JSON.stringify(this.installedTools));
      
      this.renderInstalledTools();
      alert('✅ تمت إضافة الأداة بنجاح! ستجدها في السايدبار.');
    }
  }

  renderInstalledTools() {
    const listEl = document.getElementById('installed-tools-list');
    
    if (this.installedTools.length === 0) {
      listEl.innerHTML = '<p class="empty">لا توجد أدوات مثبتة بعد</p>';
      return;
    }
    
    listEl.innerHTML = this.installedTools.map(tool => `
      <div class="tool-item" data-id="${tool.id}">
        <strong>${tool.name}</strong>
        <p>${tool.description}</p>
        <div class="tool-actions">
          <button class="run-btn" data-manifest='${JSON.stringify(tool)}'>🚀 تشغيل</button>
          <button class="remove-btn">🗑️ إزالة</button>
        </div>
      </div>
    `).join('');
    
    // ربط أحداث التشغيل والإزالة
    listEl.querySelectorAll('.run-btn').forEach(btn => {
      btn.onclick = (e) => {
        const manifest = JSON.parse(e.currentTarget.dataset.manifest);
        this.toolRunner.loadTool(manifest);
      };
    });
    
    listEl.querySelectorAll('.remove-btn').forEach(btn => {
      btn.onclick = (e) => {
        const toolId = e.currentTarget.closest('.tool-item').dataset.id;
        this.installedTools = this.installedTools.filter(t => t.id !== toolId);
        localStorage.setItem('installed-tools', JSON.stringify(this.installedTools));
        this.renderInstalledTools();
      };
    });
  }
}

// بدء التطبيق عند التحميل
document.addEventListener('DOMContentLoaded', () => {
  new DevPulseApp();
});