/*
 * 校区端: 批量排课向导 (V14.5)
 * 路径: /base/schedule/BatchScheduleWizard.tsx
 * 功能: 按学期/日期范围批量生成课程
 */
'use client';

import { useState, useEffect } from 'react';
import { X, CalendarRange, ArrowRight, CheckCircle, Users, MapPin, Clock, Calculator } from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';

interface Course { id: string; name_key: string; default_duration_minutes: number; }
interface Teacher { user_id: string; full_name: string; }
interface Room { id: string; name: string; capacity: number; }

interface BatchScheduleWizardProps {
    token: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function BatchScheduleWizard({ token, onClose, onSuccess }: BatchScheduleWizardProps) {
    const API = API_BASE_URL;
    const [step, setStep] = useState<1 | 2>(1);
    
    // --- 基础数据 ---
    const [courses, setCourses] = useState<Course[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    
    // --- 表单配置 ---
    const [courseId, setCourseId] = useState("");
    const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
    const [roomId, setRoomId] = useState("");
    const [capacity, setCapacity] = useState("10");
    
    // --- 周期配置 ---
    const [startDate, setStartDate] = useState(""); // 学期开始 (第一节课日期)
    const [timeStr, setTimeStr] = useState("09:00"); // 上课时间
    const [endDate, setEndDate] = useState("");   // 学期结束 (截止日期)
    const [frequency, setFrequency] = useState("weekly"); // weekly | biweekly

    // --- 预览数据 ---
    const [previewDates, setPreviewDates] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // 1. 初始化选项
    useEffect(() => {
        const fetchData = async () => {
            try {
                const headers = { 'Authorization': `Bearer ${token}` };
                const [cRes, tRes, rRes] = await Promise.all([
                    fetch(`${API}/courses`, { headers }),
                    fetch(`${API}/base/teachers`, { headers }),
                    fetch(`${API}/base/rooms`, { headers })
                ]);
                if (cRes.ok) setCourses(await cRes.json());
                if (tRes.ok) setTeachers(await tRes.json());
                if (rRes.ok) setRooms(await rRes.json());
            } catch (e) { console.error(e); }
        };
        fetchData();
    }, [token, API]);

    // 2. 计算预览 (Step 1 -> Step 2)
    const handlePreview = () => {
        if (!courseId || selectedTeacherIds.length === 0 || !roomId || !startDate || !endDate) {
            return alert("请补全所有必填信息");
        }
        
        const dates: string[] = [];
        const start = new Date(`${startDate}T${timeStr}`);
        const endLimit = new Date(`${endDate}T23:59`);
        
        let current = new Date(start);
        
        // 循环计算日期
        while (current <= endLimit) {
            dates.push(current.toLocaleString('zh-CN', { 
                dateStyle: 'full', timeStyle: 'short', hour12: false 
            }));
            
            // 增加天数 (7 或 14)
            const daysToAdd = frequency === 'weekly' ? 7 : 14;
            current = new Date(current.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        }

        if (dates.length === 0) return alert("该日期范围内没有符合条件的排课日");
        if (dates.length > 50) return alert("单次批量排课不能超过 50 节，请缩短日期范围");

        setPreviewDates(dates);
        setStep(2);
    };

    // 3. 提交批量排课
    const handleSubmit = async () => {
        setLoading(true);
        try {
            // 计算第一节课的完整时间 ISO
            const firstStart = new Date(`${startDate}T${timeStr}`);
            const course = courses.find(c => c.id === courseId);
            const duration = course?.default_duration_minutes || 60;
            const firstEnd = new Date(firstStart.getTime() + duration * 60000);

            // 转换 ISO 字符串 (处理时区)
            const toISO = (d: Date) => {
                const offset = d.getTimezoneOffset() * 60000;
                return new Date(d.getTime() - offset).toISOString().slice(0, 19) + "Z";
            };

            const payload = {
                course_id: courseId,
                teacher_ids: selectedTeacherIds,
                room_id: roomId,
                max_capacity: parseInt(capacity),
                start_time: toISO(firstStart),
                end_time: toISO(firstEnd),
                // (★ 关键: 告诉后端这是批量操作)
                recurrence_type: frequency,
                repeat_count: previewDates.length // 既然我们已经在前端算好了次数，直接传给后端
            };

            const res = await fetch(`${API}/base/classes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("排课失败");

            alert(`🎉 成功创建 ${previewDates.length} 节课程！`);
            onSuccess();
            onClose();
        } catch (e) {
            alert("提交失败，请重试");
        } finally {
            setLoading(false);
        }
    };

    // 辅助
    const toggleTeacher = (id: string) => {
        setSelectedTeacherIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <CalendarRange className="text-indigo-600" /> 批量排课向导
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">一次性安排整个学期的课程表</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    
                    {/* === Step 1: 配置规则 === */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right-8">
                            
                            {/* 1. 基础信息 */}
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">选择课程</label>
                                    <select value={courseId} onChange={e => setCourseId(e.target.value)} className="w-full p-3 border rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                                        <option value="">-- 请选择 --</option>
                                        {courses.map(c => <option key={c.id} value={c.id}>{c.name_key}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">上课教室</label>
                                    <select value={roomId} onChange={e => setRoomId(e.target.value)} className="w-full p-3 border rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                                        <option value="">-- 请选择 --</option>
                                        {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.capacity}人)</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* 2. 老师多选 */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">授课团队</label>
                                <div className="grid grid-cols-3 gap-3 border p-3 rounded-xl bg-gray-50 max-h-32 overflow-y-auto">
                                    {teachers.map(t => (
                                        <label key={t.user_id} className={`flex items-center gap-2 p-2 rounded cursor-pointer border transition-all ${selectedTeacherIds.includes(t.user_id) ? 'bg-indigo-50 border-indigo-300 shadow-sm' : 'bg-white border-gray-200 hover:border-indigo-200'}`}>
                                            <input type="checkbox" checked={selectedTeacherIds.includes(t.user_id)} onChange={() => toggleTeacher(t.user_id)} className="rounded text-indigo-600"/>
                                            <span className="text-sm">{t.full_name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* 3. 周期设置 (核心) */}
                            <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100 space-y-4">
                                <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                                    <Clock size={18}/> 学期时间规则
                                </h3>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-indigo-700 mb-1">首次上课日期</label>
                                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border rounded-lg text-sm"/>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-indigo-700 mb-1">学期截止日期</label>
                                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border rounded-lg text-sm"/>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-indigo-700 mb-1">上课时间</label>
                                        <input type="time" value={timeStr} onChange={e => setTimeStr(e.target.value)} className="w-full p-2 border rounded-lg text-sm"/>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-indigo-700 mb-1">重复频率</label>
                                        <select value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full p-2 border rounded-lg text-sm">
                                            <option value="weekly">每周重复</option>
                                            <option value="biweekly">每两周重复</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Next Button */}
                            <div className="flex justify-end pt-4">
                                <button onClick={handlePreview} className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 flex items-center gap-2 shadow-lg transform transition hover:scale-[1.02]">
                                    生成预览 <ArrowRight size={18}/>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* === Step 2: 确认预览 === */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-8">
                            <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-green-800 text-lg">即将生成 {previewDates.length} 节课程</h3>
                                    <p className="text-green-600 text-sm mt-1">请仔细核对日期，确认无误后提交。</p>
                                </div>
                                <Calculator className="text-green-200" size={48} />
                            </div>

                            <div className="border rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                                        <tr>
                                            <th className="p-3 pl-4">序号</th>
                                            <th className="p-3">日期与时间</th>
                                            <th className="p-3">状态</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {previewDates.map((date, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="p-3 pl-4 font-mono text-gray-400">{i + 1}</td>
                                                <td className="p-3 font-medium text-gray-800">{date}</td>
                                                <td className="p-3 text-green-600 text-xs">
                                                    <span className="bg-green-100 px-2 py-1 rounded-full">待创建</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-between pt-4 border-t">
                                <button onClick={() => setStep(1)} className="text-gray-500 hover:text-gray-800 font-medium px-4">
                                    &larr; 返回修改
                                </button>
                                <button 
                                    onClick={handleSubmit} 
                                    disabled={loading}
                                    className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg disabled:opacity-50 flex items-center gap-2"
                                >
                                    {loading ? '正在创建...' : <><CheckCircle size={18}/> 确认生成课表</>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}