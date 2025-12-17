/*
 * 总部管理: 全网固定资产驾驶舱 (V16.5 - 修复类型创建功能)
 * 路径: /hq/assets
 */
'use client'; 

import { useState, useEffect, useMemo, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { 
    Package, Filter, Search, Plus, Box, Layers, 
    ArrowRightLeft, Trash2, DollarSign, Tag, AlertCircle,
    QrCode, Download, Printer, Wrench, Settings, X
} from 'lucide-react';

// --- 类型定义 ---
interface AssetDetail {
    id: string;
    name: string;
    model_number: string | null;
    serial_number: string | null;
    status: string; 
    type_name: string; 
    base_name: string | null;
    base_id: string | null;
    purchase_date: string | null;
    price_in_cents: number;
    warranty_until: string | null;
}
interface AssetType { id: string; name_key: string; description_key: string | null; }
interface Base { id: string; name: string; }

// --- 主页面 ---
export default function TenantAssetsPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const API = API_BASE_URL;

    // 数据
    const [assets, setAssets] = useState<AssetDetail[]>([]);
    const [types, setTypes] = useState<AssetType[]>([]);
    const [bases, setBases] = useState<Base[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // 筛选
    const [selectedTypeId, setSelectedTypeId] = useState<string>("all");
    const [filterBase, setFilterBase] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    // 弹窗状态
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isTypeModalOpen, setIsTypeModalOpen] = useState(false); // (★ 新增: 类型管理弹窗)
    const [transferAsset, setTransferAsset] = useState<AssetDetail | null>(null);
    const [qrAsset, setQrAsset] = useState<AssetDetail | null>(null);

    // 1. 初始化数据
    const fetchData = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const [assetsRes, typesRes, basesRes] = await Promise.all([
                fetch(`${API}/hq/assets`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API}/asset-types`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API}/bases`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (assetsRes.ok) setAssets(await assetsRes.json());
            if (typesRes.ok) setTypes(await typesRes.json());
            if (basesRes.ok) setBases(await basesRes.json());
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchData(); }, [token]);

    // 2. 过滤
    const filteredAssets = useMemo(() => {
        return assets.filter(a => {
            const matchType = selectedTypeId === 'all' || types.find(t => t.name_key === a.type_name)?.id === selectedTypeId;
            const matchBase = filterBase === 'all' || a.base_id === filterBase;
            const q = searchQuery.toLowerCase();
            const matchSearch = !q || a.name.toLowerCase().includes(q) || a.serial_number?.toLowerCase().includes(q);
            return matchType && matchBase && matchSearch;
        });
    }, [assets, selectedTypeId, filterBase, searchQuery, types]);

    // 3. KPI 计算
    const stats = useMemo(() => {
        const totalValue = filteredAssets.reduce((acc, cur) => acc + cur.price_in_cents, 0);
        const totalCount = filteredAssets.length;
        const inStockCount = filteredAssets.filter(a => a.status === 'in_stock').length;
        const maintenanceCount = filteredAssets.filter(a => a.status === 'in_maintenance').length;

        return {
            totalValue: totalValue / 100,
            count: totalCount,
            idleRate: totalCount > 0 ? Math.round((inStockCount / totalCount) * 100) : 0,
            maintenanceRate: totalCount > 0 ? Math.round((maintenanceCount / totalCount) * 100) : 0,
        };
    }, [filteredAssets]);

    // 4. 导出
    const handleExport = () => {
        if (filteredAssets.length === 0) return alert("当前列表为空");
        const headers = "资产名称,序列号,型号,分类,归属基地,状态,原值(元),购入日期\n";
        const rows = filteredAssets.map(a => 
            `${a.name},${a.serial_number||''},${a.model_number||''},${a.type_name},${a.base_name||'未分配'},${a.status},${(a.price_in_cents/100).toFixed(2)},${a.purchase_date||''}`
        ).join("\n");
        const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `资产台账_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
    };

    const handleDelete = async (id: string) => {
        if(!confirm("⚠️ 确定报废/删除此资产吗？")) return;
        try {
            await fetch(`${API}/hq/assets/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setAssets(prev => prev.filter(a => a.id !== id));
        } catch(e) { alert("错误"); }
    };

    return (
        <div className="flex h-[calc(100vh-64px)] bg-gray-50">
            
            {/* --- 左侧: 分类树 --- */}
            <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-5 border-b border-gray-100">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2">
                        <Layers className="text-indigo-600"/> 资产分类
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    <button 
                        onClick={() => setSelectedTypeId("all")}
                        className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex justify-between ${selectedTypeId === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <span>全部资产</span>
                        <span className="text-xs bg-white px-2 py-0.5 rounded-full border">{assets.length}</span>
                    </button>
                    <div className="pt-2 px-4 text-xs font-bold text-gray-400 uppercase">Types</div>
                    {types.map(t => (
                        <button 
                            key={t.id}
                            onClick={() => setSelectedTypeId(t.id)}
                            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${selectedTypeId === t.id ? 'bg-white border border-indigo-200 text-indigo-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50 border border-transparent'}`}
                        >
                            {t.name_key}
                        </button>
                    ))}
                </div>
                <div className="p-4 border-t bg-gray-50">
                    {/* (★ 绑定弹窗事件) */}
                    <button onClick={() => setIsTypeModalOpen(true)} className="w-full py-2 text-xs text-indigo-600 border border-indigo-200 rounded hover:bg-white transition-colors flex items-center justify-center gap-1">
                        <Settings size={12}/> 管理分类定义
                    </button>
                </div>
            </div>

            {/* --- 右侧: 核心工作区 --- */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* (KPI 和 工具栏 保持不变) */}
                <div className="bg-white border-b border-gray-200 px-8 py-6">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">固定资产台账</h1>
                            <p className="text-sm text-gray-500 mt-1">全网资产监控与调拨中心。</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={handleExport} className="bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-full font-medium hover:bg-gray-50 flex items-center gap-2 text-sm">
                                <Download size={16}/> 导出台账
                            </button>
                            <button onClick={() => setIsCreateOpen(true)} className="bg-black text-white px-5 py-2.5 rounded-full font-bold hover:bg-gray-800 flex items-center gap-2 shadow-lg hover:scale-105 transition-all">
                                <Plus size={18}/> 录入新资产
                            </button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-6">
                        <KpiCard label="资产总估值" value={`¥${stats.totalValue.toLocaleString()}`} icon={<DollarSign className="text-green-600"/>} bg="bg-green-50"/>
                        <KpiCard label="实物资产总数" value={stats.count} icon={<Box className="text-blue-600"/>} bg="bg-blue-50"/>
                        <KpiCard label="闲置率" value={`${stats.idleRate}%`} icon={<AlertCircle className="text-gray-500"/>} bg="bg-gray-50" sub="库存/总数"/>
                        <KpiCard label="维修率" value={`${stats.maintenanceRate}%`} icon={<Wrench className="text-orange-600"/>} bg="bg-orange-50" sub="需关注设备健康"/>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col px-8 py-6">
                    <div className="flex gap-4 mb-4">
                        <div className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg w-64">
                            <Filter size={16} className="text-gray-400"/>
                            <select value={filterBase} onChange={e => setFilterBase(e.target.value)} className="w-full bg-transparent outline-none text-sm text-gray-700">
                                <option value="all">全部分店</option>
                                {bases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input type="text" placeholder="搜索资产名称、型号或序列号..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"/>
                        </div>
                    </div>

                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-auto h-full">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium sticky top-0">
                                    <tr>
                                        <th className="px-6 py-4">资产详情</th>
                                        <th className="px-6 py-4">分类</th>
                                        <th className="px-6 py-4">当前位置</th>
                                        <th className="px-6 py-4">状态</th>
                                        <th className="px-6 py-4">原值</th>
                                        <th className="px-6 py-4 text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredAssets.map(a => (
                                        <tr key={a.id} className="hover:bg-indigo-50/30 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">{a.name}</div>
                                                <div className="text-xs text-gray-400 mt-0.5 font-mono">SN: {a.serial_number || 'N/A'}</div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs"><Tag size={10}/> {a.type_name}</span>
                                            </td>
                                            <td className="px-6 py-4">{a.base_name || '未分配'}</td>
                                            <td className="px-6 py-4"><StatusBadge status={a.status}/></td>
                                            <td className="px-6 py-4 font-mono text-gray-600">¥ {(a.price_in_cents/100).toFixed(2)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2 opacity-80 group-hover:opacity-100">
                                                    <button onClick={() => setQrAsset(a)} className="p-1.5 bg-white border border-gray-200 text-gray-600 rounded hover:border-indigo-300 transition-colors"><QrCode size={14}/></button>
                                                    <button onClick={() => setTransferAsset(a)} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded hover:border-indigo-300 hover:text-indigo-600 transition-colors text-xs flex items-center gap-1"><ArrowRightLeft size={12}/> 调拨</button>
                                                    <button onClick={() => handleDelete(a.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={14}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* 弹窗: 录入新资产 */}
            {isCreateOpen && <CreateAssetModal token={token} types={types} bases={bases} onClose={() => setIsCreateOpen(false)} onSuccess={fetchData}/>}

            {/* 弹窗: 调拨资产 */}
            {transferAsset && <TransferAssetModal token={token} asset={transferAsset} bases={bases} onClose={() => setTransferAsset(null)} onSuccess={fetchData}/>}

            {/* 弹窗: 二维码 */}
            {qrAsset && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setQrAsset(null)}>
                    <div className="bg-white p-8 rounded-xl shadow-2xl w-80 text-center animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-800 mb-1">资产固定标签</h3>
                        <div className="border-2 border-black p-4 rounded-lg mb-6 bg-white mt-4">
                            <div className="flex justify-center mb-3">
                                <div className="w-32 h-32 bg-gray-100 flex items-center justify-center text-xs text-gray-400">[二维码]</div>
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-bold text-black">{qrAsset.name}</div>
                                <div className="text-xs text-gray-600 mt-1 font-mono">SN: {qrAsset.serial_number || 'N/A'}</div>
                            </div>
                        </div>
                        <button onClick={() => window.print()} className="w-full py-2 bg-black text-white rounded-lg">打印标签</button>
                    </div>
                </div>
            )}

            {/* (★ 新增: 弹窗: 管理资产分类) */}
            {isTypeModalOpen && (
                <ManageTypesModal 
                    token={token} 
                    types={types} 
                    onClose={() => setIsTypeModalOpen(false)} 
                    onSuccess={fetchData} 
                />
            )}
        </div>
    );
}

// --- 子组件 ---
function KpiCard({ label, value, icon, bg, sub }: any) {
    return (
        <div className="p-5 rounded-xl border shadow-sm bg-white flex items-start justify-between hover:shadow-md transition-shadow">
            <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{label}</div>
                <div className="text-2xl font-extrabold text-gray-900">{value}</div>
                {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
            </div>
            <div className={`p-3 rounded-lg ${bg}`}>{icon}</div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const map: any = {
        'in_stock': { label: '在库闲置', cls: 'bg-green-100 text-green-700' },
        'in_use': { label: '使用中', cls: 'bg-blue-100 text-blue-700' },
        'in_maintenance': { label: '维修中', cls: 'bg-orange-100 text-orange-700' },
        'retired': { label: '已报废', cls: 'bg-gray-100 text-gray-500' },
    };
    const conf = map[status] || { label: status, cls: 'bg-gray-100' };
    return <span className={`px-2 py-1 rounded text-xs font-medium ${conf.cls}`}>{conf.label}</span>;
}

// --- 内部弹窗: 创建资产 ---
function CreateAssetModal({ token, types, bases, onClose, onSuccess }: any) {
    const [name, setName] = useState("");
    const [sn, setSn] = useState("");
    const [price, setPrice] = useState("");
    const [typeId, setTypeId] = useState(types[0]?.id || "");
    const [baseId, setBaseId] = useState(bases[0]?.id || "");
    const [loading, setLoading] = useState(false);
    const API = API_BASE_URL;
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API}/hq/assets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name, serial_number: sn || null, price: parseFloat(price) || 0, asset_type_id: typeId || null, base_id: baseId || null, status: 'in_stock' })
            });
            if(res.ok) { onSuccess(); onClose(); } else alert("失败");
        } catch(e) { alert("错误"); } finally { setLoading(false); }
    };
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-xl animate-in zoom-in-95">
                <h3 className="text-lg font-bold mb-4">📦 录入新资产</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label className="text-xs font-bold text-gray-500 block mb-1">资产名称</label><input required value={name} onChange={e=>setName(e.target.value)} className="w-full p-2 border rounded"/></div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs font-bold text-gray-500 block mb-1">分类</label><select value={typeId} onChange={e=>setTypeId(e.target.value)} className="w-full p-2 border rounded">{types.map((t:any)=><option key={t.id} value={t.id}>{t.name_key}</option>)}</select></div>
                        <div><label className="text-xs font-bold text-gray-500 block mb-1">初始位置</label><select value={baseId} onChange={e=>setBaseId(e.target.value)} className="w-full p-2 border rounded">{bases.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs font-bold text-gray-500 block mb-1">序列号 (S/N)</label><input value={sn} onChange={e=>setSn(e.target.value)} className="w-full p-2 border rounded"/></div>
                        <div><label className="text-xs font-bold text-gray-500 block mb-1">采购价 (元)</label><input type="number" value={price} onChange={e=>setPrice(e.target.value)} className="w-full p-2 border rounded"/></div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded">取消</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800">{loading?'提交中...':'确认录入'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// --- 内部弹窗: 调拨 ---
function TransferAssetModal({ token, asset, bases, onClose, onSuccess }: any) {
    const [targetBase, setTargetBase] = useState(bases[0]?.id || "");
    const [loading, setLoading] = useState(false);
    const API = API_BASE_URL;
    const handleTransfer = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/hq/assets/${asset.id}/transfer`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ target_base_id: targetBase })
            });
            if(res.ok) { onSuccess(); onClose(); alert(`成功调拨至新基地`); } else alert("调拨失败");
        } catch(e) { alert("错误"); } finally { setLoading(false); }
    };
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-xl animate-in zoom-in-95">
                <h3 className="text-lg font-bold mb-2">🚚 资产调拨</h3>
                <p className="text-sm text-gray-500 mb-4">将 <b>{asset.name}</b> 转移至其他校区。</p>
                <div className="bg-gray-50 p-3 rounded mb-4 text-sm"><span className="text-gray-400">当前位置:</span> {asset.base_name || "未分配"}</div>
                <label className="text-xs font-bold text-gray-500 block mb-1">目标基地</label>
                <select value={targetBase} onChange={e=>setTargetBase(e.target.value)} className="w-full p-2 border rounded mb-6">{bases.filter((b:any) => b.id !== asset.base_id).map((b:any) => (<option key={b.id} value={b.id}>{b.name}</option>))}</select>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded">取消</button>
                    <button onClick={handleTransfer} disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">{loading?'调拨中...':'确认调拨'}</button>
                </div>
            </div>
        </div>
    );
}

