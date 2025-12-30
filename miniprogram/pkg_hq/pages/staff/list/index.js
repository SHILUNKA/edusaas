Page({
    data: {
        riskStats: {
            healthScore: 92,
            alerts: [
                { id: 1, message: '发现 3 个账号超过 30 天未登录' },
                { id: 2, message: '离职员工账号 [张三] 尚未冻结' }
            ]
        },
        keyPersonnel: [
            { id: 101, name: '李总', roleType: 'admin', roleName: '总部', baseName: 'HQ', avatar: '' },
            { id: 102, name: '王校长', roleType: 'principal', roleName: '校长', baseName: '北京海淀基地', avatar: '' },
            { id: 103, name: '赵校长', roleType: 'principal', roleName: '校长', baseName: '上海徐汇基地', avatar: '' }
        ],
        currentRankTab: 'purchase', // purchase | activity
        purchaseRankings: [
            { id: 201, name: '北京海淀基地', region: '华北区', score: '320,000' },
            { id: 202, name: '深圳南山基地', region: '华南区', score: '280,000' },
            { id: 203, name: '上海徐汇基地', region: '华东区', score: '256,000' },
            { id: 204, name: '广州天河基地', region: '华南区', score: '198,000' },
            { id: 205, name: '杭州西湖基地', region: '华东区', score: '150,000' }
        ],
        activityRankings: [
            { id: 301, name: '成都高新基地', region: '西南区', score: '98.5' },
            { id: 302, name: '武汉光谷基地', region: '华中区', score: '95.2' },
            { id: 303, name: '北京海淀基地', region: '华北区', score: '92.0' },
            { id: 304, name: '西安雁塔基地', region: '西北区', score: '88.5' },
            { id: 305, name: '南京鼓楼基地', region: '华东区', score: '85.0' }
        ]
    },

    onLoad() {
        // TODO: Fetch real data from backend
    },

    onTabChange(e) {
        const tab = e.currentTarget.dataset.tab;
        this.setData({ currentRankTab: tab });
    },

    onAddPrincipal() {
        // Navigate to Base List to select a base and then appoint principal
        wx.navigateTo({
            url: '/pkg_hq/pages/base/list/index'
        });
    }
});
