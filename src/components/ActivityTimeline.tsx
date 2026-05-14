import React from 'react';


interface ActivityItem {
  time: string;
  message: string;
  type: 'clinical' | 'payment' | 'admin';
}

interface ActivityTimelineProps {
  activities: ActivityItem[];
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ activities }) => {
  const getDotColor = (type: string) => {
    switch (type) {
      case 'clinical': return 'blue';
      case 'payment': return 'green';
      case 'admin': return 'amber';
      default: return 'blue';
    }
  };

  return (
    <div className="timeline">
      {activities.map((item, index) => (
        <div key={index} className="timeline-item">
          <div className={`timeline-dot ${getDotColor(item.type)}`} />
          <div className="timeline-content">
            <div className="timeline-header">
              <p className="timeline-message">{item.message}</p>
              <span className="timeline-time">{item.time}</span>
            </div>
          </div>
        </div>
      ))}
      {activities.length === 0 && (
        <div className="py-8 text-center text-slate-400">
          <p className="text-sm font-medium">No activity recorded today</p>
        </div>
      )}
    </div>
  );
};
