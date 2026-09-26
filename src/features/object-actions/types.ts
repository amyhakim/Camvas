export type ObjectAction = { id: string; label: string; disabled?: boolean; danger?: boolean; onSelect: () => void };
export type ObjectTool = 'select' | 'move' | 'rotate';
export type ObjectContextMenuProps = { title: string; x: number; y: number; actions: ObjectAction[]; onClose: () => void };
export type ObjectToolStripProps = { name: string; tool: ObjectTool; onToolChange: (tool: ObjectTool) => void; allowRotate: boolean; disabled?: boolean; onActions: () => void; onUndo?: () => void; canUndo?: boolean; hint: string };
