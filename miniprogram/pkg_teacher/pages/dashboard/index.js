import request from '../../../services/request';
import { userStore } from '../../../store/userStore';

Page({
    data: {
        teacherName: '',
        greeting: '',
        stats: {
            today_class_count: 0,
            pending_leads_count: 0,
            month_lesson_count: 0
        },
        upcoming_classes: [],
        loading: false
    },

    getGreeting() {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 11) {
            return '早安';
        } else if (hour >= 11 && hour < 13) {
            return '中午好';
        } else if (hour >= 13 && hour < 18) {
            return '下午好';
        } else if (hour >= 18 && hour < 24) {
            return '晚上好';
        } else {
            return '夜深了';
        }
    },

    onShow() {
        this.setData({
            teacherName: userStore.userInfo ? userStore.userInfo.name : '老师',
            greeting: this.getGreeting()
        });
        this.loadDashboardData();
    },

    async loadDashboardData() {
        this.setData({ loading: true });
        try {
            const res = await request.get('/api/v1/teacher/dashboard');
            if (res) {
                // 格式化时间
                const formattedClasses = res.upcoming_classes.map(c => {
                    const startTime = new Date(c.start_time);
                    const timeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
                    return {
                        ...c,
                        startTimeFmt: timeStr
                    };
                });

                this.setData({
                    stats: res.stats,
                    upcoming_classes: formattedClasses
                });
            }
        } catch (e) {
            console.error('Failed to load teacher dashboard:', e);
        } finally {
            this.setData({ loading: false });
            wx.stopPullDownRefresh();
        }
    },

    onPullDownRefresh() {
        this.loadDashboardData();
    },

    // Navigation
    navToSchedule() {
        wx.navigateTo({ url: '/pkg_teacher/pages/schedule/index' });
    },

    navToCheckin() {
        // 默认去最近的一节课点名
        if (this.data.upcoming_classes.length > 0) {
            wx.navigateTo({
                url: `/pkg_teacher/pages/class/detail/index?id=${this.data.upcoming_classes[0].id}`
            });
        } else {
            wx.showToast({ title: '暂无待上课程', icon: 'none' });
        }
    },

    navToClassDetail(e) {
        const id = e.currentTarget.dataset.id;
        wx.navigateTo({ url: `/pkg_teacher/pages/class/detail/index?id=${id}` });
    },

    navToLeads() {
        // 老师看"我的客户"，可以复用基础包的页面但传入参数
        wx.navigateTo({ url: '/pkg_base/pages/leads/list/index?scope=mine' });
    },

    navToAddLead() {
        wx.navigateTo({ url: '/pkg_base/pages/leads/create/index' });
    },

    navToStudents() {
        wx.navigateTo({ url: '/pkg_teacher/pages/students/list/index' });
    },

    navToReport() {
        wx.showToast({ title: '能力开发中', icon: 'none' });
    },

    navToWaitList() {
        wx.showToast({ title: '能力开发中', icon: 'none' });
    }
});
