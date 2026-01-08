const app = getApp();
import api from '../../../../services/request';

Page({
    data: {
        title: '',
        content: '',
        priority: 'normal',
        loading: false
    },

    onInput(e) {
        const field = e.currentTarget.dataset.field;
        this.setData({ [field]: e.detail.value });
    },

    setPriority(e) {
        this.setData({ priority: e.currentTarget.dataset.val });
    },

    async onSubmit() {
        const { title, content, priority } = this.data;
        if (!title.trim() || !content.trim()) {
            wx.showToast({ title: '请填写完整', icon: 'none' });
            return;
        }

        this.setData({ loading: true });
        try {
            await api.post('/api/v1/base/notice/create', { title, content, priority });
            wx.showToast({ title: '发布成功', icon: 'success' });
            setTimeout(() => {
                wx.navigateBack();
            }, 1500);
        } catch (err) {
            console.error(err);
            this.setData({ loading: false });
            // wx.showToast({ title: '发布失败', icon: 'none' });
        }
    }
});
