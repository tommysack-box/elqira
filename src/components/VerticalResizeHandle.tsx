import { useEffect, useRef } from 'react';

interface VerticalResizeHandleProps {
  onResizeStart?: () => void;
  onResize: (deltaY: number) => void;
  onResizeEnd?: () => void;
}

export function VerticalResizeHandle({ onResizeStart, onResize, onResizeEnd }: VerticalResizeHandleProps) {
  const dragStartYRef = useRef<number | null>(null);
  const onResizeRef = useRef(onResize);
  const onResizeEndRef = useRef(onResizeEnd);
  const onResizeStartRef = useRef(onResizeStart);

  useEffect(() => {
    onResizeRef.current = onResize;
    onResizeEndRef.current = onResizeEnd;
    onResizeStartRef.current = onResizeStart;
  });

  useEffect(() => {
    const handlePointerMove = (event: MouseEvent) => {
      if (dragStartYRef.current === null) return;
      onResizeRef.current(event.clientY - dragStartYRef.current);
    };

    const stopResize = () => {
      if (dragStartYRef.current === null) return;
      dragStartYRef.current = null;
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
      onResizeEndRef.current?.();
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', stopResize);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', stopResize);
    };
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      onMouseDown={(event) => {
        onResizeStartRef.current?.();
        dragStartYRef.current = event.clientY;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
      }}
      className="group -my-2 flex h-4 cursor-row-resize items-center justify-center"
    >
      <div className="h-1.5 w-16 rounded-full bg-[#c7c4d7]/50 transition-colors group-hover:bg-[#2a14b4]/40" />
    </div>
  );
}
