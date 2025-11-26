'use client';

import { useState, useEffect, FormEvent } from 'react';
import { X, UserCog } from 'lucide-react';

interface Teacher { user_id: string; full_name: string; }

interface EditClassModalProps {
    token: string;
    classData: any; // 传入当前选中的课程信息
    onClose: () => void;
    onSuccess: () => void;
}

export default function EditClassModal({ token, classData, onClose, onSuccess }: EditClassModalProps) {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState(classData?.teacher_id || "");
    const [loading, setLoading] = useState(false);

    // 1. 加载老师列表
    useEffect(() => {
        const fetchTeachers = async () => {
            try {
                const res = await fetch('http://localhost:8000/api/v1/base/teachers', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) setTeachers(await res.json());
            } catch (e) {
                console.error(e);
            }
        };
        if (token) fetchTeachers();
    }, [token]);

    // 2. 提交修改 (代课)
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedTeacherId) return;
        
        setLoading(true);
        try {
            // 调用 PATCH 接口仅更新 teacher_id
            const res = await fetch(`http://localhost:8000/api/v1/base/classes/${classData.id}`, {
                method: 'PATCH', // 注意：这里用 PATCH
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ teacher_id: selectedTeacherId })
            });

            if (!res.ok) throw new Error("操作失败");

            alert("✅ 代课老师已更新！");
            onSuccess();
            onClose();
        } catch (e) {
            alert("更新失败，请重试");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <UserCog className="text-indigo-600"/> 调整排课 / 代课
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <p className="text-sm text-gray-500 mb-1">当前课程</p>
                        <p className="font-bold text-gray-800 text-lg">{classData.course_name_key}</p>
                        <p className="text-sm text-gray-600 mt-1">
                            时间：{new Date(classData.start_time).toLocaleString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'})}
                        </p>
                        <p className="text-sm text-gray-600">
                            原定老师：<span className="font-medium text-red-500 line-through">{classData.teacher_name}</span>
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">选择代课老师</label>
                        <select 
                            value={selectedTeacherId} 
                            onChange={e => setSelectedTeacherId(e.target.value)}
                            className="w-full p-3 border rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            required
                        >
                            {teachers.map(t => (
                                <option key={t.user_id} value={t.user_id}>
                                    {t.full_name} {t.user_id === classData.teacher_id ? '(当前)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
                        <button 
                            type="submit" 
                            disabled={loading || selectedTeacherId === classData.teacher_id}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? '保存中...' : '确认变更'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}