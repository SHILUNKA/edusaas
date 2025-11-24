// src/app/(app)/campus/schedule/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react'; // (假设你使用 NextAuth.js)
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction'; // (用于点击事件)

// 假设你有一个 apiGet 函数和类型定义
import { apiGet } from '@/lib/api'; 
// 假设这是从你后端 models.rs 导出的类型
// interface ClassDetail {
//   id: string;
//   course_name_key: string;
//   teacher_name: string;
//   room_name: string;
//   start_time: string; // (ISO 8601 string)
//   end_time: string;   // (ISO 8601 string)
//   // ... 其他来自 ClassDetail 的字段
// }

// 假设你有 Button 和 Modal 组件
import { Button } from '@/components/ui/button';
// import { CreateClassModal } from './_components/CreateClassModal';

export default function SchedulePage() {
  const { data: session } = useSession();
  const token = session?.user?.token; // (或你的 token 路径)

  // --- (★ 关键逻辑 1: 权限控制) ---
  const [isBaseAdmin, setIsBaseAdmin] = useState(false);
  const [isTenantAdmin, setIsTenantAdmin] = useState(false);

  // --- (★ 关键逻辑 2: 状态管理) ---
  const [events, setEvents] = useState([]); // (用于 FullCalendar 的事件)
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (session?.user) {
      // 根据 base_id 是否存在来设置角色
      const baseId = session.user.base_id;
      setIsBaseAdmin(!!baseId);
      setIsTenantAdmin(!baseId);
    }
  }, [session]);

  // --- (★ 关键逻辑 3: 加载排课数据) ---
  useEffect(() => {
    const fetchClasses = async () => {
      if (!token) return;

      setIsLoading(true);
      try {
        // (★ 提醒: 后端 get_base_classes 需修改)
        // (需支持无 base_id 的 Tenant Admin 调用)
        const classDetails: any[] = await apiGet('/api/v1/base/classes', token);

        // 将后端数据 转换为 FullCalendar 需要的格式
        const calendarEvents = classDetails.map(cls => ({
          id: cls.id,
          title: `${cls.course_name_key || '课程'} (${cls.teacher_name || '老师'}) @ ${cls.room_name || '教室'}`,
          start: cls.start_time,
          end: cls.end_time,
          extendedProps: cls, // (存储完整数据)
        }));
        
        setEvents(calendarEvents);

      } catch (error) {
        console.error("Failed to fetch classes:", error);
        // (在这里添加 Toast 错误提示)
      } finally {
        setIsLoading(false);
      }
    };

    fetchClasses();
  }, [token]); // 当 token 准备好后执行

  const handleDateClick = (arg: any) => {
    // (★ 权限控制) 只有基地管理员能通过点击创建
    if (isBaseAdmin) {
      console.log("Date clicked:", arg.dateStr);
      // (我们可以在这里设置默认日期并打开模态框)
      setIsModalOpen(true);
    }
  };

  const handleEventClick = (arg: any) => {
    // (点击日历上的事件)
    console.log("Event clicked:", arg.event.extendedProps);
    // (★ 第二步: 我们将在这里打开 "课程报名/花名册" 模态框)
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">排课日历</h1>
        
        {/* --- (★ 关键逻辑 4: 条件渲染 "创建" 按钮) --- */}
        {isBaseAdmin && (
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
            initialView="timeGridWeek" // (以 "周" 视图开始)
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            events={events}
            dateClick={handleDateClick}    // (点击空白处)
            eventClick={handleEventClick}   // (点击已有事件)
            locale="zh-cn" // (设置中文)
            height="auto"
          />
        )}
      </div>

      {/* --- (★ 下一步实现) ---
        {isBaseAdmin && isModalOpen && (
          <CreateClassModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            // (我们还需要一个 onSave 成功后刷新日历的函数)
          />
        )}
      */}
    </div>
  );
}