import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
    title: string;
    value: string | number;
    description?: string;
    icon?: React.ReactNode;
    trend?: "up" | "down" | "neutral";
    trendValue?: string;
    className?: string;
}

export function StatCard({ title, value, description, icon, trend, trendValue, className }: StatCardProps) {
    return (
        <Card className={cn("overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300", className)}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                {icon && <div className="h-4 w-4 text-primary">{icon}</div>}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-foreground">{value}</div>
                {(description || trendValue) && (
                    <div className="flex items-center text-xs mt-1">
                        {trendValue && (
                            <span className={cn("mr-2 font-medium",
                                trend === "up" ? "text-green-500" :
                                    trend === "down" ? "text-red-500" : "text-muted-foreground"
                            )}>
                                {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
                            </span>
                        )}
                        <span className="text-muted-foreground opacity-80">{description}</span>
                    </div>
                )}
                {/* Decorative bottom gradient line */}
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20 opacity-20" />
            </CardContent>
        </Card>
    );
}
