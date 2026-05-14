import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  subtitle?: string;
  colorClass?: string; 
  path?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  subtitle, 
  colorClass = 'blue', 
  path,
}) => {
  const navigate = useNavigate();
  const isClickable = !!path;

  const handleClick = () => {
    if (path) navigate(path);
  };

  // Determine trend direction
  const isUp = trend?.startsWith('+') || trend?.includes('up');
  const isDown = trend?.startsWith('-') || trend?.includes('down');

  return (
    <div 
      className={`leh-stat-card ${colorClass} ${isClickable ? 'clickable' : ''}`}
      onClick={handleClick}
      style={{ cursor: isClickable ? 'pointer' : 'default' }}
    >
      <div className="leh-stat-card-top">
        <span className="leh-stat-title">{title}</span>
        <div className="leh-stat-icon-box">
          <Icon size={18} />
        </div>
      </div>

      <div className="leh-stat-value">{value}</div>
      
      <div className="leh-stat-bottom">
        {trend && (
          <span className={isUp ? 'leh-trend-up' : isDown ? 'leh-trend-down' : ''} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700' }}>
            {isUp && <TrendingUp size={12} />}
            {isDown && <TrendingDown size={12} />}
            {trend}
          </span>
        )}
        <span style={{ color: 'var(--leh-text-light)' }}>{subtitle}</span>
      </div>
    </div>
  );
};
