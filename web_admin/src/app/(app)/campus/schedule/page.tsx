'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

// 1. 修正 Button 导入 (shadcn 默认是 named export)
import { Button } from '@/components/ui/button';

// 假设的排课数据类型
interface ClassDetail {
  id: string;
  course_name_key: string;
  teacher_name: string;
  room_name: string;
  start_time: string;
  end_time: string;
}

export default function SchedulePage() {
  const { data: session } = useSession();
  const token = session?.user?.rawToken;

  const [isBaseAdmin, setIsBaseAdmin] = useState(false);
  const [isTenantAdmin, setIsTenantAdmin] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 权限判断
  useEffect(() => {
    if (session?.user) {
      const baseId = session.user.base_id;
      setIsBaseAdmin(!!baseId);
      setIsTenantAdmin(!baseId);
    }
  }, [session]);

  // 2. 修正数据获取：直接在组件内使用 fetch，不再引用服务端的 api.ts
  useEffect(() => {
    const fetchClasses = async () => {
      if (!token) return;

      setIsLoading(true);
      try {
        // 注意：客户端 fetch 需要访问 localhost (通过 Next.js 转发或直接访问)
        // 这里假设你已经配置了 Next.js rewrite 或者后端允许跨域
        const res = await fetch('http://localhost:8000/api/v1/base/classes', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!res.ok) {
          console.error("API Error:", res.status);
          return;
        }

        const classDetails: ClassDetail[] = await res.json();

        const calendarEvents = classDetails.map(cls => ({
          id: cls.id,
          title: `${cls.course_name_key} (${cls.teacher_name})`,
          start: cls.start_time,
          end: cls.end_time,
          extendedProps: cls,
        }));
        
        setEvents(calendarEvents);

      } catch (error) {
        console.error("Failed to fetch classes:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchClasses();
  }, [token]);

  const handleDateClick = (arg: any) => {
    if (isBaseAdmin) {
      console.log("Date clicked:", arg.dateStr);
      setIsModalOpen(true);
    }
  };

  const handleEventClick = (arg: any) => {
    console.log("Event clicked:", arg.event.extendedProps);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">排课日历</h1>
        
        {isBaseAdmin && (
          /* 3. 确保 Button 组件被正确使用 */
          <Button onClick={() => setIsModalOpen(true)}>
            新建排课
          </Button>
        )}
        {isTenantAdmin && (
          <span className="text-sm text-gray-500">(总部只读视图)</span>
        )}
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md">
        {isLoading ? (
          <div>正在加载日历...</div>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            events={events}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            locale="zh-cn"
            height="auto"
            allDaySlot={false}
            slotMinTime="08:00:00"
            slotMaxTime="22:00:00"
          />
        )}
      </div>
    </div>
  );
}