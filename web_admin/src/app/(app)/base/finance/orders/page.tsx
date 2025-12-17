import { Metadata } from 'next';
import SalesOrderPage from '@/components/finance/SalesOrderPage';

// 定义页面元数据 (SEO/标题)
export const metadata: Metadata = {
  title: '销售订单管理 | 校区运营端',
  description: '管理所有团建合同、研学订单及收款状态',
};

export default function OrderManagementPage() {
  // 页面级组件只需负责渲染业务组件
  return <SalesOrderPage />;
}