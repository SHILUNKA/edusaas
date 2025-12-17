'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/config';
import { 
    Box, Search, AlertTriangle, 
    ArrowDownCircle, ArrowUpCircle, // 用箭头图标代替包裹图标，意向更明确
    Package, Loader2, RefreshCw, Info
} from 'lucide-react';

interface InventoryItem {
    product_id: string;
    name: string;
    sku: string | null;
    image_url: string | null;
    type: 'material' | 'service';
    quantity: number;
    last_updated_at: string;
}

export default function BaseStockPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;

    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // 操作弹窗状态
    // out = 出库(借出/消耗), in = 入库(归还/盘盈)
    const [actionType, setActionType] = useState<'out' | 'in' | null>(null); 
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [qty, setQty] = useState(1);
    
    // 出库时的子类型: consume=直接消耗, borrow=借用
    const [outSubtype, setOutSubtype] = useState<'consume' | 'borrow'>('consume');
    const [reasonNote, setReasonNote] = useState(''); // 备注/借用人
    
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { if (token) fetchInventory(); }, [token]);

    const fetchInventory = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/base/inventory`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setItems(await res.json());
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleSubmit = async () => {
        if (!selectedItem || !actionType) return;
        setSubmitting(true);

        try {
            // 构造符合逻辑的 reason 字符串
            let finalReason = reasonNote;
            if (actionType === 'out') {
                const prefix = outSubtype === 'borrow' ? '【借出】' : '【消耗】';
                finalReason = `${prefix} ${reasonNote || (outSubtype === 'borrow' ? '未登记借用人' : '教学使用')}`;
            } else {
                finalReason = `【归还/入库】 ${reasonNote || '归还入库'}`;
            }

            // ★★★ 修改点开始：根据类型选择不同的 API 接口 ★★★
            let url = '';
            
            if (actionType === 'out') {
                // 出库 -> 调用 consume 接口
                url = `${API_BASE_URL}/base/inventory/${selectedItem.product_id}/consume`;
            } else {
                // 入库 -> 调用 restock 接口 (现在后端已经有了！)
                url = `${API_BASE_URL}/base/inventory/${selectedItem.product_id}/restock`;
            }
            // ★★★ 修改点结束 ★★★

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ quantity: Number(qty), reason: finalReason })
            });

            if (res.ok) {
                alert(`✅ ${actionType === 'out' ? '出库' : '入库'}成功`);
                setSelectedItem(null);
                setActionType(null);
                setReasonNote('');
                fetchInventory(); // 刷新列表看最新库存
            } else {
                // 读取后端返回的错误信息（可选）
                const err = await res.json().catch(() => ({})); 
                if (res.status === 409) {
                    alert("❌ 操作失败：库存不足");
                } else {
                    alert("❌ 操作失败，请重试");
                }
            }
        } catch (e) { alert("网络错误"); }
        setSubmitting(false);
    };

    const filteredItems = items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-indigo-600"/></div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header: 强调这是“作业台”而非“报表” */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Box className="text-indigo-600" /> 物资作业台
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">处理物资的借出、消耗与归还，实时同步库存。</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchInventory} className="p-2 border rounded-lg hover:bg-gray-50 text-gray-500" title="刷新库存"><RefreshCw size={18}/></button>
                    <Link href="/base/supply/market" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-2">
                        <span>+ 去商城补货</span>
                    </Link>
                </div>
            </div>

            {/* 搜索栏 */}
            <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
                    <input 
                        type="text" 
                        placeholder="输入物资名称..." 
                        className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                {/* 状态提示 */}
                <div className="flex items-center gap-4 text-sm font-bold text-gray-500">
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> 库存充足</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> 缺货预警</div>
                </div>
            </div>

            {/* 列表: 采用更清晰的“卡片式列表”设计 */}
            <div className="space-y-3">
                {filteredItems.map(item => (
                    <div key={item.product_id} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center gap-4 md:gap-6">
                        {/* 图片 */}
                        <div className="w-16 h-16 bg-gray-100 rounded-lg shrink-0 overflow-hidden">
                            {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover"/> : <Package className="p-3 text-gray-300 w-full h-full"/>}
                        </div>

                        {/* 信息 */}
                        <div className="flex-1 text-center md:text-left">
                            <h3 className="font-bold text-gray-900 text-lg">{item.name}</h3>
                            <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-gray-500 mt-1">
                                <span className="bg-gray-100 px-2 py-0.5 rounded">{item.type === 'material' ? '实物' : '服务'}</span>
                                <span className="font-mono">{item.sku || 'NO-SKU'}</span>
                            </div>
                        </div>

                        {/* 库存展示 (带进度条) */}
                        <div className="w-full md:w-48 text-center">
                            <div className="flex justify-between text-xs mb-1 font-bold text-gray-500">
                                <span>剩余库存</span>
                                <span className={item.quantity < 10 ? 'text-red-600' : 'text-gray-900'}>{item.quantity} 件</span>
                            </div>
                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full ${item.quantity < 10 ? 'bg-red-500' : 'bg-green-500'}`} 
                                    style={{ width: `${Math.min(100, item.quantity)}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* 操作区 (分离出库和入库) */}
                        <div className="flex gap-2 w-full md:w-auto">
                            <button 
                                onClick={() => { setSelectedItem(item); setActionType('out'); setQty(1); setOutSubtype('consume'); }}
                                className="flex-1 md:flex-none px-4 py-2 bg-red-50 text-red-700 border border-red-100 rounded-lg text-sm font-bold hover:bg-red-100 flex items-center justify-center gap-2 active:scale-95 transition-all"
                            >
                                <ArrowDownCircle size={16}/> 出库/借用
                            </button>
                            
                            <button 
                                onClick={() => { setSelectedItem(item); setActionType('in'); setQty(1); }}
                                className="flex-1 md:flex-none px-4 py-2 bg-green-50 text-green-700 border border-green-100 rounded-lg text-sm font-bold hover:bg-green-100 flex items-center justify-center gap-2 active:scale-95 transition-all"
                            >
                                <ArrowUpCircle size={16}/> 归还/入库
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {filteredItems.length === 0 && !loading && (
                <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed">
                    没有找到该物资，请尝试更换关键词。
                </div>
            )}

            {/* 操作弹窗 (彻底重做，更像个Wizard) */}
            {selectedItem && actionType && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-md p-0 shadow-2xl overflow-hidden animate-in zoom-in-95">
                        {/* 弹窗 Header */}
                        <div className={`p-4 flex justify-between items-center ${actionType === 'out' ? 'bg-red-50' : 'bg-green-50'}`}>
                            <h3 className={`text-lg font-bold flex items-center gap-2 ${actionType === 'out' ? 'text-red-800' : 'text-green-800'}`}>
                                {actionType === 'out' ? <ArrowDownCircle/> : <ArrowUpCircle/>}
                                {actionType === 'out' ? '物资出库 (借出/消耗)' : '物资入库 (归还)'}
                            </h3>
                            <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* 物资卡片 */}
                            <div className="flex gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="w-12 h-12 bg-white rounded overflow-hidden shrink-0 border">
                                    {selectedItem.image_url && <img src={selectedItem.image_url} className="w-full h-full object-cover"/>}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900">{selectedItem.name}</div>
                                    <div className="text-xs text-gray-500">当前仓库剩余: {selectedItem.quantity}</div>
                                </div>
                            </div>

                            {/* 1. 如果是出库，询问类型 */}
                            {actionType === 'out' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2">出库类型</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button 
                                            onClick={() => setOutSubtype('consume')}
                                            className={`p-3 rounded-xl border text-left transition-all ${outSubtype === 'consume' ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'border-gray-200 hover:bg-gray-50'}`}
                                        >
                                            <div className="font-bold text-gray-900 text-sm">🔥 消耗/领用</div>
                                            <div className="text-xs text-gray-500 mt-1">无需归还 (如: 纸张/耗材)</div>
                                        </button>
                                        <button 
                                            onClick={() => setOutSubtype('borrow')}
                                            className={`p-3 rounded-xl border text-left transition-all ${outSubtype === 'borrow' ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-gray-200 hover:bg-gray-50'}`}
                                        >
                                            <div className="font-bold text-gray-900 text-sm">🤝 借出使用</div>
                                            <div className="text-xs text-gray-500 mt-1">需要归还 (如: 无人机)</div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 2. 数量选择 */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2">
                                    {actionType === 'out' ? '出库数量' : '入库数量'}
                                </label>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-12 h-12 border rounded-xl hover:bg-gray-50 font-bold text-xl">-</button>
                                    <input 
                                        type="number" 
                                        value={qty} 
                                        onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="flex-1 h-12 text-center border rounded-xl font-bold text-2xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <button onClick={() => setQty(qty + 1)} className="w-12 h-12 border rounded-xl hover:bg-gray-50 font-bold text-xl">+</button>
                                </div>
                            </div>

                            {/* 3. 备注/原因 */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2">
                                    {actionType === 'out' 
                                        ? (outSubtype === 'borrow' ? '借用人姓名 / 班级' : '消耗用途说明') 
                                        : '归还人 / 入库说明'
                                    }
                                </label>
                                <input 
                                    type="text" 
                                    value={reasonNote}
                                    onChange={e => setReasonNote(e.target.value)}
                                    placeholder={
                                        actionType === 'out' 
                                        ? (outSubtype === 'borrow' ? '例如: 张三老师 / 三年二班' : '例如: 航模课实验消耗') 
                                        : '例如: 张三归还 / 新购入库'
                                    }
                                    className="w-full p-3 border rounded-xl text-sm outline-none focus:border-indigo-500 bg-gray-50 focus:bg-white transition-colors"
                                />
                            </div>

                            {/* 提示信息 */}
                            {actionType === 'out' && outSubtype === 'borrow' && (
                                <div className="bg-orange-50 p-3 rounded-lg flex gap-2 text-xs text-orange-700">
                                    <Info size={16} className="shrink-0"/>
                                    <span>请务必填写“借用人”，以便后续核查未归还物资。</span>
                                </div>
                            )}

                            <button 
                                onClick={handleSubmit}
                                disabled={submitting || (actionType === 'out' && qty > selectedItem.quantity)}
                                className={`w-full py-3.5 text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95 flex justify-center items-center gap-2 ${actionType === 'out' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                            >
                                {submitting ? <Loader2 className="animate-spin"/> : '确认执行'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}