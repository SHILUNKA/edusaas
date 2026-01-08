// pkg_customer/pages/honor/badges/index.js
Page({
  data: {
    participant_id: '',
    loading: true,
    badges: [],
    unlockedCount: 0,
    totalCount: 0
  },

  onLoad(options) {
    const { participant_id } = options;
    if (participant_id) {
      this.setData({ participant_id });
      this.loadBadges();
    }
  },

  async loadBadges() {
    try {
      wx.showLoading({ title: '加载中...' });

      // TODO: 调用实际API
      // const result = await CustomerService.getBadges(this.data.participant_id);

      // 模拟数据
      const badges = [
        {
          id: '1',
          name: '出勤达人',
          description: '连续出勤30天',
          icon_url: '🎯',
          unlocked: true,
          unlocked_at: '2026-01-01',
          progress: { current: 30, target: 30 }
        },
        {
          id: '2',
          name: '作业小能手',
          description: '完成20次优秀作业',
          icon_url: '📝',
          unlocked: true,
          unlocked_at: '2025-12-15',
          progress: { current: 20, target: 20 }
        },
        {
          id: '3',
          name: '百发百中',
          description: '作业100%优秀',
          icon_url: '🎖️',
          unlocked: false,
          progress: { current: 15, target: 20 }
        },
        {
          id: '4',
          name: '火箭速度',
          description: '快速升级到下士',
          icon_url: '🚀',
          unlocked: false,
          progress: { current: 0, target: 1 }
        },
        {
          id: '5',
          name: '明星学员',
          description: '获得老师表扬20次',
          icon_url: '⭐',
          unlocked: false,
          progress: { current: 8, target: 20 }
        }
      ];

      const unlockedCount = badges.filter(b => b.unlocked).length;

      this.setData({
        badges,
        unlockedCount,
        totalCount: badges.length,
        loading: false
      });
    } catch (error) {
      console.error('Failed to load badges:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 查看勋章详情
   */
  onBadgeTap(e) {
    const { badge } = e.currentTarget.dataset;

    wx.showModal({
      title: badge.name,
      content: `${badge.description}\n\n${badge.unlocked ? `获得时间: ${badge.unlocked_at}` : `进度: ${badge.progress.current}/${badge.progress.target}`}`,
      showCancel: false
    });
  }
});
