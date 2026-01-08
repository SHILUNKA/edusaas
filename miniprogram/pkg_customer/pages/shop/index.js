// pkg_customer/pages/shop/index.js
const CustomerService = require('../../../services/CustomerService');

Page({
  data: {
    tiers: [],
    loading: true,
    banners: [
      { image: '/images/shop-banner.png', title: '会员特惠' }
    ]
  },

  onLoad() {
    this.loadProducts();
  },

  async loadProducts() {
    this.setData({ loading: true });
    try {
      const tiers = await CustomerService.getMembershipTiers();
      this.setData({
        tiers: tiers || [],
        loading: false
      });
    } catch (err) {
      console.error('加载商品失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onBuy(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '预约咨询',
      content: '目前仅支持线下签约，是否拨打基地电话咨询？',
      success: (res) => {
        if (res.confirm) {
          wx.makePhoneCall({
            phoneNumber: '0571-XXXXXXXX' // 哑巴湖基地电话
          });
        }
      }
    });
  },

  onPullDownRefresh() {
    this.loadProducts().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});
