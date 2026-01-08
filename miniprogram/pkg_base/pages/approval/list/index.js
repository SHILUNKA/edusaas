const app = getApp();
import api from '../../../../services/request';

Page({
    data: {
        type: '',
        list: [],
        loading: false
    },

    onLoad(options) {
        if (options.type) {
            this.setData({ type: options.type });
            this.setPageTitle(options.type);
            this.loadList();
        }
    },

    setPageTitle(type) {
        const titles = {
            discount: '折扣审批',
            refund: '退费审批',
            expense: '报销审批',
            leave: '请假审批'
        };
        wx.setNavigationBarTitle({
            title: titles[type] || '审批中心'
        });
    },

    async loadList() {
        this.setData({ loading: true });
        try {
            const res = await api.get('/api/v1/base/approval/list', {
                type: this.data.type
            });
            this.setData({ list: res || [], loading: false });
        } catch (err) {
            console.error(err);
            this.setData({ loading: false });
            wx.showToast({ title: '加载失败', icon: 'none' });
        }
    },

    async handleAction(e) {
        const { id, action } = e.currentTarget.dataset;
        const { type } = this.data;

        // 二次确认
        const actionText = action === 'approve' ? '通过' : '拒绝';
        const res = await wx.showModal({
            title: '确认操作',
            content: `确定要${actionText}该申请吗？`,
            confirmColor: action === 'approve' ? '#10b981' : '#ef4444'
        });

        if (res.confirm) {
            this.submitAction(id, type, action);
        }
    },

    async submitAction(id, type, action) {
        wx.showLoading({ title: '处理中' });
        try {
            await api.post('/api/v1/base/approval/action', {
                id,
                type,
                action,
                reason: action === 'reject' ? '用户拒绝' : '同意'
            });

            wx.hideLoading();
            wx.showToast({ title: '处理成功' });

            // 刷新列表
            this.loadList();

        } catch (err) {
            wx.hideLoading();
            wx.showToast({ title: '操作失败', icon: 'none' });
        }
    },

    onPullDownRefresh() {
        this.loadList().then(() => wx.stopPullDownRefresh());
    }
});
