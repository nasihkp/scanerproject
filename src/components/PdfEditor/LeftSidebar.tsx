import React, { useState } from 'react';
import {
    MousePointer2,
    Type, PenTool, Highlighter, Eraser, Square, Circle,
    MessageSquare, Image as ImageIcon, PenLine, Stamp,
    FormInput, ChevronDown

} from 'lucide-react';
import { PdfEditorState, Action, ToolName } from './PdfEditorState';

interface LeftSidebarProps {
    state: PdfEditorState;
    dispatch: React.Dispatch<Action>;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ state, dispatch }) => {
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        select: true,
        text: true,
        draw: true,
    });

    const toggleSection = (section: string) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const setTool = (tool: ToolName) => {
        dispatch({ type: 'SET_ACTIVE_TOOL', payload: tool });
    };

    const renderToolButton = (icon: any, label: string, tool: ToolName, active: boolean) => {
        const Icon = icon;
        return (
            <button
                key={tool}
                onClick={() => setTool(tool)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-all duration-200 ease-in-out ${active
                    ? 'bg-[#3b82f6]/20 text-[#3b82f6] shadow-[inset_0_0_0_1px_rgba(59,130,246,0.5)]'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                title={label}
            >
                <Icon size={16} className={active ? "scale-110 transition-transform" : "scale-100 transition-transform"} />
                <span>{label}</span>
            </button>
        );
    };

    const renderSection = (id: string, title: string, children: React.ReactNode) => {
        const isOpen = openSections[id];
        return (
            <div key={id} className="border-b border-white/5 py-2">
                <button
                    onClick={() => toggleSection(id)}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-white/50 uppercase tracking-wider hover:text-white transition-colors"
                >
                    {title}
                    <div className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
                        <ChevronDown size={14} />
                    </div>
                </button>
                <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0 mt-0'}`}
                >
                    <div className="px-2 pt-1 pb-2 space-y-1">{children}</div>
                </div>
            </div>
        );
    };

    if (!state.sidebarOpen) return null;

    return (
        <div className="w-64 bg-[#1a1a1a] border-r border-white/10 flex flex-col h-full overflow-y-auto hidden md:flex shrink-0">
            {renderSection("select", "Select & Navigate", (
                <>
                    {renderToolButton(MousePointer2, "Select", "select", state.activeTool === 'select')}
                </>
            ))}

            {renderSection("text", "Text", (
                <>
                    {renderToolButton(Type, "Add Text", "add_text", state.activeTool === 'add_text')}
                </>
            ))}

            {renderSection("draw", "Drawing & Shapes", (
                <>
                    {renderToolButton(PenTool, "Freehand Pen", "pen", state.activeTool === 'pen')}
                    {renderToolButton(Highlighter, "Highlighter", "highlighter", state.activeTool === 'highlighter')}
                    {renderToolButton(Eraser, "Eraser", "eraser", state.activeTool === 'eraser')}
                    {renderToolButton(Square, "Rectangle", "rectangle", state.activeTool === 'rectangle')}
                    {renderToolButton(Circle, "Circle", "circle", state.activeTool === 'circle')}
                </>
            ))}

            {renderSection("annotate", "Annotations", (
                <>
                    {renderToolButton(MessageSquare, "Sticky Note", "sticky_note", state.activeTool === 'sticky_note')}
                </>
            ))}

            {renderSection("media", "Media", (
                <>
                    {renderToolButton(ImageIcon, "Add Image", "image", state.activeTool === 'image')}
                    {renderToolButton(PenLine, "Signature", "signature", state.activeTool === 'signature')}
                    {renderToolButton(Stamp, "Stamp", "stamp", state.activeTool === 'stamp')}
                </>
            ))}

            {renderSection("forms", "Forms", (
                <>
                    {renderToolButton(FormInput, "Text Field", "form_text", state.activeTool === 'form_text')}
                    {renderToolButton(Square, "Checkbox", "form_checkbox", state.activeTool === 'form_checkbox')}
                    {renderToolButton(Circle, "Radio Button", "form_radio", state.activeTool === 'form_radio')}
                </>
            ))}


        </div>
    );
};
