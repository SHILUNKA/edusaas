// pkg_customer/pages/messages/index.js
const CustomerService = require('../../../services/CustomerService');

Page({
  data: {
    messages: [],
    loading: true
  },

  onLoad() {
    this.loadMessages();
  },

  async loadMessages() {
    this.setData({ loading: true });
    try {
      const messages = await CustomerService.getNotices();
      this.setData({
        messages: messages || [],
        loading: false
      });
    } catch (err) {
      console.error('加载消息失败:', err);
      wx.showToast({ title: '加载消息失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onMessageTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `./detail/index?id=${id}`
    });
  },

  onPullDownRefresh() {
    this.loadMessages().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});
