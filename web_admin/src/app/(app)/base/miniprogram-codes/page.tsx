'use client';

import { useState } from 'react';
import { QrCode, Download, Copy } from 'lucide-react';
import QRCode from 'qrcode';

const channels = [
    { value: 'poster', label: '📄 海报/传单', color: 'blue' },
    { value: 'wechat', label: '💬 微信分享', color: 'green' },
    { value: 'ad', label: '📺 广告投放', color: 'purple' },
    { value: 'offline', label: '🏢 线下活动', color: 'orange' },
    { value: 'referral', label: '👥 转介绍', color: 'pink' },
];

export default function MiniprogramCodesPage() {
    const [selectedChannel, setSelectedChannel] = useState('poster');
    const [loading, setLoading] = useState(false);
    const [qrcodeData, setQrcodeData] = useState<{ scene: string; imageUrl: string } | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    const handleGenerate = async () => {
        setLoading(true);
        try {
            // TODO: 从session获取base_id
            const baseId = 'test-base-123'; // 临时硬编码

            // 生成场景值
            const scene = `b_${baseId}_c_${selectedChannel}`;

            // 使用qrcode库生成二维码图片
            const canvas = document.createElement('canvas');
            await QRCode.toCanvas(canvas, scene, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF',
                },
            });

            const imageUrl = canvas.toDataURL('image/png');

            setQrcodeData({
                scene,
                imageUrl,
            });

            showMessage('success', '小程序码生成成功！');
        } catch (error) {
            console.error('Generate QR code error:', error);
            showMessage('error', '生成失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (!qrcodeData) return;

        const link = document.createElement('a');
        const channelLabel = channels.find(c => c.value === selectedChannel)?.label || selectedChannel;
        const date = new Date().toISOString().split('T')[0];
        link.download = `小程序码_${channelLabel}_${date}.png`;
        link.href = qrcodeData.imageUrl;
        link.click();

        showMessage('success', '下载成功！');
    };

    const handleCopyScene = () => {
        if (!qrcodeData) return;

        navigator.clipboard.writeText(qrcodeData.scene);
        showMessage('success', '场景值已复制！');
    };

    return (
        <div className="p-6 max-w-4xl mx-auto min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50/20">
            {/* Message Toast */}
            {message && (
                <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                    } z-50 animate-fade-in`}>
                    {message.text}
                </div>
            )}

            {/* Header - Soft UI */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shadow-md shadow-blue-200/40">
                        <QrCode className="w-7 h-7 text-blue-600" />
                    </div>
                    小程序码管理
                </h1>
                <p className="mt-2 text-slate-600 ml-[4.5rem] font-medium">
                    生成用于用户扫码注册的小程序码，支持不同渠道追踪
                </p>
            </div>

            {/* Generator Section - Soft UI */}
            <div className="bg-gradient-to-br from-white to-slate-50/30 rounded-3xl shadow-lg shadow-slate-200/40 border border-slate-100 p-8 mb-6 backdrop-blur-sm">
                <h2 className="text-lg font-semibold mb-4">生成新的小程序码</h2>

                <div className="flex items-end gap-4">
                    {/* Channel Selector */}
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            选择渠道
                        </label>
                        <select
                            value={selectedChannel}
                            onChange={(e) => setSelectedChannel(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-400 focus:border-transparent shadow-sm bg-white transition-all"
                        >
                            {channels.map((channel) => (
                                <option key={channel.value} value={channel.value}>
                                    {channel.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl hover:shadow-lg hover:shadow-blue-300/50 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold hover:scale-105"
                    >
                        {loading ? '生成中...' : '生成'}
                    </button>
                </div>
            </div>

            {/* QR Code Display */}
            {qrcodeData && (
                <div className="bg-gradient-to-br from-white to-slate-50/30 rounded-3xl shadow-lg shadow-slate-200/40 border border-slate-100 p-8 backdrop-blur-sm">
                    <h2 className="text-lg font-semibold mb-4">小程序码</h2>

                    <div className="flex flex-col md:flex-row gap-6">
                        {/* QR Code Image */}
                        <div className="flex-shrink-0">
                            <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200 inline-block">
                                <img
                                    src={qrcodeData.imageUrl}
                                    alt="小程序码"
                                    className="w-64 h-64"
                                />
                            </div>
                        </div>

                        {/* Info and Actions */}
                        <div className="flex-1 flex flex-col justify-between">
                            <div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        场景值
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 px-3 py-2 bg-gray-100 rounded border border-gray-300 text-sm font-mono">
                                            {qrcodeData.scene}
                                        </code>
                                        <button
                                            onClick={handleCopyScene}
                                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                            title="复制场景值"
                                        >
                                            <Copy className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        渠道
                                    </label>
                                    <span className="inline-flex items-center px-4 py-1.5 rounded-2xl text-sm font-bold bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border border-blue-200/50 shadow-sm">
                                        {channels.find(c => c.value === selectedChannel)?.label}
                                    </span>
                                </div>

                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <p className="text-sm text-blue-800">
                                        <strong>使用说明：</strong>
                                        <br />
                                        将此二维码用于{channels.find(c => c.value === selectedChannel)?.label}，用户扫码后将自动关联到当前基地。
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6">
                                <button
                                    onClick={handleDownload}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl hover:shadow-lg hover:shadow-emerald-300/50 shadow-md transition-all font-bold hover:scale-105"
                                >
                                    <Download className="w-5 h-5" />
                                    下载小程序码
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Help Section */}
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-900 mb-2">💡 测试提示</h3>
                <ul className="text-sm text-yellow-800 space-y-1">
                    <li>• 在微信开发者工具中使用编译模式，设置场景值参数进行测试</li>
                    <li>• 场景值格式：b_基地ID_c_渠道</li>
                    <li>• 用户扫码后会自动关联到当前基地和渠道</li>
                </ul>
            </div>
        </div>
    );
}
