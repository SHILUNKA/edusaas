// pkg_customer/pages/profile/participants/index.js
const CustomerService = require('../../../../services/CustomerService');

Page({
  data: {
    participants: [],
    loading: true
  },

  onLoad() {
    this.loadParticipants();
  },

  async loadParticipants() {
    this.setData({ loading: true });
    try {
      const result = await CustomerService.getProfile();
      this.setData({
        participants: (result.customer && result.customer.participants) || [],
        loading: false
      });
    } catch (err) {
      console.error('加载学员失败:', err);
      wx.showToast({ title: '加载学员失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onAdd() {
    wx.navigateTo({
      url: './add/index'
    });
  },

  onEdit(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `./add/index?id=${id}`
    });
  },

  onPullDownRefresh() {
    this.loadParticipants().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});
