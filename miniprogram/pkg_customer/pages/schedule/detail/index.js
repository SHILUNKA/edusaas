// pkg_customer/pages/schedule/detail/index.js
Page({
    data: {
        classId: '',
        classDetail: null,
        loading: true
    },

    onLoad(options) {
        const { id } = options;
        if (id) {
            this.setData({ classId: id });
            this.loadClassDetail();
        }
    },

    async loadClassDetail() {
        try {
            wx.showLoading({ title: '加载中...' });

            // TODO: 调用实际API
            // const result = await request.get(`/api/v1/customer/classes/${this.data.classId}`);

            // 模拟数据
            const classDetail = {
                id: this.data.classId,
                course_name: '航天科学启蒙A',
                start_time: '2026-01-06 14:00',
                end_time: '2026-01-06 15:30',
                room_name: '创客教室1',
                teacher_name: '张老师',
                enrollment: {
                    status: 'signed_in',
                    signed_in_at: '2026-01-06 13:55',
                    teacher_feedback: '课堂表现优秀，积极参与讨论',
                    rating: 5,
                    photos: []
                }
            };

            this.setData({
                classDetail,
                loading: false
            });
        } catch (error) {
            console.error('Failed to load class detail:', error);
            wx.showToast({
                title: '加载失败',
                icon: 'none'
            });
        } finally {
            wx.hideLoading();
        }
    }
});
