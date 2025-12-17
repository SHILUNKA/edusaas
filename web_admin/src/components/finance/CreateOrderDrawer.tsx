'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { 
    X, Loader2, User, Tag, Plus, Trash2, FileText, UploadCloud, CheckCircle 
} from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const BUSINESS_TYPES = [
    { id: 'b2b', label: '企业团建/研学', color: 'text-blue-700 bg-blue-50 border-blue-200' },
    { id: 'b2g', label: '政务/党建',     color: 'text-red-700 bg-red-50 border-red-200' },
    { id: 'b2c', label: '个人/散客',     color: 'text-green-700 bg-green-50 border-green-200' },
];

// Mock 销售人员 (后续可改为从 API 获取)
const MOCK_SALES_TEAM = [
    { id: 'uuid-1', name: '张三 (销售总监)' },
    { id: 'uuid-2', name: '李四 (金牌销售)' },
    { id: 'uuid-3', name: '王五' },
];

export default function CreateOrderDrawer({ isOpen, onClose, onSuccess }: Props) {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const [submitting, setSubmitting] = useState(false);
    
    // 上传状态
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [baseInfo, setBaseInfo] = useState({
        type: 'b2b',
        contact_name: '',
        event_date: new Date().toISOString().split('T')[0],
        expected_attendees: '' as number | string,
        sales_id: '',       
        contract_url: '',   
    });

    const [items, setItems] = useState<{name: string, price: number, q: number}[]>([
        { name: '标准研学课程包', price: 128, q: 0 } 
    ]);

    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.q), 0);

    // 重置
    useEffect(() => {
        if (isOpen) {
            setBaseInfo({
                type: 'b2b',
                contact_name: '',
                event_date: new Date().toISOString().split('T')[0],
                expected_attendees: '',
                sales_id: '',
                contract_url: ''
            });
            setItems([{ name: '', price: 0, q: 1 }]);
        }
    }, [isOpen]);

    // --- 真实上传逻辑 ---
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${API_BASE_URL}/upload`, { 
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                setBaseInfo(prev => ({ ...prev, contract_url: data.url }));
            } else {
                alert("上传失败");
            }
        } catch(e) { console.error(e); } 
        finally { setUploading(false); }
    };

    // ... 增删行逻辑 ...
    const handleAddItem = () => setItems([...items, { name: '', price: 0, q: 1 }]);
    const handleRemoveItem = (index: number) => {
        const newItems = [...items]; newItems.splice(index, 1); setItems(newItems);
    };
    const updateItem = (index: number, field: keyof typeof items[0], value: any) => {
        const newItems = [...items]; newItems[index] = { ...newItems[index], [field]: value }; setItems(newItems);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const payload = {
                type_: baseInfo.type,
                contact_name: baseInfo.contact_name,
                event_date: baseInfo.event_date,
                expected_attendees: Number(baseInfo.expected_attendees) || 0,
                sales_id: baseInfo.sales_id || null,
                contract_url: baseInfo.contract_url || null,
                items: items.filter(i => i.name && i.q > 0).map(i => ({
                    name: i.name, quantity: Number(i.q), unit_price: Number(i.price)
                })),
                total_amount: totalAmount 
            };

            const res = await fetch(`${API_BASE_URL}/finance/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (res.ok) { onSuccess(); } 
            else { alert('创建失败: ' + await res.text()); }
        } catch (e) { console.error(e); } 
        finally { setSubmitting(false); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">新建业务订单</h2>
                        <p className="text-sm text-gray-500 mt-1">支持多行商品明细与合同附件</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={20}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* 1. 基础信息 */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                            <User size={16}/> 客户与归属
                        </h3>
                        {/* ... 表单控件 ... */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">业务类型</label>
                                <div className="flex gap-2">
                                    {BUSINESS_TYPES.map(t => (
                                        <button key={t.id} onClick={() => setBaseInfo({...baseInfo, type: t.id})}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg border ${baseInfo.type === t.id ? t.color : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">客户/单位名称</label>
                                <input type="text" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                                    placeholder="例如：腾讯科技"
                                    value={baseInfo.contact_name} onChange={e => setBaseInfo({...baseInfo, contact_name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">销售归属</label>
                                <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                                    value={baseInfo.sales_id} onChange={e => setBaseInfo({...baseInfo, sales_id: e.target.value})}
                                >
                                    <option value="">-- 选择销售 --</option>
                                    {MOCK_SALES_TEAM.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">活动日期</label>
                                <input type="date" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                                    value={baseInfo.event_date} onChange={e => setBaseInfo({...baseInfo, event_date: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">预计人数</label>
                                <input type="number" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                                    placeholder="0"
                                    value={baseInfo.expected_attendees} onChange={e => setBaseInfo({...baseInfo, expected_attendees: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 my-4"></div>

                    {/* 2. 商品明细 */}
                    <div className="space-y-4">
                         <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                <Tag size={16}/> 订单明细
                            </h3>
                            <button onClick={handleAddItem} className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline">
                                <Plus size={14}/> 添加行
                            </button>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 space-y-3">
                            <div className="grid grid-cols-12 gap-2 text-xs font-bold text-gray-400 px-2">
                                <div className="col-span-5">项目名称</div>
                                <div className="col-span-2 text-right">单价</div>
                                <div className="col-span-2 text-right">数量</div>
                                <div className="col-span-2 text-right">小计</div>
                                <div className="col-span-1"></div>
                            </div>
                            {items.map((item, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-5">
                                        <input type="text" className="w-full p-2 border border-gray-200 rounded text-sm"
                                            value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input type="number" className="w-full p-2 border border-gray-200 rounded text-sm text-right"
                                            value={item.price} onChange={e => updateItem(idx, 'price', parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input type="number" className="w-full p-2 border border-gray-200 rounded text-sm text-right"
                                            value={item.q} onChange={e => updateItem(idx, 'q', parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <div className="col-span-2 text-right text-sm font-bold">
                                        ¥{(item.price * item.q).toLocaleString()}
                                    </div>
                                    <div className="col-span-1 text-center">
                                        {items.length > 1 && <button onClick={() => handleRemoveItem(idx)}><Trash2 size={16} className="text-gray-400"/></button>}
                                    </div>
                                </div>
                            ))}
                            <div className="flex justify-end gap-4 pt-3 border-t mt-2 pr-10 font-bold text-indigo-600">
                                订单总额: ¥{totalAmount.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 my-4"></div>

                    {/* 3. 合同附件 (支持 PDF 真上传) */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                            <FileText size={16}/> 合同/附件
                        </h3>
                        
                        <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" onChange={handleUpload}/>
                        
                        <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                                ${baseInfo.contract_url ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}
                             onClick={() => fileInputRef.current?.click()}
                        >
                            {uploading ? (
                                <div className="flex justify-center text-gray-500"><Loader2 className="animate-spin"/></div>
                            ) : baseInfo.contract_url ? (
                                <div className="flex flex-col items-center gap-2 text-indigo-700">
                                    <CheckCircle size={32} className="text-indigo-500"/>
                                    <div className="font-bold text-sm">已上传合同/附件</div>
                                    <span className="text-xs text-gray-500 break-all">{baseInfo.contract_url.split('/').pop()}</span>
                                    <div className="text-xs bg-white px-2 py-1 rounded border shadow-sm">点击更换</div>
                                </div>
                            ) : (
                                <div className="text-gray-400 text-sm flex flex-col items-center gap-2">
                                    <UploadCloud size={24}/>
                                    <p>点击上传合同 PDF 或 采购单</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                <div className="p-6 border-t bg-gray-50 flex gap-4">
                    <button onClick={onClose} className="flex-1 py-3 font-bold text-gray-600 hover:bg-gray-200 rounded-xl">取消</button>
                    <button onClick={handleSubmit} disabled={submitting} 
                        className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 flex justify-center items-center gap-2">
                        {submitting ? <Loader2 className="animate-spin"/> : '确认创建订单'}
                    </button>
                </div>
            </div>
        </div>
    );
}