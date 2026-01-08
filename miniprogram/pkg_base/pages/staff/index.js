const app = getApp();
import api from '../../../services/request';

// Default avatar
const DEFAULT_AVATAR = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwBHJk5UgbmU7rIDjZt7n1qOQeWJqX5jIqY5qX5jIqY5qX5jIqY5qX5jIqY5qX5jI/0';

Page({
    data: {
        list: [],
        loading: false
    },

    onLoad() {
        this.loadList();
    },

    async loadList() {
        this.setData({ loading: true });
        try {
            const res = await api.get('/api/v1/base/staff/list');
            if (res) {
                // Map role keys to CN
                const roleMap = {
                    'admin': '管理员',
                    'base_admin': '管理员',
                    'teacher': '教师',
                    'sales': '销售',
                    'finance': '财务',
                    'unknown': '未分配'
                };
                const list = res.map(item => ({
                    ...item,
                    role: roleMap[item.role] || item.role,
                    avatar_url: item.avatar_url || DEFAULT_AVATAR
                }));
                this.setData({ list, loading: false });
            }
        } catch (err) {
            console.error(err);
            this.setData({ loading: false });
        }
    },

    callStaff(e) {
        const phone = e.currentTarget.dataset.phone;
        if (phone) {
            wx.makePhoneCall({ phoneNumber: phone });
        } else {
            wx.showToast({ title: '无电话号码', icon: 'none' });
        }
    },

    onAddStaff() {
        wx.showToast({ title: '添加功能开发中', icon: 'none' });
    },

    onPullDownRefresh() {
        this.loadList().then(() => wx.stopPullDownRefresh());
    }
});
