Page({
    data: {
        topProducts: [
            { id: 1, name: 'L1 启蒙课程包', category: '课程', type: 'course', sales: 120, amount: '360,000' },
            { id: 2, name: '智能机器狗教具', category: '教具', type: 'material', sales: 85, amount: '127,500' },
            { id: 3, name: 'L2 进阶课程包', category: '课程', type: 'course', sales: 60, amount: '240,000' },
            { id: 4, name: '少儿编程拓展包', category: '课程', type: 'course', sales: 45, amount: '90,000' },
            { id: 5, name: '品牌装修物料箱', category: '物料', type: 'material', sales: 30, amount: '15,000' },
        ]
    },

    onLoad() {
        this.initChart();
    },

    initChart() {
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

                this.drawBarChart(ctx, res[0].width, res[0].height);
            });
    },

    drawBarChart(ctx, width, height) {
        const data = [12, 18, 15, 25, 32, 45]; // Mock Order Amounts (in 10k)
        const labels = ['7月', '8月', '9月', '10月', '11月', '12月'];

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
