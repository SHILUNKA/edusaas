/*
 * 校区端: 排课日历 (V4.0 - 沉浸式/无滚动/精美版)
 * 路径: /campus/schedule
 */
'use client';

import { API_BASE_URL } from '@/lib/config';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Plus, Calendar as CalendarIcon, User, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import CreateClassModal from './CreateClassModal';
import EditClassModal from './EditClassModal';

// --- 类型定义 ---
interface ClassDetail {
  id: string;
  course_name_key: string;
  teacher_name: string;
  teacher_id: string;
  room_name: string;
  start_time: string;
  end_time: string;
}

export default function SchedulePage() {
  const { data: session } = useSession();
  const token = session?.user?.rawToken;
  
  // 使用 ref 来手动控制日历 API (实现自定义翻页按钮)
  const calendarRef = useRef<FullCalendar>(null);

  const [events, setEvents] = useState<any[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassDetail | null>(null);
  const [currentDateTitle, setCurrentDateTitle] = useState("");

  // --- 1. 数据获取 ---
  const fetchClasses = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/base/classes`, {
          headers: { 'Authorization': `Bearer ${token}` }
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

  // --- 2. 日历控制逻辑 ---
  const handlePrev = () => {
      const api = calendarRef.current?.getApi();
      api?.prev();
      updateTitle();
  };
  const handleNext = () => {
      const api = calendarRef.current?.getApi();
      api?.next();
      updateTitle();
  };
  const handleToday = () => {
      const api = calendarRef.current?.getApi();
      api?.today();
      updateTitle();
  };
  
  const updateTitle = () => {
      const api = calendarRef.current?.getApi();
      if (api) setCurrentDateTitle(api.view.title);
  };

  // 初始化标题
  useEffect(() => {
      // 稍微延迟以确保 API 就绪
      setTimeout(updateTitle, 100);
  }, []);

  return (
    // (★ 关键 1) h-[calc(100vh-xxx)] 扣除顶栏高度，确保不出现浏览器滚动条
    <div className="flex flex-col h-[calc(100vh-80px)] bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      
      {/* --- 自定义顶部工具栏 (Header) --- */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white z-20">
        
        {/* 左侧：标题与日期导航 */}
        <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <CalendarIcon className="text-indigo-600" size={22} /> 
                排课管理
            </h1>
            
            <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200">
                <button onClick={handlePrev} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-500 hover:text-indigo-600">
                    <ChevronLeft size={18} />
                </button>
                <button onClick={handleToday} className="px-3 py-1 text-sm font-bold text-slate-700 hover:text-indigo-600 transition-colors">
                    今天
                </button>
                <button onClick={handleNext} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-500 hover:text-indigo-600">
                    <ChevronRight size={18} />
                </button>
            </div>

            <span className="text-lg font-medium text-slate-600 min-w-[150px]">
                {currentDateTitle}
            </span>
        </div>

        {/* 右侧：新建按钮 */}
        <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-full hover:bg-indigo-700 transition-all font-medium shadow-md hover:shadow-lg active:scale-95"
        >
            <Plus size={18} strokeWidth={3} /> 
            <span className="tracking-wide">新建课程</span>
        </button>
      </div>

      {/* --- 日历主体区域 --- */}
      <div className="flex-1 p-4 bg-white overflow-hidden">
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            
            // (★ 关键 2) 隐藏默认 Header，使用我们自定义的
            headerToolbar={false}
            
            // (★ 关键 3) 布局与时间设置
            locale="zh-cn"
            firstDay={1} // 周一开始
            height="100%" // 填满父容器
            expandRows={true} // 自动撑开行高，消灭空白
            stickyHeaderDates={true} // 表头固定
            allDaySlot={false} // 不显示全天
            slotMinTime="08:00:00" // 早上8点开始
            slotMaxTime="22:00:00" // 晚上10点结束
            slotDuration="00:30:00"
            
            // (★ 关键 4) 时间轴格式化: 14:00
            slotLabelFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }}

            // (★ 关键 5) 表头自定义: 星期在上，日期在下
            dayHeaderContent={(arg) => {
                const date = arg.date;
                // 格式化星期 (例如 "周一")
                const weekday = date.toLocaleDateString('zh-CN', { weekday: 'short' });
                // 格式化日期 (例如 "25")
                const dayNum = date.getDate();
                // 判断是否今天
                const isToday = date.toDateString() === new Date().toDateString();
                
                return (
                    <div className={`flex flex-col items-center py-1 ${isToday ? 'text-indigo-600' : 'text-slate-600'}`}>
                        <span className="text-xs font-medium opacity-80 mb-1">{weekday}</span>
                        <span className={`text-xl font-bold leading-none ${isToday ? 'bg-indigo-50 px-2 py-1 rounded-md' : ''}`}>
                            {dayNum}
                        </span>
                    </div>
                );
            }}

            events={events}
            eventClick={(info) => setEditingClass(info.event.extendedProps as ClassDetail)}
            
            // (★ 关键 6) 课程卡片精美渲染
            eventContent={(arg) => {
                const { course_name_key, teacher_name, room_name } = arg.event.extendedProps;
                return (
                    <div className="h-full w-full p-2 flex flex-col border-l-4 border-indigo-500 bg-indigo-50/90 hover:bg-indigo-100 transition-colors rounded-r-md shadow-sm overflow-hidden cursor-pointer">
                        <div className="font-bold text-xs md:text-sm text-indigo-900 leading-tight mb-auto">
                            {course_name_key}
                        </div>
                        <div className="mt-1 space-y-0.5">
                            <div className="text-[10px] text-indigo-700 flex items-center gap-1">
                                <User size={10} className="shrink-0" /> 
                                <span className="truncate">{teacher_name || '待定'}</span>
                            </div>
                            <div className="text-[10px] text-indigo-600/80 flex items-center gap-1">
                                <MapPin size={10} className="shrink-0" /> 
                                <span className="truncate">{room_name}</span>
                            </div>
                        </div>
                    </div>
                );
            }}
          />
      </div>

      {/* 弹窗组件保持不变 */}
      {token && (
          <CreateClassModal 
            token={token}
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSuccess={fetchClasses} 
          />
      )}
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