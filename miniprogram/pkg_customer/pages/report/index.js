// pkg_customer/pages/report/index.js
const CustomerService = require('../../../services/CustomerService');

Page({
  data: {
    participantId: '',
    report: null,
    loading: true
  },

  onLoad(options) {
    const { participant_id } = options;
    if (participant_id) {
      this.setData({ participantId: participant_id });
      this.loadReport();
    } else {
      // 如果没有传入ID，尝试加载 profile 获取第一个学员
      this.loadDefaultParticipant();
    }
  },

  async loadDefaultParticipant() {
    try {
      const result = await CustomerService.getProfile();
      if (result.customer && result.customer.participants && result.customer.participants.length > 0) {
        this.setData({ participantId: result.customer.participants[0].id });
        this.loadReport();
      } else {
        this.setData({ loading: false });
      }
    } catch (err) {
      console.error('加载学员失败:', err);
      this.setData({ loading: false });
    }
  },

  async loadReport() {
    this.setData({ loading: true });
    try {
      const report = await CustomerService.getReport(this.data.participantId);
      this.setData({
        report,
        loading: false
      });
    } catch (err) {
      console.error('加载报告失败:', err);
      wx.showToast({ title: '加载报告失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onPullDownRefresh() {
    this.loadReport().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});
