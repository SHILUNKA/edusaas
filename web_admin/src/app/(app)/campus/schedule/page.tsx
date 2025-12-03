/*
 * 校区端: 排课日历 (V14.6 - 修复图标缺失版)
 * 路径: /campus/schedule/page.tsx
 * 功能:
 * 1. AI 智能排课
 * 2. 批量排课向导 (Batch Wizard)
 * 3. 交互排课 (框选/点击)
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { 
    Calendar as CalendarIcon, User, MapPin, ChevronLeft, ChevronRight, 
    Plus, Sparkles, CalendarRange // (★ 修复: 确保导入了 CalendarRange)
} from 'lucide-react';
import CreateClassModal from './CreateClassModal';
import EditClassModal from './EditClassModal';
import BatchScheduleWizard from './BatchScheduleWizard'; // (★ 确保导入了向导组件)
import { API_BASE_URL } from '@/lib/config';

// --- 类型定义 ---
interface ClassDetail {
  id: string;
  course_name_key: string;
  teacher_names: string | null; 
  room_name: string;
  start_time: string;
  end_time: string;
  room_rows?: number;
  room_columns?: number;
}

// --- 配色方案 ---
const COLOR_PALETTES = [
    { border: 'border-indigo-500', bg: 'bg-indigo-50/90', hover: 'hover:bg-indigo-100', textTitle: 'text-indigo-900', textSub: 'text-indigo-700', icon: 'text-indigo-600/80' },
    { border: 'border-emerald-500', bg: 'bg-emerald-50/90', hover: 'hover:bg-emerald-100', textTitle: 'text-emerald-900', textSub: 'text-emerald-700', icon: 'text-emerald-600/80' },
    { border: 'border-amber-500', bg: 'bg-amber-50/90', hover: 'hover:bg-amber-100', textTitle: 'text-amber-900', textSub: 'text-amber-700', icon: 'text-amber-600/80' },
    { border: 'border-rose-500', bg: 'bg-rose-50/90', hover: 'hover:bg-rose-100', textTitle: 'text-rose-900', textSub: 'text-rose-700', icon: 'text-rose-600/80' },
    { border: 'border-cyan-500', bg: 'bg-cyan-50/90', hover: 'hover:bg-cyan-100', textTitle: 'text-cyan-900', textSub: 'text-cyan-700', icon: 'text-cyan-600/80' },
    { border: 'border-violet-500', bg: 'bg-violet-50/90', hover: 'hover:bg-violet-100', textTitle: 'text-violet-900', textSub: 'text-violet-700', icon: 'text-violet-600/80' },
];

const getColorForCourse = (courseName: string | null | undefined) => {
    if (!courseName) return COLOR_PALETTES[0]; 
    let hash = 0;
    for (let i = 0; i < courseName.length; i++) {
        hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % COLOR_PALETTES.length;
    return COLOR_PALETTES[index];
};

export default function SchedulePage() {
  const { data: session } = useSession();
  const token = session?.user?.rawToken;
  const API = API_BASE_URL;
  
  const calendarRef = useRef<FullCalendar>(null);

  // --- 状态管理 ---
  const [events, setEvents] = useState<any[]>([]);
  const [currentDateTitle, setCurrentDateTitle] = useState("");
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false); // (★ 批量向导状态)
  const [editingClass, setEditingClass] = useState<ClassDetail | null>(null);
  const [selectedSlotDate, setSelectedSlotDate] = useState<{ start: Date, end: Date } | null>(null);

  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- 1. 数据获取 ---
  const fetchClasses = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API}/base/classes?_t=${new Date().getTime()}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          cache: 'no-store', 
        });
        
        if (res.ok) {
            const data: ClassDetail[] = await res.json();
            const calendarEvents = data.map(cls => ({
              id: cls.id,
              title: cls.course_name_key, 
              start: cls.start_time,
              end: cls.end_time,
              extendedProps: { ...cls },
            }));
            setEvents(calendarEvents);
        }
      } catch (error) {
        console.error("Failed to fetch classes:", error);
      }
  };

  useEffect(() => {
    fetchClasses();
  }, [token]);

  // --- 2. AI 智能排课 ---
  const handleAutoSchedule = async () => {
      if (!confirm("🤖 确认启动 AI 智能排课？")) return;
      setIsAiLoading(true);
      try {
          const res = await fetch(`${API}/base/schedule/auto-generate`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
              const data = await res.json();
              alert(`🎉 排课完成！\n${data.message}`);
              fetchClasses(); 
          } else { throw new Error("AI Error"); }
      } catch (e) { alert("排课失败"); } 
      finally { setIsAiLoading(false); }
  };

  // --- 3. 日历控制 ---
  const handlePrev = () => { calendarRef.current?.getApi().prev(); updateTitle(); };
  const handleNext = () => { calendarRef.current?.getApi().next(); updateTitle(); };
  const handleToday = () => { calendarRef.current?.getApi().today(); updateTitle(); };
  const updateTitle = () => { if (calendarRef.current) setCurrentDateTitle(calendarRef.current.getApi().view.title); };

  useEffect(() => { setTimeout(updateTitle, 100); }, []);

  // --- 4. 交互处理 ---
  const handleDateSelect = (selectInfo: any) => {
      setSelectedSlotDate({ start: selectInfo.start, end: selectInfo.end });
      setIsCreateModalOpen(true);
  };

  const handleEventClick = (info: any) => {
      if (info.event.extendedProps?.id) {
          const classData = info.event.extendedProps as ClassDetail;
          setEditingClass(classData);
      }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white z-20">
        <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <CalendarIcon className="text-indigo-600" size={22} /> 
                排课管理 (本周)
            </h1>
            <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200">
                <button onClick={handlePrev} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-500"><ChevronLeft size={18} /></button>
                <button onClick={handleToday} className="px-3 py-1 text-sm font-bold text-slate-700 hover:text-indigo-600">今天</button>
                <button onClick={handleNext} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-500"><ChevronRight size={18} /></button>
            </div>
            <span className="text-lg font-medium text-slate-600 min-w-[150px]">{currentDateTitle}</span>
        </div>

        <div className="flex items-center gap-3">
            {/* (★ 新增: 批量排课按钮) */}
            <button 
                onClick={() => setIsBatchModalOpen(true)}
                className="flex items-center gap-2 bg-white border border-indigo-100 text-indigo-700 px-4 py-2 rounded-full hover:bg-indigo-50 hover:border-indigo-200 shadow-sm transition-all"
            >
                <CalendarRange size={18} strokeWidth={2} />
                <span className="font-bold text-sm">批量排课向导</span>
            </button>

            {/* (AI 按钮) */}
            <button onClick={handleAutoSchedule} disabled={isAiLoading} className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-full hover:opacity-90 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {isAiLoading ? <span className="animate-spin">✨</span> : <Sparkles size={18} strokeWidth={2} />}
                <span className="font-bold tracking-wide text-sm">{isAiLoading ? 'AI 计算中...' : '一键智能排课'}</span>
            </button>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 p-4 bg-white overflow-hidden">
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={false}
            locale="zh-cn"
            firstDay={1} 
            height="100%" 
            expandRows={true} 
            stickyHeaderDates={true} 
            allDaySlot={false} 
            slotMinTime="08:00:00" 
            slotMaxTime="22:00:00" 
            slotDuration="00:30:00"
            selectable={true}         
            selectMirror={true}
            select={handleDateSelect} 
            eventClick={handleEventClick} 
            slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            dayHeaderContent={(arg) => {
                const date = arg.date;
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                    <div className={`flex flex-col items-center py-1 ${isToday ? 'text-indigo-600' : 'text-slate-600'}`}>
                        <span className="text-xs font-medium opacity-80 mb-1">{date.toLocaleDateString('zh-CN', { weekday: 'short' })}</span>
                        <span className={`text-xl font-bold leading-none ${isToday ? 'bg-indigo-50 px-2 py-1 rounded-md' : ''}`}>{date.getDate()}</span>
                    </div>
                );
            }}

            events={events}
            
            eventContent={(arg) => {
                const { course_name_key, teacher_names, room_name } = arg.event.extendedProps;
                
                if (!course_name_key) {
                    return (
                        <div className="h-full w-full p-1 bg-indigo-50/50 border-2 border-dashed border-indigo-300 rounded-md flex items-center justify-center text-xs text-indigo-500 font-bold">
                            <Plus size={14} /> 新建...
                        </div>
                    );
                }

                const colors = getColorForCourse(course_name_key); 
                return (
                    <div className={`h-full w-full p-2 flex flex-col border-l-4 rounded-r-md shadow-sm overflow-hidden cursor-pointer group transition-colors ${colors.border} ${colors.bg} ${colors.hover}`}>
                        <div className={`font-bold text-xs md:text-sm leading-tight mb-auto ${colors.textTitle}`}>
                            {course_name_key}
                        </div>
                        <div className="mt-1 space-y-0.5">
                            <div className={`text-[10px] flex items-center gap-1 opacity-90 group-hover:opacity-100 ${colors.textSub}`}>
                                <User size={10} className="shrink-0" /> 
                                <span className="truncate">{teacher_names || '待定'}</span>
                            </div>
                            <div className={`text-[10px] flex items-center gap-1 opacity-80 group-hover:opacity-100 ${colors.icon}`}>
                                <MapPin size={10} className="shrink-0" /> 
                                <span className="truncate">{room_name}</span>
                            </div>
                        </div>
                    </div>
                );
            }}
          />
      </div>

      {/* 弹窗 1: 框选新建 */}
      {token && (
          <CreateClassModal 
            token={token}
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSuccess={fetchClasses} 
            initialRange={selectedSlotDate} 
          />
      )}

      {/* 弹窗 2: 批量向导 (★ 新增渲染) */}
      {token && isBatchModalOpen && (
          <BatchScheduleWizard 
            token={token}
            onClose={() => setIsBatchModalOpen(false)}
            onSuccess={fetchClasses}
          />
      )}

      {/* 弹窗 3: 编辑/点名 */}
      {token && editingClass && (
          <EditClassModal 
            token={token}
            classData={editingClass}
            onClose={() => setEditingClass(null)}
            onSuccess={fetchClasses} 
          />
      )}
    </div>
  );
}