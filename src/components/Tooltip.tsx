import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ text, children, position = 'top', className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [actualPosition, setActualPosition] = useState(position);
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => setIsVisible(true);
  const hideTooltip = () => {
    setIsVisible(false);
    setCoords(null);
  };

  useLayoutEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let top = 0;
      let left = 0;
      let finalPos = position;

      // Smart flip logic
      if (position === 'top' && triggerRect.top - tooltipRect.height < 10) finalPos = 'bottom';
      else if (position === 'bottom' && triggerRect.bottom + tooltipRect.height > viewportHeight - 10) finalPos = 'top';

      setActualPosition(finalPos);

      switch (finalPos) {
        case 'top':
          top = triggerRect.top - tooltipRect.height - 8;
          left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
          break;
        case 'bottom':
          top = triggerRect.bottom + 8;
          left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
          break;
        case 'left':
          top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
          left = triggerRect.left - tooltipRect.width - 8;
          break;
        case 'right':
          top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
          left = triggerRect.right + 8;
          break;
      }

      // Constrain to viewport
      left = Math.max(10, Math.min(left, viewportWidth - tooltipRect.width - 10));
      top = Math.max(10, Math.min(top, viewportHeight - tooltipRect.height - 10));

      setCoords({ top, left });
    }
  }, [isVisible, position]);

  if (!text) return <>{children}</>;

  const child = React.Children.only(children) as React.ReactElement<any>;

  return (
    <>
      {React.cloneElement(child, {
        className: `${(child.props as any).className || ''} ${className}`.trim(),
        ref: (node: any) => {
          // Merge refs if the child has one
          (triggerRef as any).current = node;
          const { ref } = child as any;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        },
        onMouseEnter: (e: React.MouseEvent) => {
          showTooltip();
          if ((child.props as any).onMouseEnter) (child.props as any).onMouseEnter(e);
        },
        onMouseLeave: (e: React.MouseEvent) => {
          hideTooltip();
          if ((child.props as any).onMouseLeave) (child.props as any).onMouseLeave(e);
        }
      })}
      
      {isVisible && createPortal(
        <div 
          ref={tooltipRef}
          className={`tooltip tooltip-${actualPosition}`}
          style={{ 
            position: 'fixed',
            top: coords ? `${coords.top}px` : '-9999px', 
            left: coords ? `${coords.left}px` : '-9999px',
            opacity: coords ? 1 : 0,
            zIndex: 9999999,
            pointerEvents: 'none',
            transition: 'opacity 0.15s ease',
            width: 'max-content'
          }}
        >
          {text}
        </div>,
        document.body
      )}
    </>
  );
};
