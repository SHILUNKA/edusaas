import LeadService from '../../../../services/LeadService';

Page({
    data: {
        leadId: '',
        lead: null,
        loading: true,

        // 跟进表单
        showFollowUpDialog: false,
        followUpForm: {
            follow_up_type: 'call',
            content: '',
            outcome: '',
            next_follow_up_at: ''
        },

        typeOptions: [
            { value: 'call', label: '电话' },
            { value: 'wechat', label: '微信' },
            { value: 'visit', label: '到店' },
            { value: 'email', label: '邮件' }
        ],

        outcomeOptions: [
            { value: 'positive', label: '积极' },
            { value: 'neutral', label: '中立' },
            { value: 'negative', label: '消极' },
            { value: 'no_answer', label: '未接通' }
        ]
    },

    onLoad(options) {
        const { id } = options;
        if (id) {
            this.setData({ leadId: id });
            this.loadLeadDetail();
        }
    },

    async loadLeadDetail() {
        try {
            this.setData({ loading: true });

            const lead = await LeadService.getLeadDetail(this.data.leadId);

            this.setData({
                lead,
                loading: false
            });

        } catch (err) {
            console.error('加载详情失败', err);
            wx.showToast({
                title: '加载失败',
                icon: 'none'
            });
            this.setData({ loading: false });
        }
    },

    // 打开跟进对话框
    onAddFollowUp() {
        this.setData({ showFollowUpDialog: true });
    },

    // 关闭跟进对话框
    onCloseFollowUpDialog() {
        this.setData({
            showFollowUpDialog: false,
            followUpForm: {
                follow_up_type: 'call',
                content: '',
                outcome: '',
                next_follow_up_at: ''
            }
        });
    },

    // 跟进表单输入
    onFollowUpInput(e) {
        const { field } = e.currentTarget.dataset;
        this.setData({
            [`followUpForm.${field}`]: e.detail.value
        });
    },

    // 选择跟进方式
    onTypeChange(e) {
        const type = this.data.typeOptions[e.detail.value].value;
        this.setData({
            'followUpForm.follow_up_type': type
        });
    },

    // 选择跟进结果
    onOutcomeChange(e) {
        const outcome = this.data.outcomeOptions[e.detail.value].value;
        this.setData({
            'followUpForm.outcome': outcome
        });
    },

    // 选择下次跟进时间
    onDateChange(e) {
        this.setData({
            'followUpForm.next_follow_up_at': e.detail.value
        });
    },

    // 提交跟进记录
    async onSubmitFollowUp() {
        if (!this.data.followUpForm.content) {
            wx.showToast({ title: '请输入跟进内容', icon: 'none' });
            return;
        }

        try {
            await LeadService.addFollowUp(this.data.leadId, this.data.followUpForm);

            wx.showToast({
                title: '添加成功',
                icon: 'success'
            });

            this.onCloseFollowUpDialog();
            this.loadLeadDetail(); // 重新加载详情

        } catch (err) {
            console.error('添加跟进失败', err);
            wx.showToast({
                title: err.message || '添加失败',
                icon: 'none'
            });
        }
    },

    // 拨打电话
    onCall() {
        if (this.data.lead?.phone_number) {
            wx.makePhoneCall({
                phoneNumber: this.data.lead.phone_number
            });
        }
    },

    // 格式化时间
    formatDateTime(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${month}月${day}日 ${hours}:${minutes}`;
    },

    // 获取状态文本
    getStatusText(status) {
        const statusMap = {
            new: '新线索',
            contacted: '已联系',
            qualified: '已评估',
            trial_scheduled: '待试听',
            converted: '已转化',
            lost: '已流失'
        };
        return statusMap[status] || status;
    },

    // 获取结果图标
    getOutcomeIcon(outcome) {
        const iconMap = {
            positive: '👍',
            neutral: '👌',
            negative: '👎',
            no_answer: '📵'
        };
        return iconMap[outcome] || '';
    }
});
