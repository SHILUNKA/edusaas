/*
 * 校区管理: 学员运营中心 (V17.2 - 商用闭环版)
 * 路径: /campus/students
 * 升级: 增加余额预警、续费入口、详细画像抽屉
 */
'use client'; 

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { 
    Users, Search, UserPlus, Filter, Phone, 
    Calendar, MoreHorizontal, GraduationCap, 
    CreditCard, ChevronRight, AlertCircle, Sparkles
} from 'lucide-react';
import StudentProfileDrawer from './StudentProfileDrawer'; // (稍后创建)

interface ParticipantDetail {
    id: string;
    name: string;
    date_of_birth: string | null;
    gender: string | null;
    customer_name: string | null;
    customer_phone: string;
    current_total_points: number | null;
    rank_name_key: string | null;
    last_class_time: string | null;
    remaining_counts: number | null; // (★ 新增: 课时余额)
}

export default function CampusStudentsPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const API = API_BASE_URL;

    const [students, setStudents] = useState<ParticipantDetail[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    
    // 抽屉状态
    const [selectedStudent, setSelectedStudent] = useState<ParticipantDetail | null>(null);

    // 加载数据
    const fetchData = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${API}/base/participants`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setStudents(await res.json());
        } catch (e) { console.error(e); } 
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchData(); }, [token]);

    // 搜索过滤
    const filteredList = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return students.filter(s => 
            !q || s.name.toLowerCase().includes(q) || s.customer_phone.includes(q)
        );
    }, [students, searchQuery]);

    // 辅助计算
    const getAge = (dob: string | null) => {
        if (!dob) return '-';
        const age = new Date().getFullYear() - new Date(dob).getFullYear();
        return `${age}岁`;
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            
            {/* 1. 顶部 Header (带 KPI) */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <GraduationCap className="text-emerald-600" size={32}/> 学员运营
                    </h1>
                    <div className="flex gap-4 mt-2 text-sm text-gray-500">
                        <span>总在读: <b className="text-gray-900">{students.length}</b> 人</span>
                        <span className="w-[1px] bg-gray-300 h-4 self-center"></span>
                        <span className="text-red-500 flex items-center gap-1">
                            <AlertCircle size={14}/> 需续费: <b>{students.filter(s => (s.remaining_counts || 0) < 3).length}</b> 人
                        </span>
                    </div>
                </div>
                <button 
                    className="bg-emerald-600 text-white px-6 py-2.5 rounded-full font-bold hover:bg-emerald-700 shadow-lg flex items-center gap-2 transition-all hover:scale-105"
                    onClick={() => alert("请前往'财务中心'或点击学员详情页办理开卡")}
                >
                    <UserPlus size={18}/> 新生报名
                </button>
            </div>

            {/* 2. 筛选与操作栏 */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
                <div className="relative w-96">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="搜索学员姓名 / 家长手机号..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                </div>
                <div className="text-sm text-gray-500 flex items-center gap-2">
                    <Filter size={16}/> 按欠费筛选 (开发中)
                </div>
            </div>

            {/* 3. 学员列表 (商业化版) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium uppercase text-xs sticky top-0">
                        <tr>
                            <th className="px-6 py-4">学员档案</th>
                            <th className="px-6 py-4">课时余额 (商用核心)</th>
                            <th className="px-6 py-4">家长联系</th>
                            <th className="px-6 py-4">成长等级</th>
                            <th className="px-6 py-4">最近活跃</th>
                            <th className="px-6 py-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {isLoading ? (
                            <tr><td colSpan={6} className="p-20 text-center text-gray-400">加载中...</td></tr>
                        ) : filteredList.length === 0 ? (
                            <tr><td colSpan={6} className="p-20 text-center text-gray-400">暂无数据</td></tr>
                        ) : (
                            filteredList.map(s => {
                                // 余额预警逻辑
                                const balance = s.remaining_counts || 0;
                                const isLowBalance = balance < 3;
                                
                                return (
                                    <tr 
                                        key={s.id} 
                                        className="hover:bg-emerald-50/30 transition-colors group cursor-pointer"
                                        onClick={() => setSelectedStudent(s)} // 点击整行打开详情
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                                                    {s.name[0]}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900">{s.name}</div>
                                                    <div className="text-xs text-gray-500">{s.gender} · {getAge(s.date_of_birth)}</div>
                                                </div>
                                            </div>
                                        </td>
                                        
                                        {/* 余额列 (核心) */}
                                        <td className="px-6 py-4">
                                            {isLowBalance ? (
                                                <div className="flex items-center gap-2 text-red-600 font-bold animate-pulse">
                                                    <AlertCircle size={16}/> 仅剩 {balance} 节
                                                </div>
                                            ) : (
                                                <div className="font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded w-fit">
                                                    剩余 {balance} 节
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-6 py-4">
                                            <div className="text-gray-900 font-medium">{s.customer_name}</div>
                                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5 font-mono">
                                                <Phone size={10}/> {s.customer_phone}
                                            </div>
                                        </td>
                                        
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1">
                                                <Sparkles size={12} className="text-amber-400"/>
                                                <span className="text-gray-700 font-medium">{s.rank_name_key || '列兵'}</span>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-0.5">{s.current_total_points || 0} 积分</div>
                                        </td>
                                        
                                        <td className="px-6 py-4 text-gray-500">
                                            {s.last_class_time ? new Date(s.last_class_time).toLocaleDateString() : <span className="text-gray-300">从未上课</span>}
                                        </td>
                                        
                                        <td className="px-6 py-4 text-right">
                                            {/* 快捷续费按钮 */}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); alert("打开续费弹窗"); }}
                                                className="mr-2 px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                续费
                                            </button>
                                            <ChevronRight size={18} className="text-gray-300 group-hover:text-emerald-500 inline-block"/>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* 详情抽屉 */}
            {selectedStudent && (
                <StudentProfileDrawer 
                    student={selectedStudent} 
                    onClose={() => setSelectedStudent(null)} 
                />
            )}
        </div>
    );
}