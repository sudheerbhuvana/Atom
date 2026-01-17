import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import styles from '../Dashboard.module.css';

interface SortableWidgetProps {
    id: string;
    children: React.ReactNode;
    isEditMode: boolean;
    onMove?: (id: string) => void;
    currentColumn?: 'left' | 'right';
    enabled?: boolean;
    onToggle?: (id: string) => void;
}

export default function SortableWidget({ id, children, isEditMode, onMove, currentColumn, enabled = true, onToggle }: SortableWidgetProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : (enabled ? 1 : 0.5),
        position: 'relative' as const,
        zIndex: isDragging ? 999 : 1,
        marginBottom: '2rem' // Maintain spacing
    };

    return (
        <div ref={setNodeRef} style={style} className={isEditMode ? styles.sortableItem : ''}>
            {isEditMode && (
                <div className={styles.widgetControls}>
                    <div {...attributes} {...listeners} className={styles.dragHandle}>
                        <GripVertical size={20} />
                    </div>
                    {onToggle && (
                        <button
                            className={styles.removeBtn} // Reusing button style
                            onClick={() => onToggle(id)}
                            title={enabled ? "Disable Widget" : "Enable Widget"}
                            style={{ marginRight: '4px' }}
                        >
                            {enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                    )}
                    {onMove && currentColumn && (
                        <button
                            className={styles.removeBtn}
                            onClick={() => onMove(id)}
                            title={currentColumn === 'left' ? "Move to Right" : "Move to Left"}
                            style={{ marginLeft: '4px' }}
                        >
                            {currentColumn === 'left' ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
                        </button>
                    )}
                </div>
            )}
            {children}
            {isEditMode && <div className={styles.sortableOverlay} />}
        </div>
    );
}
