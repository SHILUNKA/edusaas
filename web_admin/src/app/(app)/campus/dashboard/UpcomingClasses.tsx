// src/components/dashboard/campus/UpcomingClasses.tsx
"use client"; // 这是一个客户端组件

export function UpcomingClasses({ classes }: { classes: any[] }) {
  
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">今日排课</h2>
      {classes.length === 0 ? (
        <p className="text-gray-500">今天没有已安排的课程。</p>
      ) : (
        <ul className="space-y-4">
          {classes.map((cls) => (
            <li key={cls.id} className="p-4 border rounded-lg">
              <p className="font-semibold">{cls.course_name_key}</p>
              <p className="text-sm text-gray-600">
                {formatTime(cls.start_time)}
                {" - "}
                {cls.teacher_name || 'N/A'} / {cls.room_name || 'N/A'}
              </p>
              {/* (未来 V1.2: <p>已报名: {cls.enrollment_count} / {cls.max_capacity}</p>) */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}