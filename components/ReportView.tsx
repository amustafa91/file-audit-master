import React from 'react';
import { FileChangeEvent, ChangeType } from '/types.ts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Icon from '/components/Icon.tsx';

interface ReportViewProps {
  changes: FileChangeEvent[];
  className?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const ReportView: React.FC<ReportViewProps> = ({ changes, className }) => {
  const summary = changes.reduce(
    (acc, change) => {
      acc[change.type] = (acc[change.type] || 0) + 1;
      return acc;
    },
    {} as { [key in ChangeType]?: number }
  );
  
  const userSummary = changes.reduce((acc, change) => {
      acc[change.user] = (acc[change.user] || 0) + 1;
      return acc;
  }, {} as {[key: string]: number});
  
  const userChartData = Object.entries(userSummary).map(([name, value]) => ({ name, value }));


  const barChartData = [
    {
      name: 'Changes',
      [ChangeType.CREATED]: summary[ChangeType.CREATED] || 0,
      [ChangeType.MODIFIED]: summary[ChangeType.MODIFIED] || 0,
      [ChangeType.DELETED]: summary[ChangeType.DELETED] || 0,
    },
  ];

  const totalChanges = changes.length;

  const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: number, colorClass: string }> = ({ icon, label, value, colorClass }) => (
    <div className="bg-base-100 p-4 rounded-lg border border-border flex items-center">
        <div className={`p-3 rounded-full mr-4 ${colorClass}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm text-text-secondary">{label}</p>
            <p className="text-2xl font-bold text-text-primary">{value}</p>
        </div>
    </div>
  );

  return (
    <div className={`bg-base-100 rounded-lg border border-border p-4 flex flex-col ${className}`}>
      <h3 className="text-lg font-semibold text-text-primary mb-4 flex-shrink-0">Report Summary</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 flex-shrink-0">
        <StatCard 
            icon={<Icon name="pencil" className="w-6 h-6 text-blue-800"/>} 
            label="Total Changes" 
            value={totalChanges} 
            colorClass="bg-blue-100"
        />
        <StatCard 
            icon={<Icon name="plus-circle" className="w-6 h-6 text-green-800"/>}
            label="Files Created" 
            value={summary.CREATED || 0}
            colorClass="bg-green-100"
        />
        <StatCard 
            icon={<Icon name="pencil" className="w-6 h-6 text-indigo-800"/>}
            label="Files Modified" 
            value={summary.MODIFIED || 0}
            colorClass="bg-indigo-100"
        />
        <StatCard 
            icon={<Icon name="trash" className="w-6 h-6 text-red-800"/>}
            label="Files Deleted" 
            value={summary.DELETED || 0}
            colorClass="bg-red-100"
        />
      </div>

      <div className="flex flex-col md:flex-row gap-8 flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          <h4 className="text-md font-semibold text-text-primary mb-2 text-center flex-shrink-0">Changes by Type</h4>
          <div className="relative w-full flex-1">
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={{ stroke: '#d9d9d9' }} tickLine={{ stroke: '#d9d9d9' }} tick={{ fill: '#606060', fontSize: 12 }} />
                    <YAxis allowDecimals={false} axisLine={{ stroke: '#d9d9d9' }} tickLine={{ stroke: '#d9d9d9' }} tick={{ fill: '#606060', fontSize: 12 }}/>
                    <Tooltip
                    contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(5px)',
                        border: '1px solid #d9d9d9',
                        borderRadius: '8px',
                    }}
                    />
                    <Legend wrapperStyle={{fontSize: "14px"}}/>
                    <Bar dataKey={ChangeType.CREATED} fill="#10B981" name="Created" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={ChangeType.MODIFIED} fill="#6366F1" name="Modified" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={ChangeType.DELETED} fill="#EF4444" name="Deleted" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <h4 className="text-md font-semibold text-text-primary mb-2 text-center flex-shrink-0">Changes by Author</h4>
          <div className="relative w-full flex-1">
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                      <Pie
                          data={userChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius="80%"
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                      >
                          {userChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                      </Pie>
                      <Tooltip 
                           contentStyle={{
                              backgroundColor: 'rgba(255, 255, 255, 0.9)',
                              backdropFilter: 'blur(5px)',
                              border: '1px solid #d9d9d9',
                              borderRadius: '8px',
                          }}
                      />
                      <Legend wrapperStyle={{fontSize: "14px"}}/>
                  </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportView;