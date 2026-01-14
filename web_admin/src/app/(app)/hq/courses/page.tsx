/*
 * 总部管理: 中央课程库 (V16.2 - 集成海报生成器)
 * 路径: /hq/courses/page.tsx
 */
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import {
    LayoutGrid, Plus, Search, Clock, Award, MoreHorizontal,
    Power, Edit, Image as ImageIcon, FileText, X
} from 'lucide-react';
import PosterGeneratorModal from './PosterGeneratorModal'; // (★ 引入海报生成器)

interface Course {
    id: string;
    name_key: string;
    description_key: string | null;
    default_duration_minutes: number;
    points_awarded: number;
    is_active: boolean;
    cover_url: string | null;
    introduction: string | null;
}

export default function CoursesPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const API = API_BASE_URL;

    const [courses, setCourses] = useState<Course[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 编辑弹窗状态
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);

    // (★ 新增) 海报弹窗状态: 存储当前正在生成海报的课程对象
    const [posterCourse, setPosterCourse] = useState<Course | null>(null);

    // Form
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [duration, setDuration] = useState("60");
    const [points, setPoints] = useState("0");
    const [coverUrl, setCoverUrl] = useState("");

    const fetchCourses = async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API}/courses`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setCourses(await res.json());
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchCourses(); }, [token]);

    const openModal = (c?: Course) => {
        if (c) {
            setEditingCourse(c);
            setName(c.name_key);
            setDesc(c.description_key || "");
            setDuration(c.default_duration_minutes.toString());
            setPoints(c.points_awarded.toString());
            setCoverUrl(c.cover_url || "");
        } else {
            setEditingCourse(null);
            setName(""); setDesc(""); setDuration("60"); setPoints("0"); setCoverUrl("");
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token) return;

        const payload = {
            name_key: name,
            description_key: desc || null,
            default_duration_minutes: parseInt(duration),
            points_awarded: parseInt(points),
            cover_url: coverUrl || null,
            introduction: null,
            target_audience_key: null,
            prerequisite_course_id: null
        };

        try {
            let res;
            if (editingCourse) {
                res = await fetch(`${API}/courses/${editingCourse.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
            } else {
                res = await fetch(`${API}/courses`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
            }

            if (!res.ok) throw new Error("Failed");
            alert(editingCourse ? "修改成功" : "创建成功");
            setIsModalOpen(false);
            fetchCourses();
        } catch (e) { alert("操作失败"); }
    };

    const toggleStatus = async (c: Course) => {
        if (!confirm(`确定要${c.is_active ? '下架' : '上架'}吗？`)) return;
        await fetch(`${API}/courses/${c.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ is_active: !c.is_active })
        });
        fetchCourses();
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            {/* Header - Soft UI */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shadow-md shadow-indigo-200/40">
                            <LayoutGrid className="text-indigo-600" size={24} />
                        </div>
                        中央课程库
                    </h1>
                    <p className="text-slate-500 mt-2 ml-14 font-medium">管理所有标准课程、教案及营销素材</p>
                </div>
                <button onClick={() => openModal()} className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-2xl font-semibold hover:shadow-lg hover:shadow-indigo-300/50 flex items-center gap-2 shadow-md transition-all hover:scale-105">
                    <Plus size={18} /> 定义新课程
                </button>
            </div>

            {/* Course Grid - Soft UI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {courses.map(c => (
                    <div key={c.id} className={`group bg-gradient-to-br rounded-3xl border transition-all overflow-hidden flex flex-col shadow-lg hover:shadow-xl ${c.is_active ? 'from-white to-slate-50/30 border-slate-100/50 hover:border-indigo-200 shadow-slate-200/40 hover:shadow-indigo-200/40' : 'from-white to-gray-50/50 border-gray-100 opacity-60 grayscale-[0.7] hover:grayscale-0 hover:opacity-100'}`}>

                        {/* 封面图 - Soft UI */}
                        <div className="h-44 bg-gradient-to-br from-slate-100 to-gray-100 relative overflow-hidden">
                            {c.cover_url ? (
                                <img src={c.cover_url} alt={c.name_key} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-200 to-gray-200 flex items-center justify-center">
                                        <ImageIcon size={32} className="text-slate-400" strokeWidth={1.5} />
                                    </div>
                                </div>
                            )}
                            <div className="absolute top-3 right-3">
                                <span className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow-md ${c.is_active ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-emerald-300/50' : 'bg-gradient-to-r from-gray-200 to-slate-200 text-slate-600'}`}>
                                    {c.is_active ? '已上架' : '已下架'}
                                </span>
                            </div>
                        </div>

                        {/* 内容 - Soft UI */}
                        <div className="p-5 flex-1 flex flex-col bg-white/50 backdrop-blur-sm">
                            <h3 className="text-lg font-bold text-slate-800 mb-2 line-clamp-1" title={c.name_key}>{c.name_key}</h3>
                            <p className="text-xs text-slate-500 line-clamp-2 mb-4 h-8 leading-relaxed">{c.description_key || "暂无简介..."}</p>

                            <div className="mt-auto flex items-center gap-3 text-xs font-semibold">
                                <span className="flex items-center gap-1.5 bg-gradient-to-r from-slate-50 to-gray-50 px-3 py-1.5 rounded-xl border border-slate-200/50 shadow-sm">
                                    <Clock size={12} className="text-slate-600" /> {c.default_duration_minutes}分
                                </span>
                                <span className="flex items-center gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 px-3 py-1.5 rounded-xl border border-amber-200/50 shadow-sm">
                                    <Award size={12} /> +{c.points_awarded}分
                                </span>
                            </div>
                        </div>

                        {/* 底部操作栏 - Soft UI */}
                        <div className="p-3 border-t border-slate-100 flex justify-between bg-gradient-to-r from-slate-50/50 to-gray-50/30 backdrop-blur-sm items-center text-xs font-semibold text-slate-600">
                            <button onClick={() => openModal(c)} className="flex-1 flex items-center justify-center gap-1.5 hover:text-indigo-600 py-2 transition-all hover:bg-indigo-50 rounded-xl">
                                <Edit size={14} /> 编辑
                            </button>
                            <div className="w-[1px] h-4 bg-slate-200"></div>
                            {/* (★ 新增: 海报按钮) */}
                            <button onClick={() => setPosterCourse(c)} className="flex-1 flex items-center justify-center gap-1.5 hover:text-purple-600 py-2 transition-all hover:bg-purple-50 rounded-xl">
                                <ImageIcon size={14} /> 海报
                            </button>
                            <div className="w-[1px] h-4 bg-slate-200"></div>
                            <button onClick={() => toggleStatus(c)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-all rounded-xl ${c.is_active ? 'text-red-500 hover:text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'}`}>
                                <Power size={14} /> {c.is_active ? '下架' : '上架'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* 编辑弹窗 */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                        <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-800">{editingCourse ? '编辑课程' : '定义新课程'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">课程名称</label>
                                <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">时长 (分钟)</label>
                                    <input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="w-full p-2 border rounded-lg" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">奖励积分</label>
                                    <input type="number" value={points} onChange={e => setPoints(e.target.value)} className="w-full p-2 border rounded-lg" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">封面图片 URL</label>
                                <input type="text" value={coverUrl} onChange={e => setCoverUrl(e.target.value)} placeholder="https://..." className="w-full p-2 border rounded-lg text-sm text-gray-600" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">简介描述</label>
                                <textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)} className="w-full p-2 border rounded-lg text-sm" />
                            </div>
                            <div className="pt-2 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg">取消</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md">
                                    {editingCourse ? '保存修改' : '立即创建'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* (★ 新增: 海报生成弹窗) */}
            {posterCourse && token && (
                <PosterGeneratorModal
                    token={token}
                    course={posterCourse}
                    onClose={() => setPosterCourse(null)}
                />
            )}
        </div>
    );
}