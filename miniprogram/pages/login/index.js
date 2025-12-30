import { userStore } from '../../store/userStore';
import AuthService from '../../services/AuthService';

Page({
  data: {
    email: '',
    password: '',
    loading: false
  },

  onEmailInput(e) {
    this.setData({ email: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  async handleLogin() {
    const { email, password } = this.data;
    if (!email || !password) {
      wx.showToast({ title: '请输入账号密码', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      await AuthService.login(email, password);
      // Login success adds its own route logic in AuthService
    } catch (err) {
      wx.showToast({
        title: err.message || '登录失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  clearCache() {
    userStore.logout();
    wx.showToast({ title: '已重置', icon: 'none' });
    this.setData({ email: '', password: '' });
  }
})