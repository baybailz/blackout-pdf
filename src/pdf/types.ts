export interface Rect {
  // Coordinates in CSS pixels at pdf.js viewport scale 1, origin top-left.
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Suggestion {
  id: string;
  pageIndex: number;
  rect: Rect;
  categoryId: string;
  text: string;
  accepted: boolean;
}

export interface ManualBox {
  id: string;
  pageIndex: number;
  rect: Rect;
}

export interface PageInfo {
  index: number;
  // Viewport size at scale 1.
  width: number;
  height: number;
}
