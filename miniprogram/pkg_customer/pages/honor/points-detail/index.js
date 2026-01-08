// pkg_customer/pages/honor/points-detail/index.js
const CustomerService = require('../../../../services/CustomerService');

Page({
  data: {
    participant_id: '',
    loading: true,
    records: [],
    totalPoints: 0,
    page: 1,
    hasMore: true,
    categories: {
      attendance: '出勤',
      homework: '作业',
      competition: '比赛',
      activity: '活动',
      other: '其他'
    }
  },

  onLoad(options) {
    const { participant_id } = options;
    if (participant_id) {
      this.setData({ participant_id });
      this.loadPointsHistory();
    }
  },

  async loadPointsHistory() {
    if (!this.data.hasMore) return;

    try {
      this.setData({ loading: true });
      const result = await CustomerService.getPointsHistory({
        participant_id: this.data.participant_id,
        page: this.data.page,
        limit: 20
      });

      const newRecords = this.data.page === 1 ? result.records : [...this.data.records, ...result.records];

      this.setData({
        records: newRecords,
        totalPoints: result.total,
        hasMore: this.data.page < result.total_pages,
        loading: false
      });
    } catch (error) {
      console.error('Failed to load points history:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  /**
   * 加载更多
   */
  onLoadMore() {
    if (this.data.loading || !this.data.hasMore) return;

    this.setData({
      page: this.data.page + 1
    });
    this.loadPointsHistory();
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true });
    await this.loadPointsHistory();
    wx.stopPullDownRefresh();
  },

  /**
   * 格式化日期
   */
  formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;

    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
});
