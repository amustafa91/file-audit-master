import React from 'react';
import { ChangeType, ReportSummary, UserSummary } from '/types.ts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Icon from '/components/Icon.tsx';

interface ReportViewProps {
  totalChanges: number;
  summary: ReportSummary;
  userSummary: UserSummary;
  className?: string;
  isExporting: boolean;
  onExport: () => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const ReportView: React.FC<ReportViewProps> = ({ totalChanges, summary, userSummary, className, isExporting, onExport }) => {
  const userChartData = Object.entries(userSummary).map(([name, value]) => ({ name, value }));

  const barChartData = [
    {
      name: 'Changes',
      [ChangeType.CREATED]: summary[ChangeType.CREATED] || 0,
      [ChangeType.MODIFIED]: summary[ChangeType.MODIFIED] || 0,
      [ChangeType.DELETED]: summary[ChangeType.DELETED] || 0,
    },
  ];

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
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h3 className="text-lg font-semibold text-text-primary">Report Summary</h3>
            <div className="flex items-center gap-4">
                <div className="bg-blue-50 border-l-4 border-blue-400 p-2 text-xs text-blue-800 rounded-r-md">
                    <p>This summary shows totals for <strong>all {totalChanges.toLocaleString()} filtered changes</strong>, not just the current page.</p>
                </div>
                <button
                    onClick={onExport}
                    disabled={isExporting || totalChanges === 0}
                    className="flex items-center justify-center px-3 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                    {isExporting ? (
                        <>
                            <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Exporting...</span>
                        </>
                    ) : (
                        <>
                            <Icon name="export" className="w-5 h-5 mr-1.5" />
                            <span>Export to CSV</span>
                        </>
                    )}
                </button>
            </div>
        </div>

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