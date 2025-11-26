/*
 * B端后台: 中央课程库 (Courses) 管理页面
 * 路径: /tenant/courses
 * 修复: 替换 useAuthStore 为 useSession
 */
'use client'; 

import { API_BASE_URL } from '@/lib/config';

import { useState, useEffect, FormEvent } from 'react';
// 1. 修改导入
import { useSession } from 'next-auth/react';

interface Course {
    id: string;
    tenant_id: string;
    name_key: string;
    description_key: string | null;
    target_audience_key: string | null;
    default_duration_minutes: number;
    points_awarded: number;
    prerequisite_course_id: string | null;
    is_active: boolean;
}

export default function CoursesPage() {
    
    const [courses, setCourses] = useState<Course[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [nameKey, setNameKey] = useState("");
    const [descriptionKey, setDescriptionKey] = useState("");
    const [duration, setDuration] = useState("60");
    const [points, setPoints] = useState("0");
    
    // 2. 修改 Token 获取
    const { data: session } = useSession();
    const token = session?.user?.rawToken;

    const fetchCourses = async () => {
        if (!token) return; 

        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/courses`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data: Course[] = await response.json();
            setCourses(data);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchCourses();
        }
    }, [token]); 

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token) {
            alert("认证失效，请重新登录");
            return;
        }

        const payload = {
            name_key: nameKey,
            description_key: descriptionKey || null,
            default_duration_minutes: parseInt(duration, 10),
            points_awarded: parseInt(points, 10),
            prerequisite_course_id: null, 
            target_audience_key: null,
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`, 
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`创建课程失败. Status: ${response.status}`);
            }

            alert('课程创建成功!');
            setNameKey('');
            setDescriptionKey('');
            setDuration('60');
            setPoints('0');
            
            fetchCourses();

        } catch (e) {
            setError((e as Error).message);
            alert(`创建失败: ${(e as Error).message}`);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">总部管理: 中央课程库</h1>
            
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-semibold mb-4">定义新课程</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            课程名称 (Key) (例如: "course.rocket.101")
                        </label>
                        <input
                            type="text"
                            value={nameKey}
                            onChange={(e) => setNameKey(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            required
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                默认时长 (分钟)
                            </label>
                            <input
                                type="number"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                奖励积分
                            </label>
                            <input
                                type="number"
                                value={points}
                                onChange={(e) => setPoints(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            描述 (Key) (可选)
                        </label>
                        <input
                            type="text"
                            value={descriptionKey}
                            onChange={(e) => setDescriptionKey(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        创建课程
                    </button>
                </form>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">课程列表</h2>
                {isLoading && <p>正在加载列表...</p>}
                {error && <p className="text-red-500">加载失败: {error}</p>}
                
                {!isLoading && !error && (
                    <ul className="divide-y divide-gray-200">
                        {courses.length === 0 ? (
                            <p>还没有定义任何课程。</p>
                        ) : (
                            courses.map(course => (
                                <li key={course.id} className="py-4">
                                    <p className="text-lg font-medium text-indigo-600">{course.name_key}</p>
                                    <p className="text-sm text-gray-500">
                                        时长: {course.default_duration_minutes} 分钟 | 奖励: {course.points_awarded} 积分
                                    </p>
                                    <span className="text-xs text-gray-400">ID: {course.id.substring(0, 8)}...</span>
                                </li>
                            ))
                        )}
                    </ul>
                )}
            </div>
        </div>
    );
}