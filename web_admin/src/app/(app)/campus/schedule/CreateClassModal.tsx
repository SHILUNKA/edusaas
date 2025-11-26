/*
 * 校区端: 新建排课弹窗 (V9.0 - 多老师 & 框选时间版)
 */
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { X, Repeat, Users, Clock } from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';

interface Course { id: string; name_key: string; default_duration_minutes: number; }
interface Teacher { user_id: string; full_name: string; }
interface Room { id: string; name: string; capacity: number; }

interface CreateClassModalProps {
    token: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    // 接收日历框选的时间段
    initialRange?: { start: Date; end: Date } | null;
}

// 辅助函数: 转为 datetime-local 字符串
const toLocalISOString = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export default function CreateClassModal({ token, isOpen, onClose, onSuccess, initialRange }: CreateClassModalProps) {
    const [courses, setCourses] = useState<Course[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    
    // --- 表单状态 ---
    const [courseId, setCourseId] = useState("");
    // (★ 修改: 多选老师)
    const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]); 
    const [roomId, setRoomId] = useState("");
    const [capacity, setCapacity] = useState("10");
    
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");

    // 周期性设置
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrenceType, setRecurrenceType] = useState("weekly");
    const [repeatCount, setRepeatCount] = useState("10");

    const [loading, setLoading] = useState(false);
    const API = API_BASE_URL;

    // 1. 加载选项
    useEffect(() => {
        if (isOpen && token) {
            const fetchOptions = async () => {
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
            fetchOptions();
        }
    }, [isOpen, token]);

    // 2. 初始化时间 & 重置表单
    useEffect(() => {
        if (isOpen) {
            if (initialRange) {
                // 情况 A: 用户在日历上框选了时间
                setStartTime(toLocalISOString(initialRange.start));
                setEndTime(toLocalISOString(initialRange.end));
            } else {
                // 情况 B: 用户直接点击按钮 -> 默认当前时间 + 1小时
                const now = new Date();
                now.setMinutes(0, 0, 0); 
                const nextHour = new Date(now.getTime() + 60 * 60000);
                setStartTime(toLocalISOString(now));
                setEndTime(toLocalISOString(nextHour));
            }
            // 重置其他字段
            setSelectedTeacherIds([]);
            setCourseId("");
        }
    }, [isOpen, initialRange]);

    // 3. 切换老师选择 (多选逻辑)
    const toggleTeacher = (id: string) => {
        setSelectedTeacherIds(prev => 
            prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
        );
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (selectedTeacherIds.length === 0) {
            alert("请至少选择一位授课老师");
            return;
        }
        setLoading(true);

        try {
            const payload = {
                course_id: courseId,
                teacher_ids: selectedTeacherIds, // (★ 发送数组)
                room_id: roomId,
                start_time: new Date(startTime).toISOString(),
                end_time: new Date(endTime).toISOString(),
                max_capacity: parseInt(capacity),
                recurrence_type: isRecurring ? recurrenceType : "none",
                repeat_count: isRecurring ? parseInt(repeatCount) : 1
            };

            const res = await fetch(`${API}/base/classes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("排课失败");

            alert(isRecurring ? `✅ 成功批量排课 ${repeatCount} 节！` : "✅ 排课成功！");
            onSuccess();
            onClose();
        } catch (e) {
            alert("排课失败，请检查时间是否冲突");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-800">📅 新建排课</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                    {/* 课程选择 */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">选择课程 *</label>
                        <select value={courseId} onChange={e => setCourseId(e.target.value)} className="w-full p-2 border rounded bg-white" required>
                            <option value="">-- 请选择 --</option>
                            {courses.map(c => <option key={c.id} value={c.id}>{c.name_key}</option>)}
                        </select>
                    </div>

                    {/* (★ 修改: 多选老师区域) */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                            <Users size={14}/> 授课老师 (可多选) *
                        </label>
                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded bg-gray-50">
                            {teachers.map(t => (
                                <label key={t.user_id} className={`flex items-center gap-2 p-2 rounded cursor-pointer border transition-colors ${selectedTeacherIds.includes(t.user_id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200'}`}>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedTeacherIds.includes(t.user_id)} 
                                        onChange={() => toggleTeacher(t.user_id)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-xs text-gray-700 font-medium">{t.full_name}</span>
                                </label>
                            ))}
                        </div>
                        {teachers.length === 0 && <p className="text-xs text-red-400 mt-1">暂无可用老师，请先去员工管理添加</p>}
                    </div>

                    {/* 教室与容量 */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">上课教室 *</label>
                            <select value={roomId} onChange={e => { setRoomId(e.target.value); const r = rooms.find(rm => rm.id === e.target.value); if (r) setCapacity(r.capacity.toString()); }} className="w-full p-2 border rounded bg-white" required>
                                <option value="">-- 请选择 --</option>
                                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </div>
                        <div className="w-24">
                            <label className="block text-xs font-medium text-gray-500 mb-1">最大人数</label>
                            <input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} className="w-full p-2 border rounded" min="1" />
                        </div>
                    </div>

                    {/* 时间显示 (只读提示 + 输入框) */}
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                <Clock size={14}/> 上课时间 {initialRange && <span className="text-indigo-600 font-normal">(已自动填入框选时间)</span>}
                            </label>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-gray-400">开始</label>
                                <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-1 border rounded text-sm bg-white" required />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400">结束</label>
                                <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-1 border rounded text-sm bg-white" required />
                            </div>
                        </div>
                    </div>

                    {/* 周期设置 */}
                    <div className="border-t border-gray-100 pt-4">
                        <div className="flex items-center gap-2 mb-3">
                            <input type="checkbox" id="recurring" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" />
                            <label htmlFor="recurring" className="text-sm font-bold text-gray-700 flex items-center gap-1 cursor-pointer select-none"><Repeat size={14} /> 启用周期性排课</label>
                        </div>
                        {isRecurring && (
                            <div className="flex gap-4 pl-6 animate-in slide-in-from-top-2">
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-500 mb-1">重复频率</label>
                                    <select value={recurrenceType} onChange={e => setRecurrenceType(e.target.value)} className="w-full p-2 border rounded text-sm">
                                        <option value="weekly">每周重复</option>
                                        <option value="biweekly">每两周</option>
                                    </select>
                                </div>
                                <div className="w-24">
                                    <label className="block text-xs text-gray-500 mb-1">重复次数</label>
                                    <input type="number" value={repeatCount} onChange={e => setRepeatCount(e.target.value)} className="w-full p-2 border rounded text-sm" min="2" max="50" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
                        <button type="submit" disabled={loading} className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50">
                            {loading ? '处理中...' : (isRecurring ? `批量排 ${repeatCount} 节课` : '确认排课')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}