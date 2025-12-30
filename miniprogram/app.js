import request from './services/request';
import { userStore } from './store/userStore';

App({
  onLaunch() {
    // 1. 检查本地是否有 Token
    const token = wx.getStorageSync('token');
    if (token) {
      // 验证 Token 是否过期...
      return;
    }

    // 2. 如果没 Token，尝试静默登录
    wx.login({
      success: async (res) => {
        if (res.code) {
          // 调用你后端的微信登录接口
          try {
            const result = await request.post('/auth/wechat_login', {
              code: res.code,
              role: 'consumer' // 默认为家长端尝试
            });

            if (result.token) {
              // 登录成功！存 Token
              // 使用 setLoginSuccess 替代不存在的 setToken
              userStore.setLoginSuccess(result.token, result.user || {}, result.role || 'consumer');
            }
          } catch (error) {
            console.error('Silent login failed:', error);
          }
          // 如果失败（404），说明没绑定，保持在登录页等待用户手动操作
        }
      }
    });
  }
})