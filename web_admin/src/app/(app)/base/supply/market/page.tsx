'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/config';
import {
    ShoppingCart,
    Package,
    Zap,
    Loader2,
    Search,
    Filter,
    AlertCircle,
    Check
} from 'lucide-react';

// 定义商品结构 (对应数据库 hq_products 表)
interface Product {
    id: string;
    name: string;
    type: 'material' | 'service';
    price_cents: number;
    stock_quantity: number;
    image_url: string | null;
    sku: string | null;
}

export default function SupplyMarketPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;

    // 状态管理
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // 购买弹窗状态
    const [buyingProduct, setBuyingProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [submitting, setSubmitting] = useState(false);

    // 初始化加载
    useEffect(() => {
        if (token) fetchProducts();
    }, [token]);

    const fetchProducts = async () => {
        try {
            // GET /supply/products -> 获取总部定义的所有可售卖商品
            const res = await fetch(`${API_BASE_URL}/supply/products`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setProducts(data);
            }
        } catch (e) {
            console.error("加载商品失败", e);
        }
        setLoading(false);
    };

    // 提交采购订单
    const handleBuy = async () => {
        if (!buyingProduct || !token) return;
        setSubmitting(true);

        try {
            // POST /supply/orders -> 创建采购单
            const res = await fetch(`${API_BASE_URL}/supply/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    // 这里简化为单商品下单，后续可扩展为购物车
                    items: [{ product_id: buyingProduct.id, quantity: Number(quantity) }]
                })
            });

            if (res.ok) {
                setBuyingProduct(null); // 关闭弹窗
                // 引导用户去查看订单
                if (confirm("✅ 下单成功！\n订单已生成 (待付款)。\n是否立即前往 [我的进货单] 上传凭证？")) {
                    window.location.href = '/base/supply/my-orders';
                } else {
                    fetchProducts(); // 刷新列表 (更新库存显示)
                }
            } else {
                const err = await res.json();
                alert(`下单失败：${err.error || '库存不足或系统错误'}`);
            }
        } catch (e) {
            alert("网络请求失败");
        }
        setSubmitting(false);
    };

    // 前端搜索过滤
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-purple-50/20">
            {/* 顶部标题与工具栏 - Soft UI */}
            <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 bg-gradient-to-br from-white to-slate-50/30 p-6 rounded-3xl shadow-lg shadow-slate-200/40 border border-slate-100 backdrop-blur-sm">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center shadow-md shadow-purple-200/40">
                            <ShoppingCart className="text-purple-600" size={28} />
                        </div>
                        采购商城
                    </h1>
                    <p className="text-sm text-slate-500 mt-2 ml-[4.5rem] font-medium">
                        总部直供教材、教具及增值服务。下单后请通过对公转账付款
                    </p>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="搜索商品名 / SKU..."
                            className="w-full pl-9 pr-4 py-2.5 border-2 border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition-all bg-white shadow-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Link href="/base/supply/my-orders" className="flex items-center gap-1 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:shadow-purple-300/50 shadow-md transition-all hover:scale-105">
                        我的进货单
                    </Link>
                </div>
            </div>

            {/* 商品列表 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredProducts.map(product => (
                    <div key={product.id} className="bg-gradient-to-br from-white to-slate-50/30 rounded-3xl border border-slate-100 shadow-lg shadow-slate-200/30 hover:shadow-xl hover:shadow-purple-200/40 transition-all duration-300 overflow-hidden flex flex-col group backdrop-blur-sm hover:scale-[1.02]">
                        {/* 图片区域 */}
                        <div className="h-48 bg-gray-100 relative overflow-hidden">
                            {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
                                    <Package size={40} strokeWidth={1.5} />
                                </div>
                            )}
                            {/* 类型标签 */}
                            <div className="absolute top-3 right-3">
                                {product.type === 'service' ? (
                                    <span className="bg-gradient-to-r from-purple-100 to-pink-100 backdrop-blur text-purple-700 px-3 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-sm border border-purple-200/50">
                                        <Zap size={12} fill="currentColor" /> 增值服务
                                    </span>
                                ) : (
                                    <span className="bg-gradient-to-r from-sky-100 to-blue-100 backdrop-blur text-sky-700 px-3 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-sm border border-sky-200/50">
                                        <Package size={12} /> 实物商品
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* 内容区域 */}
                        <div className="p-5 flex-1 flex flex-col">
                            <h3 className="font-bold text-gray-900 mb-1 line-clamp-2 text-lg">{product.name}</h3>
                            <div className="text-xs text-gray-400 font-mono mb-4">{product.sku || 'NO-SKU'}</div>

                            <div className="flex justify-between items-center text-xs text-gray-500 mb-4 bg-gray-50 p-2 rounded-lg">
                                <span>当前库存</span>
                                <span className={product.stock_quantity > 0 ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
                                    {product.stock_quantity > 999 ? '充足' : product.stock_quantity}
                                </span>
                            </div>

                            <div className="mt-auto flex items-center justify-between pt-2">
                                <span className="text-xl font-bold text-orange-600 font-mono">
                                    ¥{(product.price_cents / 100).toFixed(2)}
                                </span>
                                <button
                                    onClick={() => { setBuyingProduct(product); setQuantity(1); }}
                                    disabled={product.stock_quantity <= 0}
                                    className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-5 py-2.5 rounded-2xl text-sm font-bold hover:shadow-lg hover:shadow-purple-300/50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                                >
                                    {product.stock_quantity <= 0 ? '缺货' : '购买'}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 缺省状态 */}
            {!loading && filteredProducts.length === 0 && (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                    <Package className="mx-auto text-gray-300 mb-4" size={48} />
                    <h3 className="text-lg font-bold text-gray-900">暂无商品</h3>
                    <p className="text-gray-500">没有找到匹配的商品，或者总部尚未上架。</p>
                </div>
            )}

            {/* 下单确认弹窗 */}
            {buyingProduct && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="text-xl font-bold text-gray-900">确认采购订单</h3>
                            <button onClick={() => setBuyingProduct(null)} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl mb-6 border border-gray-100">
                            <div className="text-sm text-gray-500 mb-1">商品名称</div>
                            <div className="font-bold text-gray-900 text-lg mb-2">{buyingProduct.name}</div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">单价</span>
                                <span className="font-mono font-bold">¥{(buyingProduct.price_cents / 100).toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="mb-8">
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-bold text-gray-700">采购数量</label>
                                <span className="text-xs text-gray-400">最大库存: {buyingProduct.stock_quantity}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-12 h-12 rounded-xl border-2 border-gray-100 flex items-center justify-center hover:border-indigo-600 hover:text-indigo-600 transition-all font-bold text-lg"
                                >-</button>
                                <input
                                    type="number"
                                    min={1}
                                    max={buyingProduct.stock_quantity}
                                    value={quantity}
                                    onChange={e => setQuantity(Number(e.target.value))}
                                    className="flex-1 text-center bg-gray-50 rounded-xl h-12 font-bold text-xl outline-none border-2 border-transparent focus:border-indigo-600 transition-all"
                                />
                                <button
                                    onClick={() => setQuantity(Math.min(buyingProduct.stock_quantity, quantity + 1))}
                                    className="w-12 h-12 rounded-xl border-2 border-gray-100 flex items-center justify-center hover:border-indigo-600 hover:text-indigo-600 transition-all font-bold text-lg"
                                >+</button>
                            </div>

                            <div className="mt-6 flex justify-between items-end pt-4 border-t border-dashed">
                                <span className="text-sm text-gray-500 font-bold">订单总额</span>
                                <span className="text-3xl font-bold text-orange-600 font-mono">
                                    ¥{((buyingProduct.price_cents * quantity) / 100).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setBuyingProduct(null)}
                                className="flex-1 py-3.5 rounded-xl border font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleBuy}
                                disabled={submitting}
                                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold hover:shadow-lg hover:shadow-purple-300/50 disabled:opacity-70 flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                            >
                                {submitting ? <Loader2 className="animate-spin" size={20} /> : '确认下单'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}