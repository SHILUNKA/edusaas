// pkg_customer/pages/home/index.js
const CustomerService = require('../../../services/CustomerService');
const app = getApp();

Page({
    data: {
        loading: true,
        customer: null,
        participants: [],
        selectedParticipantIndex: 0,
        todayClasses: [],
        banners: [
            { image: '/images/banner1.png', title: '航天科学体验课' },
            { image: '/images/banner2.png', title: '创客编程活动' }
        ],
        quickMenu: [
            { icon: '📅', label: '课表', url: '/pkg_customer/pages/schedule/index' },
            { icon: '🎖️', label: '荣誉', url: '/pkg_customer/pages/honor/index' },
            { icon: '🛒', label: '商城', url: '/pkg_customer/pages/shop/index' },
            { icon: '📋', label: '订单', url: '/pkg_customer/pages/profile/orders/index' },
            { icon: '🔔', label: '消息', url: '/pkg_customer/pages/messages/index' },
            { icon: '📊', label: '报告', url: '/pkg_customer/pages/report/index' }
        ]
    },

    onLoad() {
        this.loadProfile();
    },

    onShow() {
        // 每次显示页面时刷新数据
        if (this.data.customer) {
            this.loadProfile();
        }
    },

    /**
     * 加载用户档案
     */
    async loadProfile() {
        try {
            wx.showLoading({ title: '加载中...', mask: true });
            const result = await CustomerService.getProfile();

            this.setData({
                customer: result.customer || { name: '测试用户' },
                participants: (result.customer && result.customer.participants) || [],
                loading: false
            });

            if (this.data.participants && this.data.participants.length > 0) {
                this.loadTodayClasses();
            }
        } catch (error) {
            console.error('Failed to load profile:', error);
            // 失败时给出友好提示并保留默认UI
            this.setData({ loading: false });
        } finally {
            wx.hideLoading();
        }
    },

    /**
     * 加载今日课表
     */
    async loadTodayClasses() {
        if (!this.data.participants || this.data.participants.length === 0) {
            return;
        }

        const currentParticipant = this.data.participants[this.data.selectedParticipantIndex];
        if (!currentParticipant) return;

        try {
            const today = new Date();
            const todayStr = this.formatDate(today);
            const result = await CustomerService.getSchedule({
                participant_id: currentParticipant.id,
                start_date: todayStr,
                end_date: todayStr,
                status: 'upcoming'
            });

            this.setData({
                todayClasses: result.classes || []
            });
        } catch (error) {
            console.error('Failed to load today classes:', error);
        }
    },

    /**
     * 切换学员
     */
    onParticipantChange(e) {
        const index = e.detail.value;
        this.setData({
            selectedParticipantIndex: index
        });
        this.loadTodayClasses();
    },

    /**
     * 点击快捷菜单
     */
    onMenuTap(e) {
        let { url } = e.currentTarget.dataset;
        if (!url) return;

        // 如果有关联学员，自动带上学员ID
        if (this.data.participants && this.data.participants.length > 0) {
            const participant = this.data.participants[this.data.selectedParticipantIndex];
            if (participant) {
                const separator = url.includes('?') ? '&' : '?';
                url = `${url}${separator}participant_id=${participant.id}`;
            }
        }

        wx.navigateTo({ url });
    },

    /**
     * 格式化日期为YYYY-MM-DD
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
});
