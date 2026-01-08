// pages/customer-login/index.js
const AuthService = require('../../services/AuthService_Customer');

const API_BASE_URL = 'http://localhost:8000/api/v1';

// 简单的request函数（用于测试登录）
function request({ url, method = 'GET', data = {} }) {
    return new Promise((resolve, reject) => {
        const token = wx.getStorageSync('token');

        const header = { 'Content-Type': 'application/json' };
        if (token) {
            header['Authorization'] = `Bearer ${token}`;
        }

        const fullUrl = API_BASE_URL + url;
        console.log(`🚀 [API] ${method} ${fullUrl}`, data);

        wx.request({
            url: fullUrl,
            method: method,
            data: data,
            header: header,
            success: (res) => {
                const { statusCode, data: resData } = res;
                console.log(`✅ [API] ${statusCode}`, resData);

                if (statusCode >= 200 && statusCode < 300) {
                    resolve(resData);
                } else {
                    wx.showToast({
                        title: resData.message || `请求失败(${statusCode})`,
                        icon: 'none'
                    });
                    reject(resData);
                }
            },
            fail: (err) => {
                console.error(`💥 [API Fail]`, err);
                wx.showToast({ title: '网络连接失败', icon: 'none' });
                reject(err);
            }
        });
    });
}

const app = getApp();

Page({
    data: {
        loading: false,
        entryParams: null,
        showTestBtn: true
    },

    onLoad() {
        // 获取扫码进入的参数
        const entryParams = app.getEntryParams();
        this.setData({ entryParams });

        if (entryParams) {
            console.log('扫码参数:', entryParams);
            wx.showToast({
                title: `来自${entryParams.channel || '官方'}渠道`,
                icon: 'none',
                duration: 2000
            });
        }

        // 模拟扫码参数（仅用于测试）
        if (!entryParams) {
            const testParams = {
                base_id: 'test-base-123',  // 只需base_id，后端自动查hq_id
                channel: 'poster'
            };
            wx.setStorageSync('entry_params', testParams);
            this.setData({ entryParams: testParams });
            console.log('设置测试扫码参数:', testParams);
        }
    },

    /**
     * 微信一键登录（真实）
     */
    async onWechatLogin() {
        // 🔧 开发模式下跳过登录
        const DEV_MODE_AUTO_LOGIN = true;
        if (DEV_MODE_AUTO_LOGIN) {
            console.log('🔧 开发模式：已自动登录，跳过微信登录');
            wx.showToast({ title: '开发模式：已自动登录', icon: 'success' });
            setTimeout(() => {
                wx.switchTab({ url: '/pkg_customer/pages/home/index' });
            }, 1000);
            return;
        }

        if (this.data.loading) return;

        this.setData({ loading: true });

        try {
            await AuthService.wechatLogin();
        } catch (error) {
            wx.showToast({
                title: error.message || '登录失败',
                icon: 'none'
            });
            this.setData({ loading: false });
        }
    },

    /**
     * 测试登录（开发模式）
     */
    async onTestLogin() {
        if (this.data.loading) return;

        this.setData({ loading: true });

        try {
            console.log('开始测试登录...');

            // 获取扫码参数
            const entryParams = app.getEntryParams() || {};
            console.log('扫码参数:', entryParams);

            // 使用测试code调用登录API
            const result = await request({
                url: '/auth/wechat-login',
                method: 'POST',
                data: {
                    code: 'test-code',
                    base_id: entryParams.base_id   // 只传base_id
                }
            });

            console.log('登录成功:', result);

            // 保存token和用户信息
            wx.setStorageSync('token', result.token);
            wx.setStorageSync('customer', result.customer);

            wx.showToast({
                title: '登录成功',
                icon: 'success'
            });

            // 跳转到首页
            setTimeout(() => {
                wx.switchTab({
                    url: '/pkg_customer/pages/home/index'
                });
            }, 1500);
        } catch (error) {
            console.error('测试登录失败:', error);
            wx.showToast({
                title: '登录失败: ' + (error.message || JSON.stringify(error)),
                icon: 'none',
                duration: 3000
            });
        } finally {
            this.setData({ loading: false });
        }
    },

    /**
     * 查看扫码参数
     */
    onViewParams() {
        const params = app.getEntryParams();
        wx.showModal({
            title: '扫码参数',
            content: JSON.stringify(params, null, 2),
            showCancel: false
        });
    },

    /**
     * 清除缓存
     */
    onClearCache() {
        wx.clearStorageSync();
        app.clearEntryParams();
        this.setData({ entryParams: null });
        wx.showToast({
            title: '缓存已清除',
            icon: 'success'
        });
    }
});
