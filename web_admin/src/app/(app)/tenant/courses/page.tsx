/*
 * B端后台: 中央课程库 (Courses) 管理页面
 * 路径: /tenant/courses
 */
'use client'; 

import { useState, useEffect, FormEvent } from 'react';
import { useAuthStore } from '@/store/authStore';

// 1. 定义 "课程" 的 TypeScript 类型
// (必须与 Rust 'Course' 结构体匹配)
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

// 2. 定义我们的 React 页面组件
export default function CoursesPage() {
    
    // --- 状态管理 ---
    const [courses, setCourses] = useState<Course[]>([]); // 课程列表
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- 表单状态 ---
    // (我们只实现了简化版的表单)
    const [nameKey, setNameKey] = useState("");
    const [descriptionKey, setDescriptionKey] = useState("");
    const [duration, setDuration] = useState("60");
    const [points, setPoints] = useState("0");
    
    const token = useAuthStore((state) => state.token);
    const API_URL = 'http://localhost:8000/api/v1/courses'; // <-- (注意: API URL 已更改)

    // --- 核心逻辑 ---

    // 3. 'GET' 数据获取函数
    const fetchCourses = async () => {
        if (!token) return; 

        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(API_URL, {
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

    // 4. 页面加载时自动获取数据
    useEffect(() => {
        if (token) {
            fetchCourses();
        }
    }, [token]); 

    // 5. 'POST' 表单提交函数
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
            // (我们暂时不支持在 UI 上选择 "前置课程")
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
            setNameKey(''); // 清空表单
            setDescriptionKey('');
            setDuration('60');
            setPoints('0');
            
            fetchCourses(); // 自动刷新列表!

        } catch (e) {
            setError((e as Error).message);
            alert(`创建失败: ${(e as Error).message}`);
        }
    };

    // --- 7. 页面渲染 (JSX) ---
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">总部管理: 中央课程库</h1>
            
            {/* --- (A) 创建新课程的表单 --- */}
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

            {/* --- (B) 已有课程的列表 --- */}
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