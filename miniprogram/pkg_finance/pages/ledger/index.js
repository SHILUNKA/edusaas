import request from '../../../services/request';
import { API_BASE_URL } from '../../../config/index';

const CAT_MAP = {
    'marketing': '市场推广',
    'rent': '房租水电',
    'office': '办公用品',
    'equipment': '设备采购',
    'salary': '员工薪资',
    'other': '其他支出'
};

Page({
    data: {
        list: [],
        loading: true,
        hasMore: false,
    },

    onShow() {
        this.fetchData();
    },

    onPullDownRefresh() {
        this.fetchData().then(() => {
            wx.stopPullDownRefresh();
        });
    },

    async fetchData() {
        try {
            const res = await request.get('/api/v1/finance/expenses');

            const list = (res || []).map(item => {
                const catName = CAT_MAP[item.category] || item.category || '未知';
                return {
                    ...item,
                    amountFmt: (item.amount_cents / 100).toFixed(2),
                    categoryChar: catName.charAt(0),
                    categoryStyle: item.category, // e.g. 'marketing'
                    // 若后端只存了key，这里展示中文名；若存了中文，直接展示
                    category: catName,
                    statusText: this.getStatusText(item.status || 'pending')
                };
            });

            this.setData({ list, loading: false });
        } catch (err) {
            console.error(err);
            this.setData({ loading: false });
        }
    },

    getStatusText(status) {
        const map = {
            'pending': '审核中',
            'approved': '已通过',
            'paid': '已打款',
            'rejected': '已驳回'
        };
        return map[status] || status;
    },

    handleItemTap(e) {
        const item = e.currentTarget.dataset.item;
        if (item.proof_image_url) {
            let url = item.proof_image_url;
            // 补全路径
            if (!url.startsWith('http')) {
                url = API_BASE_URL + url;
            }

            wx.previewImage({
                urls: [url] // 需要数组
            });
        }
    },

    goCreate() {
        wx.navigateTo({ url: '/pkg_finance/pages/bookkeeping/index' });
    }
})
