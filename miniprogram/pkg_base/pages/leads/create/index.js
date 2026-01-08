import LeadService from '../../../../services/LeadService';

Page({
    data: {
        form: {
            contact_name: '',
            phone_number: '',
            wechat_id: '',
            child_name: '',
            child_age: null,
            child_grade: '',
            source: '',
            quality_score: 3,
            notes: ''
        },

        sourceOptions: ['线上广告', '朋友推荐', '到店咨询', '活动', '其他'],
        gradeOptions: ['学龄前', '小学一年级', '小学二年级', '小学三年级', '小学四年级', '小学五年级', '小学六年级', '初中', '高中'],

        submitting: false
    },

    // 输入事件
    onInput(e) {
        const { field } = e.currentTarget.dataset;
        this.setData({
            [`form.${field}`]: e.detail.value
        });
    },

    // 选择来源
    onSourceChange(e) {
        const index = e.detail.value;
        this.setData({
            'form.source': this.data.sourceOptions[index]
        });
    },

    // 选择年级
    onGradeChange(e) {
        const index = e.detail.value;
        this.setData({
            'form.child_grade': this.data.gradeOptions[index]
        });
    },

    // 评分
    onScoreTap(e) {
        const { score } = e.currentTarget.dataset;
        this.setData({
            'form.quality_score': score
        });
    },

    // 提交表单
    async onSubmit() {
        // 验证
        if (!this.data.form.contact_name) {
            wx.showToast({ title: '请输入联系人姓名', icon: 'none' });
            return;
        }

        if (!this.data.form.phone_number) {
            wx.showToast({ title: '请输入联系电话', icon: 'none' });
            return;
        }

        // 简单手机号验证
        const phoneReg = /^1[3-9]\d{9}$/;
        if (!phoneReg.test(this.data.form.phone_number)) {
            wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
            return;
        }

        try {
            this.setData({ submitting: true });

            await LeadService.createLead(this.data.form);

            wx.showToast({
                title: '创建成功',
                icon: 'success'
            });

            // 返回上一页并刷新
            setTimeout(() => {
                wx.navigateBack();
            }, 1500);

        } catch (err) {
            console.error('创建失败', err);
            wx.showToast({
                title: err.message || '创建失败',
                icon: 'none'
            });
        } finally {
            this.setData({ submitting: false });
        }
    }
});
