import ReportService from '../../../services/ReportService';

Page({
    data: {
        topProducts: [],
        funnelData: {
            leads: 0,
            contracts: 0,
            firstOrders: 0,
            contractRate: 0,
            orderRate: 0
        },
        loading: true
    },

    onLoad() {
        this.loadData();
    },

    async loadData() {
        try {
            wx.showLoading({ title: '加载中...' });

            // Load top products
            const products = await ReportService.getTopProducts();

            // Load order trend
            const trendData = await ReportService.getOrderTrend();

            // Load funnel data
            const funnel = await ReportService.getFunnelData();

            this.setData({
                topProducts: products || [],
                funnelData: funnel || this.data.funnelData,
                loading: false
            }, () => {
                // Draw chart after data is loaded
                if (trendData && trendData.values && trendData.values.length > 0) {
                    this.initChart(trendData.values, trendData.labels);
                }
            });

        } catch (err) {
            console.error('加载数据失败', err);
            wx.showToast({
                title: '加载失败',
                icon: 'none'
            });
            this.setData({ loading: false });
        } finally {
            wx.hideLoading();
        }
    },

    initChart(dataValues, dataLabels) {
        const query = wx.createSelectorQuery();
        query.select('#orderTrendChart')
            .fields({ node: true, size: true })
            .exec((res) => {
                if (!res[0]) return;
                const canvas = res[0].node;
                const ctx = canvas.getContext('2d');
                const dpr = wx.getSystemInfoSync().pixelRatio;

                canvas.width = res[0].width * dpr;
                canvas.height = res[0].height * dpr;
                ctx.scale(dpr, dpr);

                this.drawBarChart(ctx, res[0].width, res[0].height, dataValues, dataLabels);
            });
    },

    drawBarChart(ctx, width, height, data, labels) {


        const padding = 30;
        const chartW = width - padding * 2;
        const chartH = height - padding * 2;
        const maxVal = 50;

        // Axis
        ctx.beginPath();
        ctx.strokeStyle = '#eee';
        ctx.moveTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding); // X
        ctx.stroke();

        // Bars
        const barWidth = 20;
        const step = chartW / data.length;

        data.forEach((val, i) => {
            const x = padding + i * step + (step - barWidth) / 2;
            const h = (val / maxVal) * chartH;
            const y = height - padding - h;

            // Bar
            ctx.fillStyle = '#5D5FEF';
            ctx.fillRect(x, y, barWidth, h);

            // Label
            ctx.fillStyle = '#666';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(labels[i], x + barWidth / 2, height - 10);

            // Value
            ctx.fillStyle = '#333';
            ctx.fillText(val + 'w', x + barWidth / 2, y - 5);
        });
    }
});
