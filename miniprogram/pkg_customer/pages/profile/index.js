// pkg_customer/pages/profile/index.js
const CustomerService = require('../../../services/CustomerService');

Page({
  data: {
    loading: true,
    customer: null,
    menuItems: [
      { icon: '👥', title: '学员管理', url: '/pkg_customer/pages/profile/participants/index' },
      { icon: '📋', title: '我的订单', url: '/pkg_customer/pages/profile/orders/index' },
      { icon: '📍', title: '收货地址', url: '/pkg_customer/pages/profile/addresses/index' },
      { icon: '🧾', title: '发票管理', url: '/pkg_customer/pages/profile/invoice/index' },
      { icon: '⚙️', title: '设置', url: '/pkg_customer/pages/profile/settings/index' }
    ]
  },

  onLoad() {
    this.loadProfile();
  },

  onShow() {
    if (this.data.customer) {
      this.loadProfile();
    }
  },

  async loadProfile() {
    try {
      wx.showLoading({ title: '加载中...' });
      const result = await CustomerService.getProfile();

      this.setData({
        customer: result.customer,
        loading: false
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 菜单项点击
   */
  onMenuTap(e) {
    const { url } = e.currentTarget.dataset;
    if (url) {
      wx.navigateTo({ url });
    }
  },

  /**
   * 退出登录
   */
  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除登录信息
          wx.removeStorageSync('token');
          wx.reLaunch({
            url: '/pages/login/index'
          });
        }
      }
    });
  }
});
