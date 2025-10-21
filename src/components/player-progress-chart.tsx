"use client"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis } from "recharts"

const chartConfig = {
  score: {
    label: "Puntuación de Lanzamiento",
    color: "hsl(var(--primary))",
  },
} satisfies import("@/components/ui/chart").ChartConfig

interface PlayerProgressChartProps {
    data: { month: string; score: number; fullDate?: string; analysisId?: string }[];
}

export function PlayerProgressChart({ data }: PlayerProgressChartProps) {
    return (
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <RechartsBarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value.slice(0, 3)}
            />
            <YAxis />
            <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
            />
            <Bar dataKey="score" fill="var(--color-score)" radius={4} />
            </RechartsBarChart>
        </ChartContainer>
    )
}
