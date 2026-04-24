import { SelectTool } from './select';
import { WallTool } from './wall';
import { RectRoomTool } from './rect-room';
import { DoorTool, WindowTool } from './opening';
import { FurnitureTool } from './furniture';
import type { Tool, ToolName } from './base';

export const TOOLS: Record<ToolName, Tool> = {
  select: new SelectTool(),
  wall: new WallTool(),
  'rect-room': new RectRoomTool(),
  door: new DoorTool(),
  window: new WindowTool(),
  measure: new SelectTool() as unknown as Tool,
  furniture: new FurnitureTool(),
};

export type { Tool, ToolName, ToolContext } from './base';
