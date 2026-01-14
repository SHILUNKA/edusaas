/*
 * 教师教学配置弹窗 (V13.3 - 修复样式不可见 Bug)
 * 路径: /hq/users/TeacherConfigModal.tsx
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import { X, BookOpen, Clock, Save, Info, Undo2 } from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';

import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

interface Course { id: string; name_key: string; }
interface TeacherConfigModalProps {
    token: string;
    teacher: { id: string; full_name: string };
    onClose: () => void;
}

// 辅助: 获取本周某一天
const getDateOfWeek = (dayOfWeek: number) => {
    const d = new Date();
    const currentDay = d.getDay() === 0 ? 7 : d.getDay();
    const distance = dayOfWeek - currentDay;
    d.setDate(d.getDate() + distance);
    return d;
};

export default function TeacherConfigModal({ token, teacher, onClose }: TeacherConfigModalProps) {
    const API = API_BASE_URL;
    const [activeTab, setActiveTab] = useState<'skills' | 'time'>('skills');

    // Data
    const [allCourses, setAllCourses] = useState<Course[]>([]);
    const [mySkills, setMySkills] = useState<string[]>([]);

    // Time Data
    const [localEvents, setLocalEvents] = useState<any[]>([]);
    const [deletedIds, setDeletedIds] = useState<string[]>([]);

    const [loading, setLoading] = useState(false);
    const [savingTime, setSavingTime] = useState(false);
    const calendarRef = useRef<FullCalendar>(null);

    // 1. 初始化加载
    useEffect(() => {
        fetchData();
    }, [token, teacher.id]);

    const fetchData = async () => {
        const headers = { 'Authorization': `Bearer ${token}` };
        try {
            const coursesRes = await fetch(`${API}/courses`, { headers });
            if (coursesRes.ok) setAllCourses(await coursesRes.json());

            const configRes = await fetch(`${API}/teachers/${teacher.id}/config`, { headers });
            if (configRes.ok) {
                const data = await configRes.json();
                setMySkills(data.skills.map((s: any) => s.course_id));

                const events = data.availability.map((item: any) => {
                    const targetDate = getDateOfWeek(item.day_of_week);
                    const dateStr = targetDate.toISOString().split('T')[0];
                    return {
                        id: item.id,
                        title: '可排课',
                        start: `${dateStr}T${item.start_time}`,
                        end: `${dateStr}T${item.end_time}`,
                        backgroundColor: '#10B981', // Green-500 (已保存)
                        borderColor: '#10B981',
                        extendedProps: {
                            day_of_week: item.day_of_week,
                            start_time: item.start_time,
                            end_time: item.end_time,
                            is_new: false
                        }
                    };
                });
                setLocalEvents(events);
                setDeletedIds([]);
            }
        } catch (e) { console.error(e); }
    };

    // --- Tab 1: 技能操作 ---
    const toggleSkill = (courseId: string) => {
        setMySkills(prev => prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]);
    };

    const saveSkills = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/teachers/${teacher.id}/skills`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ course_ids: mySkills })
            });
            if (res.ok) alert("✅ 技能设置已保存");
        } catch (e) { alert("保存失败"); }
        finally { setLoading(false); }
    };

    // --- Tab 2: 时间操作 ---

    const handleDateSelect = (selectInfo: any) => {
        let dayOfWeek = selectInfo.start.getDay();
        if (dayOfWeek === 0) dayOfWeek = 7;

        const formatTime = (date: Date) => {
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        };

        const newEvent = {
            id: `temp-${Date.now()}`,
            title: '新添加',
            start: selectInfo.startStr,
            end: selectInfo.endStr,
            backgroundColor: '#3B82F6', // Blue-500 (新添加)
            borderColor: '#3B82F6',
            extendedProps: {
                day_of_week: dayOfWeek,
                start_time: formatTime(selectInfo.start),
                end_time: formatTime(selectInfo.end),
                is_new: true
            }
        };

        setLocalEvents([...localEvents, newEvent]);
        selectInfo.view.calendar.unselect();
    };

    const handleEventClick = (clickInfo: any) => {
        const event = clickInfo.event;
        const isNew = event.extendedProps.is_new;

        setLocalEvents(prev => prev.filter(e => e.id !== event.id));
        clickInfo.event.remove();

        if (!isNew) {
            setDeletedIds(prev => [...prev, event.id]);
        }
    };

    const saveAvailability = async () => {
        setSavingTime(true);
        try {
            const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
            const requests = [];

            for (const id of deletedIds) {
                requests.push(fetch(`${API}/teachers/availability/${id}`, { method: 'DELETE', headers }));
            }

            const newEvents = localEvents.filter(e => e.extendedProps.is_new);
            for (const evt of newEvents) {
                requests.push(fetch(`${API}/teachers/${teacher.id}/availability`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(evt.extendedProps)
                }));
            }

            await Promise.all(requests);
            alert("✅ 时间配置已更新");
            fetchData();
        } catch (e) {
            alert("保存部分失败，请重试");
        } finally {
            setSavingTime(false);
        }
    };

    const handleReset = () => {
        if (confirm("确定撤销所有未保存的更改吗？")) fetchData();
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-md">
            <div className="bg-gradient-to-br from-white to-slate-50/30 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[85vh] border border-slate-100">
                {/* Header - Soft UI */}
                <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50">
                    <div>
                        <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">教学配置</h3>
                        <p className="text-sm text-slate-600 mt-1 font-medium">配置 <span className="font-bold text-indigo-600">{teacher.full_name}</span> 的能力与时间</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-white/80 rounded-2xl transition-all"><X size={20} /></button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button onClick={() => setActiveTab('skills')} className={`flex-1 py-3 font-medium text-sm flex items-center justify-center gap-2 ${activeTab === 'skills' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:bg-gray-50'}`}>
                        <BookOpen size={16} /> 技能树配置
                    </button>
                    <button onClick={() => { setActiveTab('time'); setTimeout(() => calendarRef.current?.getApi().render(), 100); }} className={`flex-1 py-3 font-medium text-sm flex items-center justify-center gap-2 ${activeTab === 'time' ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50' : 'text-gray-500 hover:bg-gray-50'}`}>
                        <Clock size={16} /> 可用时间配置 (周历)
                    </button>
                </div>

                <div className="flex-1 overflow-hidden relative flex flex-col">
                    {/* Content: Skills */}
                    {activeTab === 'skills' && (
                        <div className="p-8 h-full overflow-y-auto">
                            <h4 className="font-bold text-gray-800 mb-4">勾选该老师能教授的课程：</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                                {allCourses.map(c => (
                                    <label key={c.id} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${mySkills.includes(c.id) ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'hover:bg-gray-50 border-gray-200'}`}>
                                        <input type="checkbox" checked={mySkills.includes(c.id)} onChange={() => toggleSkill(c.id)} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                                        <span className={`text-sm ${mySkills.includes(c.id) ? 'text-indigo-900 font-bold' : 'text-gray-700'}`}>{c.name_key}</span>
                                    </label>
                                ))}
                            </div>
                            <button onClick={saveSkills} disabled={loading} className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-indigo-300/50 shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 hover:scale-105">
                                <Save size={18} /> {loading ? '保存中...' : '保存技能设置'}
                            </button>
                        </div>
                    )}

                    {/* Content: Time (Calendar) */}
                    {activeTab === 'time' && (
                        <>
                            <div className="bg-green-50 px-4 py-3 text-xs text-green-800 flex items-center justify-between border-b border-green-100">
                                <div className="flex items-center gap-2">
                                    <Info size={16} className="text-green-600" />
                                    <span>操作说明：<span className="font-bold">拖拽框选</span> 添加时间 (蓝色)，<span className="font-bold">点击色块</span> 删除时间。</span>
                                </div>
                                <button onClick={handleReset} className="flex items-center gap-1 text-green-700 hover:underline"><Undo2 size={14} /> 重置更改</button>
                            </div>

                            <div className="flex-1 p-4 overflow-hidden">
                                <FullCalendar
                                    ref={calendarRef}
                                    plugins={[timeGridPlugin, interactionPlugin]}
                                    initialView="timeGridWeek"
                                    headerToolbar={false}
                                    locale="zh-cn"
                                    firstDay={1}
                                    height="100%"
                                    allDaySlot={false}
                                    slotMinTime="08:00:00"
                                    slotMaxTime="22:00:00"
                                    slotDuration="00:30:00"
                                    expandRows={true}
                                    dayHeaderContent={(arg) => arg.date.toLocaleDateString('zh-CN', { weekday: 'long' })}
                                    selectable={true}
                                    selectMirror={true}
                                    select={handleDateSelect}
                                    eventClick={handleEventClick}
                                    events={localEvents}

                                    // (★ 关键修复: 自定义渲染内容，恢复背景色)
                                    eventContent={(arg) => {
                                        return (
                                            <div
                                                className="h-full w-full p-1 rounded text-xs text-white font-medium shadow-sm flex items-center justify-center"
                                                style={{ backgroundColor: arg.event.backgroundColor }}
                                            >
                                                {arg.event.title}
                                            </div>
                                        )
                                    }}
                                />
                            </div>

                            <div className="p-4 border-t bg-white flex justify-end gap-3">
                                <button onClick={onClose} className="px-6 py-2.5 text-slate-600 hover:bg-slate-100 rounded-2xl font-bold transition-all">关闭</button>
                                <button onClick={saveAvailability} disabled={savingTime} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl hover:shadow-lg hover:shadow-emerald-300/50 shadow-md font-bold disabled:opacity-50 flex items-center gap-2 transition-all hover:scale-105">
                                    {savingTime ? '保存中...' : <><Save size={18} /> 保存时间配置</>}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}