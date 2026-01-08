// app.js
const { userStore } = require('./store/userStore');

App({
  globalData: {
    entryParams: null,    // 扫码进入的参数
    systemInfo: null
  },

  onLaunch(options) {
    console.log('App Launch:', options);

    // 🔧 开发模式：自动设置测试token（跳过登录）
    const DEV_MODE_AUTO_LOGIN = true; // 设为false可恢复正常登录流程

    if (DEV_MODE_AUTO_LOGIN) {
      // 使用真实的哑巴湖基地数据
      const YABAHU_BASE_ID = '841e6e10-4507-467e-af42-ebbcff2dbb6e';
      const YABAHU_HQ_ID = 'dc53fe5d-1212-4259-8350-bb443df1717e';

      const testToken = `dev_token_${YABAHU_BASE_ID}`;
      const testUserInfo = {
        id: '02352317-d905-4429-9bc7-577e4907660c', // 李希圣
        name: '李希圣(测试)',
        phone_number: '138****5678',
        base_id: YABAHU_BASE_ID,
        hq_id: YABAHU_HQ_ID
      };

      // 核心：调用 userStore 动作，确保全网同步状态（包括 TabBar）
      if (userStore && userStore.setLoginSuccess) {
        userStore.setLoginSuccess(testToken, testUserInfo, 'CONSUMER');
        console.log('🔧 开发模式：已通过 userStore 自动登录哑巴湖基地');
      } else {
        // 兜底方案
        wx.setStorageSync('token', testToken);
        wx.setStorageSync('userInfo', testUserInfo);
        wx.setStorageSync('role', 'CONSUMER');
        console.log('🔧 开发模式：已通过 Storage 自动登录哑巴湖基地');
      }

      console.log('   基地ID:', YABAHU_BASE_ID);
      console.log('   总部ID:', YABAHU_HQ_ID);
    }

    // 获取系统信息
    this.globalData.systemInfo = wx.getSystemInfoSync();

    // 解析启动参数
    this.parseEntryParams(options);

    // 检查登录状态
    this.checkLoginStatus();
  },

  /**
   * 解析启动参数（扫码场景）
   */
  parseEntryParams(options) {
    // 扫码进入的场景值 (通过 getwxacodeunlimit 生成)
    // 这里的 scene 参数是在 query 对象中的
    if (options.query && options.query.scene) {
      try {
        const params = this.decodeScene(options.query.scene);
        this.globalData.entryParams = params;
        console.log('Entry params:', params);

        // 保存到本地存储
        wx.setStorageSync('entry_params', params);
      } catch (error) {
        console.error('Failed to parse scene:', error);
      }
    }

    // 分享进入或其他带query参数的场景
    if (options.query) {
      this.globalData.entryParams = {
        ...this.globalData.entryParams,
        ...options.query
      };
    }
  },

  /**
   * 解码场景值
   * 格式: b_baseId_c_channel
   */
  decodeScene(scene) {
    if (typeof scene !== 'string') return {};
    const parts = scene.split('_');
    const params = {};

    for (let i = 0; i < parts.length; i += 2) {
      const key = parts[i];
      const value = parts[i + 1];

      if (key === 'b') {
        params.base_id = value;
      } else if (key === 'c') {
        params.channel = value;
      } else if (key === 'h') {
        params.hq_id = value;
      } else if (key === 'r') {
        params.ref_user = value;
      }
    }

    return params;
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    // 🔧 开发模式下跳过登录检查
    const DEV_MODE_AUTO_LOGIN = true;
    if (DEV_MODE_AUTO_LOGIN) {
      console.log('🔧 开发模式：跳过登录状态检查');
      return;
    }

    const token = wx.getStorageSync('token');
    if (!token) {
      console.log('No token found, need login');
      return;
    }

    // TODO: 验证token是否有效
    console.log('Token found:', token.substring(0, 20) + '...');
    // 已登录，尝试刷新用户信息
    try {
      // TODO: 验证token是否有效
      // const userInfo = await request({ url: '/customer/profile', method: 'GET' });
      // userStore.setUser(userInfo);
    } catch (error) {
      console.error('Token invalid:', error);
      // Token失效，清除
      wx.removeStorageSync('token');
    }
  },

  /**
   * 获取扫码参数
   */
  getEntryParams() {
    if (!this.globalData.entryParams) {
      this.globalData.entryParams = wx.getStorageSync('entry_params') || null;
    }
    return this.globalData.entryParams;
  },

  /**
   * 清除扫码参数
   */
  clearEntryParams() {
    this.globalData.entryParams = null;
    wx.removeStorageSync('entry_params');
  }
});