'use client';

import { API_BASE_URL } from '@/lib/config';
import { useState, useEffect, FormEvent } from 'react';
import { X } from 'lucide-react'; // 关闭图标

// --- 接口定义 ---
interface Course { id: string; name_key: string; default_duration_minutes: number; }
interface Teacher { user_id: string; full_name: string; } // 注意: 后端返回的是 user_id
interface Room { id: string; name: string; capacity: number; }

interface CreateClassModalProps {
    token: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void; // 成功后回调刷新日历
}

export default function CreateClassModal({ token, isOpen, onClose, onSuccess }: CreateClassModalProps) {
    // --- 选项数据 ---
    const [courses, setCourses] = useState<Course[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    
    // --- 表单数据 ---
    const [courseId, setCourseId] = useState("");
    const [teacherId, setTeacherId] = useState("");
    const [roomId, setRoomId] = useState("");
    const [startTime, setStartTime] = useState(""); // "2023-10-01T10:00"
    const [endTime, setEndTime] = useState("");
    const [capacity, setCapacity] = useState("10");

    const [loading, setLoading] = useState(false);

    // 1. 初始化：加载下拉菜单数据
    useEffect(() => {
        if (isOpen && token) {
            fetchOptions();
        }
    }, [isOpen, token]);

    const fetchOptions = async () => {
        try {
            const headers = { 'Authorization': `Bearer ${token}` };

            const [cRes, tRes, rRes] = await Promise.all([
                fetch(`${API_BASE_URL}/courses`, { headers }),       // 获取所有课程
                fetch(`${API_BASE_URL}/base/teachers`, { headers }), // 获取本基地老师
                fetch(`${API_BASE_URL}/base/rooms`, { headers })     // 获取本基地教室
            ]);

            if (cRes.ok) setCourses(await cRes.json());
            if (tRes.ok) setTeachers(await tRes.json());
            if (rRes.ok) setRooms(await rRes.json());

        } catch (e) {
            console.error("Failed to load options", e);
            alert("加载选项失败，请检查网络");
        }
    };

    // 2. 自动计算结束时间 (当选择了课程和开始时间后)
    useEffect(() => {
        if (courseId && startTime) {
            const course = courses.find(c => c.id === courseId);
            if (course) {
                const start = new Date(startTime);
                const end = new Date(start.getTime() + course.default_duration_minutes * 60000);
                // 格式化为 datetime-local 字符串 (YYYY-MM-DDTHH:mm)
                // 注意：处理时区偏移
                const offset = end.getTimezoneOffset() * 60000;
                const localISOTime = (new Date(end.getTime() - offset)).toISOString().slice(0, 16);
                setEndTime(localISOTime);
            }
        }
    }, [courseId, startTime, courses]);

    // 3. 提交排课
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                course_id: courseId,
                teacher_id: teacherId,
                room_id: roomId,
                start_time: new Date(startTime).toISOString(), // 转为 ISO 格式发给后端
                end_time: new Date(endTime).toISOString(),
                max_capacity: parseInt(capacity)
            };

            const res = await fetch('http://localhost:8000/api/v1/base/classes', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("排课冲突或失败");

            alert("✅ 排课成功！");
            onSuccess(); // 刷新父组件
            onClose();   // 关闭弹窗
            
            // 重置表单
            setCourseId(""); setStartTime(""); setEndTime("");

        } catch (e) {
            alert("排课失败：可能是时间/教室冲突");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-800">📅 新建排课</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* 课程选择 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">选择课程</label>
                        <select 
                            value={courseId} onChange={e => setCourseId(e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                            required
                        >
                            <option value="">-- 请选择课程 --</option>
                            {courses.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name_key} ({c.default_duration_minutes}分钟)
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* 老师选择 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">授课老师</label>
                            <select 
                                value={teacherId} onChange={e => setTeacherId(e.target.value)}
                                className="w-full p-2 border rounded"
                                required
                            >
                                <option value="">-- 请选择 --</option>
                                {teachers.map(t => (
                                    <option key={t.user_id} value={t.user_id}>{t.full_name || '未命名'}</option>
                                ))}
                            </select>
                        </div>
                        {/* 教室选择 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">上课教室</label>
                            <select 
                                value={roomId} onChange={e => {
                                    setRoomId(e.target.value);
                                    // 自动填入教室容量
                                    const r = rooms.find(rm => rm.id === e.target.value);
                                    if (r) setCapacity(r.capacity.toString());
                                }}
                                className="w-full p-2 border rounded"
                                required
                            >
                                <option value="">-- 请选择 --</option>
                                {rooms.map(r => (
                                    <option key={r.id} value={r.id}>{r.name} ({r.capacity}人)</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* 开始时间 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                            <input 
                                type="datetime-local" 
                                value={startTime} onChange={e => setStartTime(e.target.value)}
                                className="w-full p-2 border rounded"
                                required
                            />
                        </div>
                        {/* 结束时间 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                            <input 
                                type="datetime-local" 
                                value={endTime} onChange={e => setEndTime(e.target.value)}
                                className="w-full p-2 border rounded bg-gray-50"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">最大人数</label>
                        <input 
                            type="number" 
                            value={capacity} onChange={e => setCapacity(e.target.value)}
                            className="w-full p-2 border rounded"
                            min="1"
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">取消</button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium disabled:opacity-50"
                        >
                            {loading ? '提交中...' : '确认排课'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}