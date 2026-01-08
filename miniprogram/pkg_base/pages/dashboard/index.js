// 基地老板决策看板
import api from '../../../services/request';
const app = getApp()

Page({
    data: {
        loading: false, // 暂时改为false
        baseName: '',
        updateTime: '',
        metrics: {
            cash_flow: {
                cash_on_hand: 0,
                accounts_receivable: 0,
                overdue_count: 0,
                available_funds: 0,
                runway_months: 0,
                status: 'healthy'
            },
            today_revenue: {
                total: 0,
                toc: 0,
                tob: 0,
                order_count: 0
            },
            students: {
                active_students: 0,
                capacity: 500,
                utilization_rate: 0,
                this_month_new: 0,
                this_month_churned: 0,
                net_growth: 0,
                trend: 'stable'
            },
            recruitment: {
                leads_count: 0,
                trial_scheduled: 0,
                trial_completed: 0,
                trial_converted: 0,
                signed_count: 0,
                trial_conversion_rate: 0,
                overall_conversion_rate: 0,
                cac: 0,
                ltv: 0,
                ltv_cac_ratio: 0,
                status: 'healthy'
            },
            revenue_progress: {
                target: 0,
                actual: 0,
                completion_rate: 0,
                days_passed: 0,
                days_total: 30,
                expected_pace: 0,
                pace_status: 'on_track',
                projection: 0
            },
            profitability: {
                total_revenue: 0,
                toc_revenue: 0,
                tob_revenue: 0,
                total_expense: 0,
                gross_profit: 0,
                gross_margin: 0,
                tob_ratio: 0,
                tob_target: 0.5,
                profit_status: 'healthy'
            },
            tob_status: {
                tomorrow_events_count: 0,
                in_progress_count: 0,
                in_progress_amount: 0,
                overdue_count: 0
            },
            alerts: {
                critical: [],
                warning: [],
                info: []
            }
        },
        hasAlerts: false
    },

    onLoad() {
        console.log('[Dashboard] 页面加载')
        this.loadDashboard()
    },

    onShow() {
        console.log('[Dashboard] 页面显示')
    },

    // 下拉刷新
    onPullDownRefresh() {
        console.log('[Dashboard] 下拉刷新')
        this.loadDashboard().then(() => {
            wx.stopPullDownRefresh()
        })
    },

    // 刷新按钮
    onRefresh() {
        console.log('[Dashboard] 手动刷新')
        this.loadDashboard()
    },

    // 加载仪表盘数据
    async loadDashboard() {
        try {
            this.setData({ loading: true })

            const token = wx.getStorageSync('token')
            if (!token) {
                wx.showToast({
                    title: '请先登录',
                    icon: 'none'
                })
                return
            }

            console.log('[Dashboard] 开始请求数据...')

            // 调用API
            const response = await api.get('/api/v1/base/dashboard/overview')

            console.log('[Dashboard] 数据返回:', response)

            if (response && response.metrics) {
                // 更新数据
                this.setData({
                    baseName: response.base_name || '基地',
                    updateTime: this.formatTime(new Date()),
                    metrics: response.metrics,
                    hasAlerts: this.checkHasAlerts(response.metrics.alerts),
                    loading: false
                })

                console.log('[Dashboard] 数据更新完成')
            } else {
                throw new Error('数据格式错误')
            }

        } catch (error) {
            console.error('[Dashboard] 加载失败:', error)

            this.setData({ loading: false })

            wx.showToast({
                title: '加载失败',
                icon: 'none'
            })
        }
    },

    // 检查是否有预警
    checkHasAlerts(alerts) {
        return (alerts.critical && alerts.critical.length > 0) ||
            (alerts.warning && alerts.warning.length > 0) ||
            (alerts.info && alerts.info.length > 0)
    },

    // 格式化时间
    formatTime(date) {
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        const day = date.getDate()
        const hour = date.getHours()
        const minute = date.getMinutes()

        const padZero = (n) => n < 10 ? '0' + n : n

        return `${month}/${day} ${padZero(hour)}:${padZero(minute)} 更新`
    },

    // 跳转到详情页（预留）
    goToDetail(e) {
        const type = e.currentTarget.dataset.type
        console.log('[Dashboard] 跳转到详情:', type)

        // TODO: 根据type跳转到不同的详情页
        wx.showToast({
            title: '功能开发中',
            icon: 'none'
        })
    }
})
