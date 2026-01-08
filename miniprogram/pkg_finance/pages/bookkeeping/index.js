import { API_BASE_URL } from '../../../config/index';
import request from '../../../services/request';
import { userStore } from '../../../store/userStore';

Page({
    data: {
        amount: '',
        categories: ['市场推广', '房租水电', '办公用品', '设备采购', '员工薪资', '其他支出'],
        categoryKeys: ['marketing', 'rent', 'office', 'equipment', 'salary', 'other'],
        categoryIndex: 0,
        date: new Date().toISOString().split('T')[0],
        desc: '',
        tempFilePath: '',
        submitLoading: false
    },

    onLoad() { },

    onCategoryChange(e) {
        this.setData({ categoryIndex: e.detail.value });
    },

    onDateChange(e) {
        this.setData({ date: e.detail.value });
    },

    handleUpload() {
        wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            success: (res) => {
                const tempFilePath = res.tempFiles[0].tempFilePath;
                this.setData({ tempFilePath });
            }
        });
    },

    async handleSubmit() {
        if (this.data.submitLoading) return;
        const { amount, date, desc, tempFilePath, categoryKeys, categoryIndex } = this.data;

        // 校验
        if (!amount || parseFloat(amount) <= 0) {
            return wx.showToast({ title: '请输入有效金额', icon: 'none' });
        }
        if (!desc) {
            return wx.showToast({ title: '请填写备注', icon: 'none' });
        }

        this.setData({ submitLoading: true });
        wx.showLoading({ title: '提交中...', mask: true });

        try {
            let proofUrl = null;

            // 1. 如果有图片，先上传
            if (tempFilePath) {
                proofUrl = await this.uploadImage(tempFilePath);
            }

            // 2. 提交记账
            const payload = {
                amount: parseFloat(amount),
                category: categoryKeys[categoryIndex],
                description: desc,
                date: date,
                proof_url: proofUrl // 后端已支持
            };

            await request.post('/api/v1/finance/expenses', payload);

            wx.hideLoading();
            wx.showToast({ title: '记账成功', icon: 'success' });

            setTimeout(() => {
                wx.navigateBack();
            }, 1500);

        } catch (err) {
            wx.hideLoading();
            this.setData({ submitLoading: false });
            console.error('Submit expense failed:', err);
            // request helper handles error toast
        }
    },

    // 上传图片Helper
    uploadImage(filePath) {
        return new Promise((resolve, reject) => {
            wx.uploadFile({
                url: `${API_BASE_URL}/api/v1/upload`,
                filePath: filePath,
                name: 'file',
                header: {
                    // 需要携带 Token
                    'Authorization': `Bearer ${userStore.token}`
                },
                success: (res) => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            // wx.uploadFile 返回的 data 是 String，需要 parse
                            const data = JSON.parse(res.data);
                            resolve(data.url);
                        } catch (e) {
                            reject('JSON Parse error');
                        }
                    } else {
                        console.error('Upload Error:', res);
                        reject('Upload failed code: ' + res.statusCode);
                    }
                },
                fail: (err) => reject(err)
            });
        });
    }
})
