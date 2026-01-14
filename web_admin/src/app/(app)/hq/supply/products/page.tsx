'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import {
    Plus,
    Search,
    Edit,
    Power,
    Package,
    Zap,
    Save,
    X,
    Loader2,
    CheckCircle,
    Ban
} from 'lucide-react';

// 商品接口定义
interface Product {
    id: string;
    name: string;
    sku: string;
    type: 'material' | 'service';
    price_cents: number;
    stock_quantity: number;
    image_url: string;
    is_active: boolean; // 必须字段
}

export default function HQProductManagerPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // 编辑/新增表单状态
    const [editingProduct, setEditingProduct] = useState<Partial<Product>>({});
    const [isEditMode, setIsEditMode] = useState(false);

    useEffect(() => { if (token) fetchProducts(); }, [token]);

    // 1. 获取所有商品
    const fetchProducts = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/supply/products`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setProducts(await res.json());
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    // 2. 列表快速切换上下架
    const toggleStatus = async (product: Product) => {
        if (!confirm(`确定要${product.is_active ? '下架' : '上架'}该商品吗？`)) return;
        try {
            await fetch(`${API_BASE_URL}/supply/products/${product.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ is_active: !product.is_active })
            });
            fetchProducts();
        } catch (e) { alert("操作失败"); }
    };

    // 3. 保存商品 (新增或更新)
    const handleSave = async () => {
        const url = isEditMode
            ? `${API_BASE_URL}/supply/products/${editingProduct.id}`
            : `${API_BASE_URL}/supply/products`;

        const method = isEditMode ? 'PUT' : 'POST';

        // 1. 构造 payload
        const payload = {
            ...editingProduct,
            price_cents: Math.round((editingProduct.price_cents || 0) * 100)
        };

        // ★★★ 2. 增加这行调试日志 ★★★
        console.log("准备提交的数据 Payload:", payload);

        // 简单的表单校验
        if (!editingProduct.name) return alert("请输入商品名称");

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    ...editingProduct,
                    // 前端输入的是元，后端存的是分
                    price_cents: Math.round((editingProduct.price_cents || 0) * 100)
                })
            });

            if (res.ok) {
                setIsModalOpen(false);
                fetchProducts();
            } else {
                alert("保存失败");
            }
        } catch (e) { alert("网络错误"); }
    };

    // ★★★ [步骤 1] 修复：打开新增弹窗时，强制初始化 is_active 为 true ★★★
    const openCreate = () => {
        setEditingProduct({
            type: 'material',
            stock_quantity: 100,
            is_active: true, // <--- 关键修改：默认上架
            price_cents: 0
        });
        setIsEditMode(false);
        setIsModalOpen(true);
    };

    // 打开编辑弹窗
    const openEdit = (p: Product) => {
        setEditingProduct({
            ...p,
            price_cents: p.price_cents / 100 // 转回元显示
        });
        setIsEditMode(true);
        setIsModalOpen(true);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-purple-50/20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shadow-md shadow-indigo-200/40">
                            <Package className="text-indigo-600" size={24} />
                        </div>
                        总部商品库管理
                    </h1>
                    <p className="text-sm text-slate-500 font-medium mt-2 ml-14">管理供应链商品、调整价格与库存</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-2xl font-bold hover:shadow-lg hover:shadow-indigo-300/50 shadow-md transition-all hover:scale-105"
                >
                    <Plus size={18} /> 新增商品
                </button>
            </div>

            <div className="bg-gradient-to-br from-white to-slate-50/30 border border-slate-100 rounded-3xl shadow-lg shadow-slate-200/40 backdrop-blur-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-slate-100 text-slate-600 font-bold text-xs uppercase">
                        <tr>
                            <th className="p-4">商品名称 / SKU</th>
                            <th className="p-4">类型</th>
                            <th className="p-4">批发单价</th>
                            <th className="p-4">当前库存</th>
                            <th className="p-4">状态</th>
                            <th className="p-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="animate-spin inline" /></td></tr> : products.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4">
                                    <div className="font-bold text-gray-900">{p.name}</div>
                                    <div className="text-xs text-gray-400 font-mono">{p.sku || '-'}</div>
                                </td>
                                <td className="p-4">
                                    {p.type === 'service'
                                        ? <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs font-bold"><Zap size={10} /> 服务</span>
                                        : <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold"><Package size={10} /> 实物</span>
                                    }
                                </td>
                                <td className="p-4 font-mono font-bold text-orange-600">
                                    ¥{(p.price_cents / 100).toFixed(2)}
                                </td>
                                <td className="p-4">
                                    <span className={`font-bold ${p.stock_quantity < 10 ? 'text-red-600' : 'text-green-600'}`}>
                                        {p.stock_quantity}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <span className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm ${p.is_active ? 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 border border-emerald-200/50' : 'bg-gradient-to-r from-gray-100 to-slate-100 text-slate-600 border border-slate-200/50'}`}>
                                        {p.is_active ? '已上架' : '已下架'}
                                    </span>
                                </td>
                                <td className="p-4 text-right flex justify-end gap-2">
                                    <button onClick={() => openEdit(p)} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-xl transition-all hover:shadow-sm">
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={() => toggleStatus(p)}
                                        className={`${p.is_active ? 'text-red-500 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'} p-2 rounded-xl transition-all hover:shadow-sm`}
                                        title={p.is_active ? "点击下架" : "点击上架"}
                                    >
                                        <Power size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 新增/编辑弹窗 */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-md">
                    <div className="bg-gradient-to-br from-white to-slate-50/50 rounded-3xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[90vh] border border-slate-100/50">
                        <div className="flex justify-between items-center mb-6 pb-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50 -mx-6 -mt-6 px-6 pt-6 rounded-t-3xl">
                            <h3 className="text-xl font-bold text-slate-800">{isEditMode ? '编辑商品' : '新增商品'}</h3>
                            <button onClick={() => setIsModalOpen(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">商品名称</label>
                                <input className="w-full border rounded-lg p-2 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={editingProduct.name || ''}
                                    onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                                    placeholder="例如：大疆无人机 Tello..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">类型</label>
                                    <select className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={editingProduct.type}
                                        onChange={e => setEditingProduct({ ...editingProduct, type: e.target.value as any })}
                                    >
                                        <option value="material">📦 实物商品</option>
                                        <option value="service">⚡ 虚拟服务</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">SKU (库存编码)</label>
                                    <input className="w-full border rounded-lg p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={editingProduct.sku || ''}
                                        onChange={e => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                                        placeholder="例如：MAT-001"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">批发价 (元)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">¥</span>
                                        <input type="number" className="w-full border rounded-lg pl-8 p-2 font-bold text-orange-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={editingProduct.price_cents || ''}
                                            onChange={e => setEditingProduct({ ...editingProduct, price_cents: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">库存数量</label>
                                    <input type="number" className="w-full border rounded-lg p-2 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={editingProduct.stock_quantity || ''}
                                        onChange={e => setEditingProduct({ ...editingProduct, stock_quantity: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            {/* ★★★ [步骤 2] 修复：增加直观的状态切换开关 ★★★ */}
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <label className="text-xs font-bold text-gray-500 block mb-3">上架状态</label>
                                <div className="flex items-center gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className="relative flex items-center">
                                            <input
                                                type="radio"
                                                name="is_active"
                                                checked={editingProduct.is_active === true}
                                                onChange={() => setEditingProduct({ ...editingProduct, is_active: true })}
                                                className="peer w-5 h-5 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <span className="text-sm font-bold text-gray-700 peer-checked:text-green-600 flex items-center gap-1">
                                            <CheckCircle size={16} /> 立即上架
                                        </span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className="relative flex items-center">
                                            <input
                                                type="radio"
                                                name="is_active"
                                                checked={editingProduct.is_active === false}
                                                onChange={() => setEditingProduct({ ...editingProduct, is_active: false })}
                                                className="peer w-5 h-5 text-red-600 border-gray-300 focus:ring-red-500"
                                            />
                                        </div>
                                        <span className="text-sm font-bold text-gray-500 peer-checked:text-red-600 flex items-center gap-1">
                                            <Ban size={16} /> 暂不上架
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">图片 URL</label>
                                <input className="w-full border rounded-lg p-2 text-sm text-gray-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={editingProduct.image_url || ''}
                                    onChange={e => setEditingProduct({ ...editingProduct, image_url: e.target.value })}
                                    placeholder="https://example.com/image.jpg"
                                />
                            </div>
                        </div>

                        <div className="mt-8 flex gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 border rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-colors">取消</button>
                            <button onClick={handleSave} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex justify-center items-center gap-2 transition-colors shadow-lg shadow-indigo-200">
                                <Save size={18} /> 保存商品
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}