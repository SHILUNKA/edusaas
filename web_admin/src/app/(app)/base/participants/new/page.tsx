/*
 * 校区端: 新生接待录入 (V3.1 - 智能上下文版)
 * 路径: /base/participants/new
 * 优化: 支持通过 URL 参数 (?parent=id) 自动跳过第一步，直接给指定家长添加学员
 */
'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    UserPlus, Baby, Phone, ArrowRight, CheckCircle,
    CreditCard, User, ArrowLeft
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';

// --- 类型定义 ---
interface Customer { id: string; name: string | null; phone_number: string; }
interface MembershipTier { id: string; name_key: string; price_in_cents: number; tier_type: string; }
interface Participant { id: string; name: string; }

function NewParticipantContent() {
    const router = useRouter();
    const searchParams = useSearchParams(); // (★ 获取 URL 参数)
    const parentIdFromUrl = searchParams.get('parent');

    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const API = API_BASE_URL;

    // --- 流程状态 ---
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitLoading, setIsInitLoading] = useState(!!parentIdFromUrl); // 如果有参数，初始为加载中
    const [error, setError] = useState<string | null>(null);

    // --- 数据状态 ---
    const [tiers, setTiers] = useState<MembershipTier[]>([]);

    // Step 1: 家长
    const [phone, setPhone] = useState("");
    const [parentName, setParentName] = useState("");
    const [createdCustomer, setCreatedCustomer] = useState<Customer | null>(null);

    // Step 2: 学员
    const [students, setStudents] = useState([{ name: '', dob: '', gender: '' }]);
    const [createdStudents, setCreatedStudents] = useState<Participant[]>([]);

    // Step 3: 办卡
    const [selectedTierId, setSelectedTierId] = useState("");

    // 1. 初始化加载 (卡种 + 自动识别家长)
    useEffect(() => {
        if (!token) return;

        const init = async () => {
            try {
                // 加载卡种
                fetch(`${API}/membership-tiers`, { headers: { 'Authorization': `Bearer ${token}` } })
                    .then(res => res.json())
                    .then(data => setTiers(data));

                // (★ 关键优化: 如果 URL 有 parent ID，自动加载家长并跳到 Step 2)
                if (parentIdFromUrl) {
                    // 由于目前后端没有 get_customer_by_id 接口，我们暂时拉取列表查找
                    // (生产环境建议增加 GET /api/v1/customers/:id 接口)
                    const res = await fetch(`${API}/customers`, { headers: { 'Authorization': `Bearer ${token}` } });
                    if (res.ok) {
                        const customers: Customer[] = await res.json();
                        const found = customers.find(c => c.id === parentIdFromUrl);
                        if (found) {
                            setCreatedCustomer(found);
                            setStep(2); // 直接跳到第二步
                        } else {
                            setError("未找到指定家长，请重新录入");
                        }
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsInitLoading(false);
            }
        };
        init();
    }, [token, parentIdFromUrl, API]);

    // --- 动作: 提交家长 ---
    const handleCreateCustomer = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true); setError(null);
        try {
            const res = await fetch(`${API}/customers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ phone_number: phone, name: parentName || null, base_id: null })
            });

            if (res.status === 409) {
                throw new Error("该手机号已存在，请直接去'学员与会员'页面添加学员");
            }
            if (!res.ok) throw new Error("创建家长失败");

            setCreatedCustomer(await res.json());
            setStep(2);
        } catch (e: any) { setError(e.message); }
        finally { setIsLoading(false); }
    };

    // --- 动作: 提交学员 ---
    const handleCreateStudents = async (e: FormEvent) => {
        e.preventDefault();
        const validStudents = students.filter(s => s.name.trim() !== '');
        if (validStudents.length === 0) return alert("请填写学员信息");

        setIsLoading(true);
        try {
            const results = await Promise.all(validStudents.map(s =>
                fetch(`${API}/participants`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        customer_id: createdCustomer!.id,
                        name: s.name,
                        date_of_birth: s.dob || null,
                        gender: s.gender || null,
                        school_name: null,
                        notes: null
                    })
                }).then(res => res.json())
            ));

            setCreatedStudents(results);
            setStep(3);
        } catch (e: any) { setError(e.message); setIsLoading(false); }
        finally { setIsLoading(false); }
    };

    // --- 动作: 提交办卡 ---
    const handleBuyCard = async () => {
        if (!selectedTierId) return alert("请选择会员卡");
        if (!confirm("确认开卡并扣费？")) return;

        setIsLoading(true);
        try {
            const res = await fetch(`${API}/customer-memberships`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    customer_id: createdCustomer!.id,
                    tier_id: selectedTierId,
                    participant_id: null
                })
            });
            if (!res.ok) throw new Error("开卡失败");

            if (confirm("✅ 流程完成！\n\n点击【确定】前往排课日历。\n点击【取消】返回会员列表。")) {
                router.push('/base/schedule');
            } else {
                router.push('/base/memberships');
            }
        } catch (e: any) { setError(e.message); }
        finally { setIsLoading(false); }
    };

    const updateStudent = (i: number, f: string, v: string) => {
        const newS = [...students]; (newS[i] as any)[f] = v; setStudents(newS);
    };

    if (isInitLoading) {
        return <div className="p-10 text-center text-gray-500">正在加载家长信息...</div>;
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <UserPlus className="text-indigo-600" /> 新生接待 SOP
                    </h1>
                    <p className="text-gray-500 mt-1">标准化录入流程：建立档案 → 办理会员卡 → (跳转) 排课。</p>
                </div>
                {/* 返回按钮 */}
                <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
                    <ArrowLeft size={16} /> 返回列表
                </button>
            </div>

            {/* 步骤条 */}
            <div className="flex items-center justify-between mb-8 px-4">
                <StepItem num={1} label="家长档案" active={step >= 1} current={step === 1} done={!!parentIdFromUrl || step > 1} />
                <div className={`h-1 flex-1 mx-4 ${step >= 2 ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
                <StepItem num={2} label="学员档案" active={step >= 2} current={step === 2} />
                <div className={`h-1 flex-1 mx-4 ${step >= 3 ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
                <StepItem num={3} label="办理会员卡" active={step >= 3} current={step === 3} />
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">

                {/* === STEP 1: 家长 === */}
                {step === 1 && (
                    <form onSubmit={handleCreateCustomer} className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        {parentIdFromUrl && <div className="text-center py-10">正在跳转...</div>}
                        {!parentIdFromUrl && (
                            <>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 block mb-1">手机号 *</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                            <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full pl-10 p-2 border rounded-lg" placeholder="11位手机号" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 block mb-1">家长姓名</label>
                                        <input type="text" value={parentName} onChange={e => setParentName(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="例如: 王先生" />
                                    </div>
                                </div>
                                {error && <div className="text-red-500 text-sm">{error}</div>}
                                <div className="flex justify-end">
                                    <button disabled={isLoading} className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50">
                                        {isLoading ? '保存中...' : <>下一步 <ArrowRight size={16} /></>}
                                    </button>
                                </div>
                            </>
                        )}
                    </form>
                )}

                {/* === STEP 2: 学员 === */}
                {step === 2 && createdCustomer && (
                    <form onSubmit={handleCreateStudents} className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="bg-green-50 p-4 rounded-lg flex items-center justify-between text-green-800 border border-green-100">
                            <div className="flex items-center gap-3">
                                <CheckCircle size={20} />
                                <div>
                                    <p className="font-bold">当前操作家长: {createdCustomer.name || '未知姓名'}</p>
                                    <p className="text-xs opacity-80">{createdCustomer.phone_number}</p>
                                </div>
                            </div>
                            {/* 如果是从外部跳转来的，允许重选 */}
                            {parentIdFromUrl && (
                                <button type="button" onClick={() => router.push('/base/participants/new')} className="text-xs underline hover:text-green-900">
                                    切换新家长
                                </button>
                            )}
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-700">学员信息</label>
                            {students.map((s, i) => (
                                <div key={i} className="flex gap-3">
                                    <input type="text" required={i === 0} value={s.name} onChange={e => updateStudent(i, 'name', e.target.value)} className="flex-1 p-2 border rounded-lg" placeholder="学员姓名" />
                                    <select value={s.gender} onChange={e => updateStudent(i, 'gender', e.target.value)} className="w-24 p-2 border rounded-lg bg-white">
                                        <option value="">性别</option><option value="男">男</option><option value="女">女</option>
                                    </select>
                                    <input type="date" value={s.dob} onChange={e => updateStudent(i, 'dob', e.target.value)} className="w-40 p-2 border rounded-lg text-gray-500" />
                                </div>
                            ))}
                            <button type="button" onClick={() => setStudents([...students, { name: '', dob: '', gender: '' }])} className="text-sm text-indigo-600 flex items-center gap-1">
                                <Baby size={16} /> 添加另一个孩子
                            </button>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            {/* 只有不是直接跳转进来的，才允许上一步 */}
                            {!parentIdFromUrl && (
                                <button type="button" onClick={() => setStep(1)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg">上一步</button>
                            )}
                            <button disabled={isLoading} className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700">
                                {isLoading ? '保存中...' : '保存并去办卡'}
                            </button>
                        </div>
                    </form>
                )}

                {/* === STEP 3: 办卡 === */}
                {step === 3 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="grid grid-cols-2 gap-4">
                            <InfoBanner icon={<User size={18} />} text={`家长: ${createdCustomer?.name}`} />
                            <InfoBanner icon={<Baby size={18} />} text={`学员: ${createdStudents.map(s => s.name).join(', ')}`} />
                        </div>

                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                            <h3 className="font-bold text-yellow-800 mb-3 flex items-center gap-2">
                                <CreditCard size={18} /> 选择会员卡
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {tiers.map(tier => (
                                    <div
                                        key={tier.id}
                                        onClick={() => setSelectedTierId(tier.id)}
                                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedTierId === tier.id ? 'border-indigo-500 bg-white shadow-md' : 'border-transparent bg-white/50 hover:bg-white'}`}
                                    >
                                        <div className="font-bold text-gray-900">{tier.name_key}</div>
                                        <div className="text-sm text-gray-500 mt-1">
                                            ¥ {(tier.price_in_cents / 100).toFixed(2)}
                                            <span className="mx-1">·</span>
                                            {tier.tier_type === 'time_based' ? '有效期' : '计次'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                onClick={() => router.push('/base/memberships')}
                                className="px-4 py-2 text-gray-500 hover:text-gray-700"
                            >
                                跳过，稍后办理
                            </button>
                            <button
                                onClick={handleBuyCard}
                                disabled={isLoading || !selectedTierId}
                                className="bg-green-600 text-white px-8 py-2 rounded-lg hover:bg-green-700 font-bold shadow-md disabled:opacity-50"
                            >
                                {isLoading ? '开卡中...' : '✅ 确认开卡 & 完成'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// (Suspense 包装器：Next.js 14 要求使用 useSearchParams 的组件必须包裹在 Suspense 中)
export default function PageWrapper() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <NewParticipantContent />
        </Suspense>
    );
}

// --- 子组件 ---
function StepItem({ num, label, active, current, done }: any) {
    return (
        <div className={`flex items-center gap-2 ${active ? 'text-indigo-700' : 'text-gray-400'}`}>
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${done ? 'bg-green-100 text-green-700 border-green-200' : current ? 'bg-indigo-600 text-white shadow-md' : active ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                {done ? <CheckCircle size={16} /> : num}
            </span>
            <span className={`font-medium ${current ? 'text-gray-900' : ''}`}>{label}</span>
        </div>
    );
}

function InfoBanner({ icon, text }: any) {
    return (
        <div className="bg-gray-50 p-3 rounded-lg flex items-center gap-3 text-gray-700 border border-gray-200">
            {icon}
            <span className="font-medium">{text}</span>
        </div>
    );
}