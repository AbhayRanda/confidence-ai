import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

export default function ReportsGraph({ dataPoints }) {
  const chartData = useMemo(() => {
    if (!dataPoints || dataPoints.length === 0) return [];
    
    // Reverse datapoints to show chronologically from left to right
    const reversedData = [...dataPoints].reverse();
    return reversedData.map((d) => ({
      date: new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: Number(d.confidence_score).toFixed(1)
    }));
  }, [dataPoints]);

  if (!chartData.length) return null;

  return (
    <div className="glass-panel p-6 bg-white w-full h-[350px] flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <div className="bg-indigo-100 p-2 rounded-lg">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">Progress History</h3>
          <p className="text-xs text-slate-500">Your confidence score over time</p>
        </div>
      </div>
      
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
            <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
              itemStyle={{ color: '#4f46e5', fontWeight: 'bold' }}
            />
            <Area 
              type="monotone" 
              dataKey="score" 
              stroke="#6366f1" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorScore)" 
              activeDot={{ r: 6, strokeWidth: 0, fill: '#4f46e5' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
