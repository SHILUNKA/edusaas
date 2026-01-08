// services/AuthService.js

import { userStore } from '../store/userStore';

/**
 * 配置角色与首页路径的映射关系
 * Key 必须与后端返回的角色标识（存在 userStore.role）保持一致
 */
const ROLE_HOME_MAP = {
  'HQ': '/pkg_hq/dashboard/index',       // 总部视角
  'BASE': '/pkg_base/pages/dashboard/index',   // 校区校长视角
  'BASE_FINANCE': '/pkg_finance/pages/dashboard/index', // 校区财务视角
  'BASE_TEACHER': '/pkg_teacher/pages/dashboard/index', // 老师/销售视角
  'CONSUMER': '/pkg_customer/home/index' // C端视角
};

// 默认跳转页面（当角色无法识别时作为兜底）
const DEFAULT_HOME_PATH = ROLE_HOME_MAP['CONSUMER'];


class AuthService {
  /**
   * 登录接口
   * @param {String} email 
   * @param {String} password 
   */
  async login(email, password) {
    const request = require('./request').default; // Circular dependency handling
    try {
      const res = await request.post('/api/v1/auth/login', { email, password });
      const { token } = res;

      if (!token) throw new Error('Token missing');

      // 解析 Token 获取角色
      const claims = this._parseToken(token);
      console.log('📝 [AuthService] Token Claims:', claims);

      // 映射角色 (后端 role.hq.xxx -> 前端 HQ)
      const frontendRole = this._mapBackendRoleToFrontend(claims.roles || []);

      // 构造用户信息对象 (从 JWT Claims 中提取)
      const userInfo = {
        id: claims.sub,
        hq_id: claims.hq_id,
        base_id: claims.base_id,
        name: claims.full_name || '用户',
      };

      // 存入 Store
      userStore.setLoginSuccess(token, userInfo, frontendRole);

      // 初始化路由
      this.initAppRoute();

      return true;
    } catch (err) {
      console.error('Login Failed:', err);
      throw err;
    }
  }

  /**
   * 解析 JWT Token (Base64Url -> JSON)
   */
  _parseToken(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonStr = this._b64DecodeUnicode(base64);
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('Token Parse Error:', e);
      return {};
    }
  }

  _b64DecodeUnicode(str) {
    // 正确处理 UTF-8 编码的 Base64 解码
    // Step 1: Base64 decode
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    str = String(str).replace(/=+$/, '');

    for (let bc = 0, bs = 0, buffer, i = 0; buffer = str.charAt(i++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
      buffer = chars.indexOf(buffer);
    }

    // Step 2: UTF-8 decode (处理中文字符)
    try {
      // 使用 decodeURIComponent + escape 来正确解码 UTF-8
      return decodeURIComponent(escape(output));
    } catch (e) {
      // 如果解码失败，返回原始字符串
      console.warn('UTF-8 decode failed:', e);
      return output;
    }
  }

  _mapBackendRoleToFrontend(roles) {
    // roles is array: ["role.hq.admin", "role.base.finance"]
    if (roles.some(r => r.startsWith('role.hq'))) return 'HQ';

    // 优先匹配具体职能角色
    if (roles.includes('role.base.finance')) return 'BASE_FINANCE';
    if (
      roles.includes('role.base.teacher') ||
      roles.includes('role.base.sales') ||
      roles.includes('role.base.academic') ||
      roles.includes('role.base.hr') ||
      roles.includes('role.teacher')
    ) return 'BASE_TEACHER';

    // 基地管理者
    if (roles.includes('role.base.admin')) return 'BASE';

    // 其他基地角色默认也作为员工处理，防止误入老板看板
    if (roles.some(r => r.startsWith('role.base'))) return 'BASE_TEACHER';

    if (roles.some(r => r.startsWith('role.consumer'))) return 'CONSUMER';
    return 'CONSUMER'; // default
  }

  /**
   * ========================================================
   * 核心方法：初始化应用路由 (Route Dispatcher)
   * ========================================================
   * 功能：
   * 1. 检查用户是否登录 (有无 Token)。
   * 2. 如果没登录 -> 踢到登录页。
   * 3. 如果已登录 -> 读取用户角色 -> 查找映射表 -> 踢到对应的分包首页。
   * * 调用时机：
   * - App 启动时 (app.js onLaunch)
   * - 登录成功后 (login/index.js)
   * - 退出登录后
   */
  initAppRoute() {
    // 1. 从 Store 获取当前状态 (MobX 会自动追踪这些值的变化)
    const token = userStore.token;
    const role = userStore.role;

    console.log('🔍 [AuthService] 开始路由分发 -> Role:', role, 'HasToken:', !!token);

    // 2. 未登录检查
    if (!token) {
      console.log('⚠️ [AuthService] 未登录，准备跳转至登录页');
      this._redirectToLogin();
      return;
    }

    // 3. 已登录，决定跳转目标
    // 根据角色查找对应的首页路径，如果找不到（比如新增加的角色前端还没配），就跳到兜底页面
    let targetUrl = ROLE_HOME_MAP[role];

    if (!targetUrl) {
      console.warn(`⚠️ [AuthService] 未知的角色类型: ${role}, 将跳转至默认首页`);
      targetUrl = DEFAULT_HOME_PATH;
    }

    console.log(`✅ [AuthService] 身份验证通过，跳转至目标门户: ${targetUrl}`);

    // 4. 执行跳转
    // ★★★ 关键点：必须使用 reLaunch ★★★
    // 原因：我们的三大门户是平行的“平行宇宙”，互不隶属。
    // 切换身份时，必须关闭所有旧页面，干干净净地打开新世界的地基。
    wx.reLaunch({
      url: targetUrl,
      fail: (err) => {
        console.error('❌ [AuthService] 页面跳转失败，请检查 app.json 路径配置是否正确:', err);
        // 极其罕见的情况，可能是路径写错了
        wx.showToast({ title: '系统路由异常', icon: 'none' });
      }
    });
  }

  /**
   * 内部私有方法：安全地跳转到登录页
   * 防止在登录页无限循环跳转
   */
  _redirectToLogin() {
    const loginPagePath = 'pages/login/index';
    // 获取当前页面栈
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];

    // 如果当前已经是在登录页了，就别再跳了，否则会报错
    if (currentPage && currentPage.route === loginPagePath) {
      return;
    }

    // 使用 reLaunch 清空页面栈跳到登录页
    wx.reLaunch({ url: `/${loginPagePath}` });
  }

  /**
   * 处理会话过期 (如 API 返回 401)
   * 供将来的 request.js 拦截器调用
   */
  handleSessionExpired() {
    console.warn('🔒 [AuthService] 会话已过期，执行登出操作');
    // 1. 清除 Store 中的 Token 和用户信息
    userStore.logout();
    // 2. 提示用户
    wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
    // 3. 重新运行路由逻辑（这会自动把用户踢回登录页）
    this.initAppRoute();
  }
}

// 导出单例对象，确保全局只有一个 AuthService 实例
export default new AuthService();