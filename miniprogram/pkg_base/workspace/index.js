// 基地管理工作台
const app = getApp()
import api from '../../services/request';

Page({
    data: {
        loading: false,
        approvals: {
            discount: 0,
            refund: 0,
            expense: 0,
            leave: 0
        },
        risks: []
    },

    onShow() {
        // TabBar 组件会自动初始化，无需手动调用
        this.loadData();
    },

    async loadData() {
        this.setData({ loading: true });

        try {
            const res = await api.get('/api/v1/base/workspace/overview');
            if (res) {
                this.setData({
                    approvals: res.approvals,
                    risks: res.risks,
                    loading: false
                });
            }
        } catch (err) {
            console.error('加载工作台数据失败', err);
            // 加载失败时保持 loading false, 避免卡死，可以显示重试按钮
            this.setData({ loading: false });
            wx.showToast({ title: '数据加载失败', icon: 'none' });
        }
    },

    onNavTo(e) {
        const url = e.currentTarget.dataset.url;
        if (url) {
            wx.navigateTo({
                url,
                fail: (err) => {
                    console.warn('跳转失败', err);
                    wx.showToast({ title: '该功能模块开发中', icon: 'none' });
                }
            });
        }
    }
});