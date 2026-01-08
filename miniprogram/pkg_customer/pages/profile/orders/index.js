// pkg_customer/pages/profile/orders/index.js
const CustomerService = require('../../../../services/CustomerService');

Page({
  data: {
    orders: [],
    loading: true,
    tabs: ['全部', '待付款', '已支付', '已完成', '已取消'],
    activeTab: 0
  },

  onLoad() {
    this.loadOrders();
  },

  async loadOrders() {
    this.setData({ loading: true });
    try {
      const orders = await CustomerService.getOrders();
      this.setData({
        orders: orders || [],
        loading: false
      });
    } catch (err) {
      console.error('加载订单失败:', err);
      wx.showToast({ title: '加载订单失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onTabChange(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({ activeTab: index });
    // TODO: 根据状态过滤
  },

  onOrderDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `./detail/index?id=${id}`
    });
  },

  onPullDownRefresh() {
    this.loadOrders().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});
