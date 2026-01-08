import LeadService from '../../../../services/LeadService';

Page({
    data: {
        leads: [],
        loading: true,
        currentTab: 'all', // all/new/contacted/qualified/converted/lost
        page: 1,
        hasMore: true,

        // 统计数据
        stats: {
            all: 0,
            new: 0,
            contacted: 0,
            qualified: 0
        }
    },

    onLoad() {
        this.loadLeads();
    },

    onPullDownRefresh() {
        this.setData({ page: 1, leads: [] });
        this.loadLeads();
    },

    onReachBottom() {
        if (this.data.hasMore && !this.data.loading) {
            this.setData({ page: this.data.page + 1 });
            this.loadLeads(true);
        }
    },

    async loadLeads(append = false) {
        try {
            this.setData({ loading: true });

            const params = {
                page: this.data.page,
                limit: 20
            };

            // 根据tab筛选状态
            if (this.data.currentTab !== 'all') {
                params.status = this.data.currentTab;
            }

            const newLeads = await LeadService.getLeads(params);

            this.setData({
                leads: append ? [...this.data.leads, ...newLeads] : newLeads,
                hasMore: newLeads.length >= 20,
                loading: false
            });

            wx.stopPullDownRefresh();
        } catch (err) {
            console.error('加载客户失败', err);
            wx.showToast({
                title: '加载失败',
                icon: 'none'
            });
            this.setData({ loading: false });
            wx.stopPullDownRefresh();
        }
    },

    onTabChange(e) {
        const tab = e.currentTarget.dataset.tab;
        this.setData({
            currentTab: tab,
            page: 1,
            leads: []
        });
        this.loadLeads();
    },

    onLeadTap(e) {
        const { id } = e.currentTarget.dataset;
        wx.navigateTo({
            url: `/pkg_base/pages/leads/detail/index?id=${id}`
        });
    },

    onCreateLead() {
        wx.navigateTo({
            url: '/pkg_base/pages/leads/create/index'
        });
    },

    // 格式化日期
    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return '今天';
        if (days === 1) return '昨天';
        if (days < 7) return `${days}天前`;
        return `${date.getMonth() + 1}/${date.getDate()}`;
    },

    // 获取状态文本
    getStatusText(status) {
        const statusMap = {
            new: '新客户',
            contacted: '已联系',
            qualified: '已评估',
            trial_scheduled: '待试听',
            converted: '已转化',
            lost: '已流失'
        };
        return statusMap[status] || status;
    },

    // 获取状态样式类
    getStatusClass(status) {
        const classMap = {
            new: 'status-new',
            contacted: 'status-contacted',
            qualified: 'status-qualified',
            trial_scheduled: 'status-trial',
            converted: 'status-converted',
            lost: 'status-lost'
        };
        return classMap[status] || '';
    }
});