// --- (★ 新增) 内部弹窗: 管理资产分类 ---
function ManageTypesModal({ token, types, onClose, onSuccess }: any) {
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [loading, setLoading] = useState(false);
    const API = API_BASE_URL;

    const handleAddType = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API}/asset-types`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name_key: name, description_key: desc || null })
            });
            if(res.ok) { 
                alert("分类创建成功"); 
                setName(""); setDesc("");
                onSuccess(); // 刷新父页面数据
            } else alert("创建失败");
        } catch(e) { alert("错误"); } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-xl animate-in zoom-in-95 flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <h3 className="text-lg font-bold">🏷️ 资产分类管理</h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600"/></button>
                </div>

                {/* 列表展示 (简单版) */}
                <div className="flex-1 overflow-y-auto mb-6 bg-gray-50 rounded-lg p-2 border border-gray-100">
                    {types.length === 0 ? <p className="text-center text-gray-400 py-4 text-xs">暂无分类</p> : (
                        <ul className="space-y-1">
                            {types.map((t: any) => (
                                <li key={t.id} className="bg-white p-2 rounded border border-gray-100 flex justify-between items-center text-sm">
                                    <span className="font-medium text-gray-700">{t.name_key}</span>
                                    <span className="text-xs text-gray-400">{t.description_key}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* 添加表单 */}
                <form onSubmit={handleAddType} className="space-y-3 border-t pt-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">新分类名称</label>
                        <input required value={name} onChange={e=>setName(e.target.value)} className="w-full p-2 border rounded text-sm" placeholder="例如: 航模器材"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">描述 (可选)</label>
                        <input value={desc} onChange={e=>setDesc(e.target.value)} className="w-full p-2 border rounded text-sm"/>
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 text-sm">
                        {loading ? '添加中...' : '确认添加'}
                    </button>
                </form>
            </div>
        </div>
    );
}