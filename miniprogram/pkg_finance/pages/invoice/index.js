import request from '../../../services/request';
import { API_BASE_URL } from '../../../config/index';
import { userStore } from '../../../store/userStore';

Page({
    data: {
        activeTab: 0,
        list: [],
        allOrders: [],
        showModal: false,
        targetOrder: null,
        formInvoiceNo: '',
        formTempFilePath: '',
        formInvoiceUrl: '',
        submitting: false
    },

    onShow() {
        this.fetchData();
    },

    onPullDownRefresh() {
        this.fetchData().then(() => wx.stopPullDownRefresh());
    },

    switchTab(e) {
        const idx = e.currentTarget.dataset.idx;
        this.setData({ activeTab: idx });
        this.filterList();
    },

    async fetchData() {
        try {
            const res = await request.get('/api/v1/finance/orders');
            const allOrders = (res || []).map(item => ({
                ...item,
                total_amount_fmt: (item.total_amount_cents / 100).toFixed(2),
                payment_status_text: this.getPayStatusText(item.payment_status),
                paidStatusClass: item.payment_status
            }));
            this.setData({ allOrders });
            this.filterList();
        } catch (e) {
            console.error(e);
        }
    },

    filterList() {
        const { allOrders, activeTab } = this.data;
        const list = allOrders.filter(item => {
            // Tab 0: 待开票 (状态不是 issued，且要是已支付订单才需要开票? 这里暂展示所有)
            // Tab 1: 已开票 (状态 issued)
            const isIssued = item.invoice_status === 'issued';
            return activeTab === 1 ? isIssued : !isIssued;
        });
        this.setData({ list });
    },

    getPayStatusText(status) {
        const map = { 'paid': '已支付', 'partial': '部分支付', 'unpaid': '未支付' };
        return map[status] || status;
    },

    // Modal actions
    openIssueModal(e) {
        const item = e.currentTarget.dataset.item;
        this.setData({
            showModal: true,
            targetOrder: item,
            formInvoiceNo: item.invoice_no || '',
            formTempFilePath: '',
            formInvoiceUrl: item.invoice_url || ''
        });
    },
    closeModal() {
        this.setData({ showModal: false });
    },

    chooseInvoiceImg() {
        wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            success: (res) => {
                const path = res.tempFiles[0].tempFilePath;
                this.setData({ formTempFilePath: path });
                this.uploadImage(path);
            }
        })
    },

    uploadImage(filePath) {
        wx.showLoading({ title: '上传中' });
        wx.uploadFile({
            url: `${API_BASE_URL}/api/v1/upload`,
            filePath: filePath,
            name: 'file',
            header: { 'Authorization': `Bearer ${userStore.token}` },
            success: (res) => {
                wx.hideLoading();
                try {
                    const data = JSON.parse(res.data);
                    this.setData({ formInvoiceUrl: data.url });
                } catch (e) { }
            },
            fail: () => wx.hideLoading()
        });
    },

    async submitInvoice() {
        const { targetOrder, formInvoiceNo, formInvoiceUrl } = this.data;
        if (!formInvoiceNo) return wx.showToast({ title: '请输入发票号', icon: 'none' });

        this.setData({ submitting: true });
        try {
            await request.put(`/api/v1/finance/orders/${targetOrder.id}/invoice`, {
                status: 'issued',
                invoice_no: formInvoiceNo,
                invoice_url: formInvoiceUrl || null
            });
            wx.showToast({ title: '录入成功', icon: 'success' });
            this.setData({ showModal: false, submitting: false });
            this.fetchData();
        } catch (e) {
            this.setData({ submitting: false });
            console.error(e);
        }
    },

    previewInvoice(e) {
        let url = e.currentTarget.dataset.url;
        if (!url) return;
        if (!url.startsWith('http')) url = API_BASE_URL + url;
        wx.previewImage({ urls: [url] });
    }
})
