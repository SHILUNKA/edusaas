const app = getApp();
import api from '../../../../services/request';

Page({
    data: {
        currentTab: 'revenue',
        chartData: null,
        loading: false,
        maxData: 100,
        updatedTime: ''
    },

    onLoad() {
        this.loadData('revenue');
    },

    switchTab(e) {
        const tab = e.currentTarget.dataset.tab;
        if (tab !== this.data.currentTab) {
            this.setData({ currentTab: tab, chartData: null });
            this.loadData(tab);
        }
    },

    async loadData(dimension) {
        this.setData({ loading: true });
        try {
            const res = await api.get('/api/v1/base/report/stats', { dimension });
            if (res) {
                // Calculate max for chart scaling
                let max = 0;
                if (res.datasets && res.datasets[0] && res.datasets[0].data) {
                    max = Math.max(...res.datasets[0].data) || 100;
                }

                const now = new Date();
                const timeStr = `${now.getHours()}:${now.getMinutes() < 10 ? '0' + now.getMinutes() : now.getMinutes()}`;

                this.setData({
                    chartData: res,
                    maxData: max * 1.2, // add padding
                    loading: false,
                    updatedTime: timeStr
                });
            }
        } catch (err) {
            console.error(err);
            this.setData({ loading: false });
        }
    },

    onPullDownRefresh() {
        this.loadData(this.data.currentTab).then(() => wx.stopPullDownRefresh());
    }
});
