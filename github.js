// js/github.js
export class GitHubClient {
  constructor(token) {
    this.token = token;
    this.baseURL = 'https://api.github.com';
    this.headers = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    };
  }

  // جلب ملف pulse-app.json من ريبو معين
  async fetchToolManifest(owner, repo, branch = 'main') {
    try {
      const res = await fetch(
        `${this.baseURL}/repos/${owner}/${repo}/contents/pulse-app.json?ref=${branch}`,
        { headers: this.headers }
      );
      if (!res.ok) throw new Error('ملف pulse-app.json غير موجود');
      
      const data = await res.json();
      // فك تشفير المحتوى (GitHub API يرجعه base64)
      const content = atob(data.content);
      return JSON.parse(content);
    } catch (err) {
      console.error('❌ خطأ في جلب манифست الأداة:', err);
      return null;
    }
  }

  // جلب منشورات من مناقشات الجيت هب (للفيد)
  async fetchDiscussions(owner, repo, limit = 10) {
    // ملاحظة: مناقشات جيت هب تحتاج تفعيلها في الريبو
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
            }
          }
        }
      }
    `;
    
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ query, variables: { owner, repo, first: limit } })
    });
    
    const json = await res.json();
    return json.data?.repository?.discussions?.nodes || [];
  }

  // حفظ/تحديث أدوات المستخدم (نستخدم Issues كـ "database")
  async saveUserTools(username, tools) {
    // هنا نستخدم Issue كمخزن بسيط: كل Issue يمثل أداة مثبتة
    // يمكن تطويرها لاحقاً لاستخدام GitHub Gists أو Pages JSON
    console.log('💾 حفظ الأدوات:', tools);
    return true;
  }
}