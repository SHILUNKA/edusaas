// pages/launch/index.js - 智能路由启动页
Page({
  data: {},

  onLoad(options) {
    console.log('Launch page - options:', options);

    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync();
    const isDevTools = systemInfo.platform === 'devtools';

    // 获取扫码参数
    const app = getApp();
    const entryParams = app.getEntryParams();

    console.log('Environment:', {
      platform: systemInfo.platform,
      isDevTools,
      hasEntryParams: !!entryParams,
      entryParams
    });

    // 🔧 开发模式：支持自动跳转到C端首页
    const DEV_MODE_AUTO_C_END = true;

    if (DEV_MODE_AUTO_C_END) {
      console.log('🔧 开发模式：自动跳转到C端首页');
      wx.redirectTo({
        url: '/pkg_customer/pages/home/index'
      });
      return;
    }

    // 智能路由逻辑
    if (isDevTools) {
      // 开发环境：跳转到管理员登录页
      console.log('→ 开发环境，跳转到管理员登录');
      wx.redirectTo({
        url: '/pages/login/index'
      });
    } else {
      // 真机环境：跳转到C端用户登录页
      console.log('→ 真机环境，跳转到C端登录');
      wx.redirectTo({
        url: '/pages/customer-login/index'
      });
    }
  }
});