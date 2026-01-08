import request from '../../../services/request';
import { API_BASE_URL } from '../../../config/index';

Page({
    data: {
        currentType: 'expense',
        list: [],
        loading: false
    },

    onShow() {
        this.loadList();
    },

    onPullDownRefresh() {
        this.loadList().then(() => wx.stopPullDownRefresh());
    },

    switchTab(e) {
        const type = e.currentTarget.dataset.type;
        if (type !== this.data.currentType) {
            this.setData({ currentType: type, list: [] });
            this.loadList();
        }
    },

    async loadList() {
        this.setData({ loading: true });
        try {
            const res = await request.get(`/api/v1/base/approval/list?type=${this.data.currentType}`);
            const list = (res || []).map(item => ({
                ...item,
                amount_fmt: item.amount_cents ? (item.amount_cents / 100).toFixed(2) : '0.00',
                created_at_fmt: item.created_at ? item.created_at.split('T')[0] : ''
            }));
            this.setData({ list, loading: false });
        } catch (err) {
            console.error(err);
            this.setData({ loading: false });
        }
    },

    previewImage(e) {
        let url = e.currentTarget.dataset.url;
        if (!url) return;
        if (!url.startsWith('http')) url = API_BASE_URL + url;
        wx.previewImage({ urls: [url] });
    },

    handleAction(e) {
        const { action, id } = e.currentTarget.dataset;
        const actionText = action === 'approve' ? '通过' : '驳回';

        // 如果是驳回，可以弹窗输入理由（这里简化为确认框）
        wx.showModal({
            title: '确认操作',
            content: `确定要${actionText}该申请吗？`,
            success: async (res) => {
                if (res.confirm) {
                    wx.showLoading({ title: '处理中' });
                    try {
                        await request.post('/api/v1/base/approval/action', {
                            id,
                            type: this.data.currentType,
                            action,
                            reason: action === 'reject' ? '小程序端驳回' : ''
                        });
                        wx.hideLoading();
                        wx.showToast({ title: '已处理', icon: 'success' });

                        // 延迟刷新
                        setTimeout(() => {
                            this.loadList();
                        }, 500);
                    } catch (err) {
                        wx.hideLoading();
                        console.error(err);
                    }
                }
            }
        });
    }
})
