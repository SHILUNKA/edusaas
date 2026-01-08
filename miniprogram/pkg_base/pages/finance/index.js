const app = getApp();
import api from '../../../services/request';

Page({
    data: {
        summary: {
            today_income_cents: 0,
            month_income_cents: 0,
            month_expense_cents: 0,
            recent_transactions: []
        },
        loading: false
    },

    onShow() {
        this.loadData();
    },

    async loadData() {
        try {
            const res = await api.get('/api/v1/base/finance/summary');
            if (res) {
                // Simple date formatting
                if (res.recent_transactions) {
                    res.recent_transactions.forEach(t => {
                        if (t.created_at && t.created_at.length > 16) {
                            t.created_at = t.created_at.substring(5, 16).replace('T', ' ');
                        }
                    });
                }
                this.setData({ summary: res });
            }
        } catch (e) {
            console.error(e);
            // wx.showToast({ title: '加载失败', icon: 'none' });
        }
    },

    onPullDownRefresh() {
        this.loadData().then(() => wx.stopPullDownRefresh());
    }
});
