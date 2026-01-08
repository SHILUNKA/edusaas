import StaffService from '../../../../services/StaffService';

Page({
    data: {
        riskStats: {
            healthScore: 0,
            alerts: []
        },
        keyPersonnel: [],
        currentRankTab: 'purchase', // purchase | activity
        purchaseRankings: [],
        activityRankings: [],
        loading: true
    },

    onLoad() {
        this.loadData();
    },

    async loadData() {
        try {
            wx.showLoading({ title: '加载中...' });

            // Load risk stats
            const riskStats = await StaffService.getRiskStats();

            // Load key personnel
            const keyPersonnel = await StaffService.getKeyPersonnel();

            // Load both rankings
            const purchaseRankings = await StaffService.getPurchaseRankings();
            const activityRankings = await StaffService.getActivityRankings();

            this.setData({
                riskStats: {
                    healthScore: riskStats.health_score || 0,
                    alerts: riskStats.alerts || []
                },
                keyPersonnel: keyPersonnel || [],
                purchaseRankings: purchaseRankings || [],
                activityRankings: activityRankings || [],
                loading: false
            });

        } catch (err) {
            console.error('加载数据失败', err);
            wx.showToast({
                title: '加载失败',
                icon: 'none'
            });
            this.setData({ loading: false });
        } finally {
            wx.hideLoading();
        }
    },


    onTabChange(e) {
        const tab = e.currentTarget.dataset.tab;
        this.setData({ currentRankTab: tab });
    },

    onAddPrincipal() {
        // Navigate to Base List to select a base and then appoint principal
        wx.navigateTo({
            url: '/pkg_hq/pages/base/list/index'
        });
    }
});
