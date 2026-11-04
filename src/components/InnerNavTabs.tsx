import React from 'react';
import { ChevronRight } from 'lucide-react';
import './InnerNavTabs.css';

export interface InnerNavTabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }> | React.ReactNode;
  badge?: string | number;
  statusIcon?: React.ReactNode;
  tooltip?: string;
  disabled?: boolean;
}

export interface InnerNavTabsProps<T extends string = string> {
  tabs: InnerNavTabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  orientation?: 'horizontal' | 'vertical';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  scrollable?: boolean;
  showChevron?: boolean;
  showChevronOnActive?: boolean;
  className?: string;
  style?: React.CSSProperties;
  tabStyle?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
}

export function InnerNavTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  orientation = 'horizontal',
  size = 'medium',
  fullWidth = false,
  scrollable = false,
  showChevron = true,
  showChevronOnActive,
  className = '',
  style,
  tabStyle,
  containerStyle,
}: InnerNavTabsProps<T>) {
  const containerClasses = [
    'inner-nav-container',
    orientation === 'vertical' ? 'inner-nav-container--vertical' : '',
    fullWidth ? 'inner-nav-container--full-width' : '',
    scrollable ? 'inner-nav-container--scrollable' : '',
    size === 'small' ? 'inner-nav-container--small' : '',
    size === 'large' ? 'inner-nav-container--large' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses} style={{ ...containerStyle, ...style }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        const renderIcon = () => {
          if (!tab.icon) return null;
          if (React.isValidElement(tab.icon)) {
            return <span className="inner-nav-tab-icon">{tab.icon}</span>;
          }
          if (typeof tab.icon === 'function') {
            const IconComponent = tab.icon as React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
            return (
              <span className="inner-nav-tab-icon">
                <IconComponent size={size === 'small' ? 14 : size === 'large' ? 20 : 16} />
              </span>
            );
          }
          return null;
        };

        const renderChevron = () => {
          if (orientation !== 'vertical' || showChevron === false) return null;
          if (showChevronOnActive && !isActive) return null;
          return (
            <ChevronRight
              size={14}
              className="inner-nav-tab-chevron"
              style={{
                marginLeft: tab.statusIcon ? '4px' : 'auto',
                opacity: isActive ? 1 : 0.5,
                color: isActive ? '#ffffff' : '#94a3b8',
                transition: 'all 0.2s ease',
                transform: isActive ? 'translateX(2px)' : 'none',
              }}
            />
          );
        };

        return (
          <button
            key={tab.id}
            type="button"
            disabled={tab.disabled}
            data-tooltip={tab.tooltip}
            onClick={() => !tab.disabled && onChange(tab.id)}
            className={`inner-nav-tab ${isActive ? 'inner-nav-tab--active' : ''}`}
            style={tabStyle}
          >
            {renderIcon()}
            <span className="inner-nav-tab-label">{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== null && (
              <span className="inner-nav-tab-badge">{tab.badge}</span>
            )}
            {tab.statusIcon && (
              <span className="inner-nav-tab-status-icon" style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 'auto' }}>
                {tab.statusIcon}
              </span>
            )}
            {renderChevron()}
          </button>
        );
      })}
    </div>
  );
}

export default InnerNavTabs;
