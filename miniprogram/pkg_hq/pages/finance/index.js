import FinanceService from '../../../services/FinanceService';

Page({
    data: {
        stats: {},
        records: [],
        loading: false,
        currentDate: '',
        page: 1,
        limit: 5,
    },

    onLoad() {
        const now = new Date();
        this.setData({
            currentDate: `${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()}`
        });
    },

    onShow() {
        this.loadDashboard();
        this.loadPendingRecords();
    },

    async loadDashboard() {
        try {
            const res = await FinanceService.getHqDashboard();
            this.processStats(res);
        } catch (err) {
            console.error('Fetch dashboard failed', err);
        }
    },

    processStats(data) {
        // Format large numbers
        const fmt = (n) => (n / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });

        // Transform API data to UI format
        const stats = {
            ...data,
            total_prepaid_pool_fmt: fmt(data.total_prepaid_pool || 0),
            month_cash_in_fmt: fmt(data.month_cash_in || 0),
            month_revenue_fmt: fmt(data.month_revenue || 0),
            // Mock trend data for chart if empty
            trend_revenue: data.trend_revenue?.length ? data.trend_revenue : [120, 150, 180, 220, 260, 300]
        };

        this.setData({ stats }, () => {
            this.initChart(stats.trend_revenue);
        });
    },

    async loadPendingRecords() {
        try {
            const res = await FinanceService.getPaymentRecords({
                status: 'PENDING',
                page: 1,
                limit: 5
            });
            this.setData({ records: res });
        } catch (err) {
            console.error('Fetch records failed', err);
        }
    },

    // Chart Logic (Simple Canvas 2D)
    initChart(dataPoints) {
        const query = wx.createSelectorQuery();
        query.select('#financeTrendChart')
            .fields({ node: true, size: true })
            .exec((res) => {
                if (!res[0]) return;
                const canvas = res[0].node;
                const ctx = canvas.getContext('2d');
                const dpr = wx.getSystemInfoSync().pixelRatio;

                canvas.width = res[0].width * dpr;
                canvas.height = res[0].height * dpr;
                ctx.scale(dpr, dpr);

                this.drawTrendLine(ctx, res[0].width, res[0].height, dataPoints);
            });
    },

    drawTrendLine(ctx, width, height, data) {
        // Clear
        ctx.clearRect(0, 0, width, height);

        if (!data || data.length === 0) return;

        // Config
        const padding = 20;
        const chartW = width - padding * 2;
        const chartH = height - padding * 2;
        const maxVal = Math.max(...data) * 1.2;
        const stepX = chartW / (data.length - 1);

        // Gradient Stroke
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
        gradient.addColorStop(1, '#5D5FEF');

        ctx.beginPath();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        data.forEach((val, i) => {
            const x = padding + i * stepX;
            const y = height - padding - (val / maxVal) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Area Fill (Optional, to make it look premium)
        ctx.lineTo(width - padding, height);
        ctx.lineTo(padding, height);
        ctx.fillStyle = 'rgba(93, 95, 239, 0.1)';
        ctx.fill();
    },

    onViewAllRecords() {
        wx.showToast({ title: '跳转完整列表(TODO)', icon: 'none' });
    },

    onVerify(e) {
        const id = e.currentTarget.dataset.id;
        wx.showModal({
            title: '审核确认',
            content: '确认通过这笔流水吗？',
            confirmColor: '#000000',
            success: (res) => {
                if (res.confirm) {
                    // Call verify API (Mock for now)
                    wx.showToast({ title: '审核通过', icon: 'success' });
                    this.loadPendingRecords(); // Refresh
                }
            }
        });
    }
});
