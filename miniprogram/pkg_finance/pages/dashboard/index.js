const app = getApp();
import api from '../../../services/request';

Page({
    data: {
        stats: {
            today_income_cents: 0,
            today_expense_cents: 0,
            pending_incomes: 0,
            pending_expenses: 0
        },
        dateDesc: '',
        loading: false
    },

    onShow() {
        this.updateDate();
        this.loadData();
    },

    updateDate() {
        const now = new Date();
        const m = now.getMonth() + 1;
        const d = now.getDate();
        // Weekday
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const w = days[now.getDay()];
        this.setData({ dateDesc: `${m}月${d}日 ${w}` });
    },

    async loadData() {
        this.setData({ loading: true });
        try {
            const res = await api.get('/api/v1/base/finance/dashboard_data');
            if (res) {
                this.setData({ stats: res, loading: false });
            }
        } catch (e) {
            console.error(e);
            this.setData({ loading: false });
        }
    },

    navToAudit(e) {
        const type = e.currentTarget.dataset.type;
        // Create audit page placeholder if not exists, but link is correct
        // For now we assume pages are created later
        wx.navigateTo({ url: `/pkg_finance/pages/audit/index?type=${type}` });
    },

    navToLedger() {
        wx.navigateTo({ url: '/pkg_finance/pages/ledger/index' });
    },

    navToBookkeeping() {
        wx.navigateTo({ url: '/pkg_finance/pages/bookkeeping/index' });
    },

    navToInvoice() {
        wx.navigateTo({ url: '/pkg_finance/pages/invoice/index' });
    },

    onPullDownRefresh() {
        this.loadData().then(() => wx.stopPullDownRefresh());
    }
});
