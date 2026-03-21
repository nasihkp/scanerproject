export type ToolName =
  | 'select' | 'zoom'
  | 'add_text' | 'pen' | 'highlighter' | 'eraser'
  | 'line' | 'arrow' | 'rectangle' | 'circle' | 'polygon'
  | 'sticky_note' | 'comment' | 'image' | 'signature' | 'stamp'
  | 'form_text' | 'form_checkbox' | 'form_radio'
  | 'watermark' | 'link';

export interface ViewportState {
  zoom: number; // e.g. 1.0 for 100%
  panX: number;
  panY: number;
}

export interface PdfDocumentState {
  file: File | null;
  numPages: number;
  fileName: string;
  fileSize: number;
  password?: string;
}

export interface SelectedElementProps {
  type: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  text?: string;
  opacity?: number;
  backgroundColor?: string;
}

export interface PdfEditorState {
  document: PdfDocumentState | null;
  viewport: ViewportState;
  activeTool: ToolName;
  selectedElementId: string | null;
  selectedElementProps: SelectedElementProps | null;
  history: any[]; // To be expanded
  historyIndex: number;
  sidebarOpen: boolean;
  propertiesPanelOpen: boolean;
  thumbnailPanelOpen: boolean;
  theme: 'dark' | 'light';
  viewMode: 'single' | 'continuous' | 'spread';
}

export type Action =
  | { type: 'SET_DOCUMENT'; payload: PdfDocumentState | null }
  | { type: 'SET_ACTIVE_TOOL'; payload: ToolName }
  | { type: 'SET_SELECTED_ELEMENT'; payload: { id: string | null; props?: SelectedElementProps | null } }
  | { type: 'UPDATE_ELEMENT_PROPS'; payload: Partial<SelectedElementProps> }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_PROPERTIES_PANEL' }
  | { type: 'TOGGLE_THUMBNAIL_PANEL' }
  | { type: 'SET_THEME'; payload: 'dark' | 'light' }
  | { type: 'SET_VIEW_MODE'; payload: 'single' | 'continuous' | 'spread' }
  | { type: 'SET_PASSWORD'; payload: string | undefined }
  | { type: 'SAVE_HISTORY'; payload: { pageNum: number, json: any } }
  | { type: 'UNDO' }
  | { type: 'REDO' };

export const initialState: PdfEditorState = {
  document: null,
  viewport: { zoom: 1, panX: 0, panY: 0 },
  activeTool: 'select',
  selectedElementId: null,
  selectedElementProps: null,
  history: [],
  historyIndex: -1, // Empty history starts at -1
  sidebarOpen: true,
  propertiesPanelOpen: true,
  thumbnailPanelOpen: false,
  theme: 'dark',
  viewMode: 'continuous',
};

export function pdfEditorReducer(state: PdfEditorState, action: Action): PdfEditorState {
  switch (action.type) {
    case 'SET_DOCUMENT':
      return { ...state, document: action.payload };
    case 'SET_ACTIVE_TOOL':
      return { ...state, activeTool: action.payload };
    case 'SET_SELECTED_ELEMENT':
      return {
        ...state,
        selectedElementId: action.payload.id,
        selectedElementProps: action.payload.props || null
      };
    case 'UPDATE_ELEMENT_PROPS':
      return {
        ...state,
        selectedElementProps: state.selectedElementProps
          ? { ...state.selectedElementProps, ...action.payload }
          : null
      };
    case 'SET_ZOOM':
      return { ...state, viewport: { ...state.viewport, zoom: action.payload } };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'TOGGLE_PROPERTIES_PANEL':
      return { ...state, propertiesPanelOpen: !state.propertiesPanelOpen };
    case 'TOGGLE_THUMBNAIL_PANEL':
      return { ...state, thumbnailPanelOpen: !state.thumbnailPanelOpen };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };
    case 'SET_PASSWORD':
      if (state.document) {
        return { ...state, document: { ...state.document, password: action.payload } };
      }
      return state;
    case 'SAVE_HISTORY': {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(action.payload);
      return {
        ...state,
        history: newHistory,
        historyIndex: newHistory.length - 1
      };
    }
    case 'UNDO':
      return {
        ...state,
        historyIndex: Math.max(-1, state.historyIndex - 1) // -1 signifies absolute base document (no edits)
      };
    case 'REDO':
      return {
        ...state,
        historyIndex: Math.min(state.history.length - 1, state.historyIndex + 1)
      };
    default:
      return state;
  }
}
