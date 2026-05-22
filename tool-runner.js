// js/tool-runner.js
export class ToolRunner {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.iframe = this.container.querySelector('iframe');
    this.titleEl = this.container.querySelector('#tool-title');
  }

  // تشغيل أداة بناءً على маниفست
  loadTool(manifest, params = {}) {
    return new Promise((resolve, reject) => {
      // التحقق من الصلاحيات المطلوبة
      if (!this.checkPermissions(manifest.permissions)) {
        return reject(new Error('الأداة تطلب صلاحيات لم توافق عليها'));
      }

      // تحديث العنوان
      this.titleEl.textContent = manifest.name;
      
      // بناء الرابط مع البارامترز
      const url = new URL(manifest.entry);
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });

      // إعداد الـ iframe بأمان
      this.iframe.sandbox = this.buildSandboxToken(manifest.permissions);
      this.iframe.src = url.toString();
      
      this.iframe.onload = () => {
        this.container.hidden = false;
        resolve();
      };
      this.iframe.onerror = () => reject(new Error('فشل تحميل الأداة'));
    });
  }

  // بناء توكن الـ sandbox بناءً على الصلاحيات
  buildSandboxToken(permissions) {
    const base = [
      'allow-scripts',
      'allow-forms',
      'allow-same-origin',
      'allow-popups-to-escape-sandbox'
    ];
    
    if (permissions?.includes('download')) base.push('allow-downloads');
    if (permissions?.includes('clipboard')) base.push('allow-modals'); // للـ clipboard API
    
    return base.join(' ');
  }

  // التحقق من موافقة المستخدم على الصلاحيات
  checkPermissions(required) {
    if (!required?.length) return true;
    
    const granted = JSON.parse(localStorage.getItem('granted-permissions') || '[]');
    return required.every(p => granted.includes(p));
  }

  close() {
    this.container.hidden = true;
    this.iframe.src = 'about:blank';
  }
}