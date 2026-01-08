// pages/redirect/index.js - 快速跳转到C端首页
Page({
    onLoad() {
        console.log('🔄 [Redirect] 准备跳转到C端首页...');
        setTimeout(() => {
            wx.redirectTo({
                url: '/pkg_customer/pages/home/index',
                success: () => console.log('✅ [Redirect] 跳转成功'),
                fail: (err) => console.error('❌ [Redirect] 跳转失败:', err)
            });
        }, 100);
    }
});
