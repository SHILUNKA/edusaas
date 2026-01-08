// services/AuthService_Customer.js - C端认证服务
const API_BASE_URL = 'http://localhost:8000/api/v1';

/**
 * 简单的request封装（C端专用）
 */
function request({ url, method = 'GET', data = {} }) {
    return new Promise((resolve, reject) => {
        const token = wx.getStorageSync('token');

        const header = {
            'Content-Type': 'application/json'
        };

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
                } else if (statusCode === 401) {
                    wx.showToast({ title: '登录已过期', icon: 'none' });
                    reject(new Error('Unauthorized'));
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

class CustomerAuthService {
    /**
     * 微信登录
     */
    wechatLogin() {
        return new Promise((resolve, reject) => {
            wx.showLoading({ title: '登录中...' });

            wx.login({
                success: async (res) => {
                    if (!res.code) {
                        wx.hideLoading();
                        reject(new Error('获取微信登录code失败'));
                        return;
                    }

                    try {
                        // 获取扫码参数
                        const app = getApp();
                        const entryParams = app.getEntryParams() || {};

                        const result = await request({
                            url: '/auth/wechat-login',
                            method: 'POST',
                            data: {
                                code: res.code,
                                base_id: entryParams.base_id   // 只需base_id，后端自动查hq_id
                            }
                        });

                        wx.setStorageSync('token', result.token);
                        wx.setStorageSync('customer', result.customer);
                        wx.hideLoading();

                        // 检查是否需要绑定手机号或学员
                        if (result.needs_phone) {
                            wx.navigateTo({
                                url: '/pages/bind-phone/index'
                            });
                        } else if (result.is_new_user || !result.customer.participants || result.customer.participants.length === 0) {
                            wx.navigateTo({
                                url: '/pkg_customer/pages/profile/participants/index?bind=true'
                            });
                        } else {
                            wx.switchTab({
                                url: '/pkg_customer/pages/home/index'
                            });
                        }

                        resolve(result);
                    } catch (error) {
                        wx.hideLoading();
                        console.error('WeChat login failed:', error);
                        reject(error);
                    }
                },
                fail: (error) => {
                    wx.hideLoading();
                    reject(error);
                }
            });
        });
    }

    /**
     * 绑定手机号
     */
    async bindPhone(phoneNumber, code) {
        try {
            await request({
                url: '/customer/bind-phone',
                method: 'POST',
                data: { phone_number: phoneNumber, code: code }
            });

            const customer = wx.getStorageSync('customer');
            customer.phone_number = phoneNumber;
            wx.setStorageSync('customer', customer);

            return true;
        } catch (error) {
            console.error('Bind phone failed:', error);
            throw error;
        }
    }

    /**
     * 检查登录状态
     */
    isLoggedIn() {
        const token = wx.getStorageSync('token');
        return !!token;
    }

    /**
     * 退出登录
     */
    logout() {
        wx.removeStorageSync('token');
        wx.removeStorageSync('customer');

        const app = getApp();
        if (app && app.clearEntryParams) {
            app.clearEntryParams();
        }

        wx.reLaunch({
            url: '/pages/login/index'
        });
    }
}

module.exports = new CustomerAuthService();
