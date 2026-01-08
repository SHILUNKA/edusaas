// pkg_customer/pages/honor/index.js
const CustomerService = require('../../../services/CustomerService');

Page({
    data: {
        loading: true,
        participant_id: '',
        honorInfo: null,
        tabs: ['荣誉', '积分明细', '勋章', '排行榜'],
        activeTab: 0
    },

    onLoad(options) {
        const { participant_id } = options;
        if (participant_id) {
            this.setData({ participant_id });
            this.loadHonorInfo();
        }
    },

    async loadHonorInfo() {
        try {
            wx.showLoading({ title: '加载中...' });
            const result = await CustomerService.getHonor(this.data.participant_id);
            this.setData({
                honorInfo: result,
                loading: false
            });
        } catch (error) {
            console.error('Failed to load honor info:', error);
            wx.showToast({
                title: '加载失败',
                icon: 'none'
            });
        } finally {
            wx.hideLoading();
        }
    },

    /**
     * 切换Tab
     */
    onTabChange(e) {
        const { index } = e.currentTarget.dataset;
        this.setData({ activeTab: index });

        // 根据tab加载不同内容
        if (index === 1) {
            // 积分明细
            wx.navigateTo({
                url: `/pkg_customer/pages/honor/points-detail/index?participant_id=${this.data.participant_id}`
            });
        } else if (index === 2) {
            // 勋章墙
            wx.navigateTo({
                url: `/pkg_customer/pages/honor/badges/index?participant_id=${this.data.participant_id}`
            });
        } else if (index === 3) {
            // 排行榜
            wx.navigateTo({
                url: `/pkg_customer/pages/honor/leaderboard/index?participant_id=${this.data.participant_id}`
            });
        }
    },

    navToReport() {
        wx.navigateTo({
            url: `/pkg_customer/pages/report/index?participant_id=${this.data.participant_id}`
        });
    }
});
