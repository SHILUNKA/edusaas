
import BaseService from '../../../../services/BaseService';

Page({
    data: {
        id: null,
        isEdit: false,
        form: {
            name: '',
            code: '',
            address: '',
            operation_mode: 'franchise', // default
            status: 'active',
            auth_start_date: '',
            auth_end_date: ''
        },
        modeOptions: [
            { label: '直营 (Direct)', value: 'direct' },
            { label: '加盟 (Franchise)', value: 'franchise' }
        ],
        modeIndex: 1, // default franchise
        statusOptions: [
            { label: '运营中 (Active)', value: 'active' },
            { label: '已停用 (Suspended)', value: 'suspended' }
        ],
        statusIndex: 0,
        loading: false
    },

    onLoad(options) {
        if (options.id) {
            this.setData({
                id: options.id,
                isEdit: true
            });
            wx.setNavigationBarTitle({ title: '编辑基地' });
            this.loadBaseDetail(options.id);
        } else {
            wx.setNavigationBarTitle({ title: '新建基地' });
        }
    },

    async loadBaseDetail(id) {
        wx.showLoading({ title: '加载中...' });
        try {
            // API currently doesn't support GET /bases/:id, so fetch all and find.
            // Optimization: In real app, consider caching or backend update.
            const bases = await BaseService.getBases();
            const base = bases.find(b => b.id === id);

            if (base) {
                const modeIndex = this.data.modeOptions.findIndex(o => o.value === base.operation_mode);
                const statusIndex = this.data.statusOptions.findIndex(o => o.value === base.status);

                this.setData({
                    form: {
                        ...base,
                        auth_start_date: base.auth_start_date || '',
                        auth_end_date: base.auth_end_date || ''
                    },
                    modeIndex: modeIndex >= 0 ? modeIndex : 1,
                    statusIndex: statusIndex >= 0 ? statusIndex : 0
                });
            }
        } catch (err) {
            wx.showToast({ title: '加载失败', icon: 'none' });
        } finally {
            wx.hideLoading();
        }
    },

    onInputChange(e) {
        const field = e.currentTarget.dataset.field;
        this.setData({
            [`form.${field}`]: e.detail.value
        });
    },

    onModeChange(e) {
        const idx = e.detail.value;
        this.setData({
            modeIndex: idx,
            'form.operation_mode': this.data.modeOptions[idx].value
        });
    },

    onStatusChange(e) {
        const idx = e.detail.value;
        this.setData({
            statusIndex: idx,
            'form.status': this.data.statusOptions[idx].value
        });
    },

    onDateChange(e) {
        const field = e.currentTarget.dataset.field;
        this.setData({
            [`form.${field}`]: e.detail.value
        });
    },

    async onSubmit() {
        if (this.data.loading) return;

        const { form, isEdit, id } = this.data;

        // Validation
        if (!form.name || !form.code) {
            wx.showToast({ title: '名称和编号必填', icon: 'none' });
            return;
        }

        this.setData({ loading: true });
        wx.showLoading({ title: '提交中...' });

        try {
            if (isEdit) {
                await BaseService.updateBase(id, form);
            } else {
                await BaseService.createBase(form);
            }

            wx.showToast({ title: '保存成功', icon: 'success' });
            setTimeout(() => {
                wx.navigateBack();
            }, 1500);
        } catch (err) {
            console.error(err);
            wx.showToast({ title: '操作失败', icon: 'none' });
        } finally {
            this.setData({ loading: false });
            wx.hideLoading();
        }
    }
});
