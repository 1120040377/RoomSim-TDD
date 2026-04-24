import { z } from 'zod';

export const Vec2Schema = z.object({
  x: z.number(),
  y: z.number(),
});

export const WallNodeSchema = z.object({
  id: z.string(),
  position: Vec2Schema,
});

export const WallSchema = z.object({
  id: z.string(),
  startNodeId: z.string(),
  endNodeId: z.string(),
  thickness: z.number().min(3).max(50),
  height: z.number().min(100).max(500),
});

const OpeningBaseFields = {
  id: z.string(),
  wallId: z.string(),
  offset: z.number().min(0),
  width: z.number().min(10),
  height: z.number().min(10),
  sillHeight: z.number().min(0),
};

export const DoorSchema = z.object({
  ...OpeningBaseFields,
  kind: z.literal('door'),
  hinge: z.enum(['start', 'end']),
  swing: z.enum(['inside', 'outside']),
  state: z.number().min(0).max(1).optional(),
});

export const WindowSchema = z.object({
  ...OpeningBaseFields,
  kind: z.literal('window'),
});

export const OpeningSchema = z.discriminatedUnion('kind', [DoorSchema, WindowSchema]);

export const FurnitureSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: Vec2Schema,
  rotation: z.number(),
  size: z.object({
    width: z.number().positive(),
    depth: z.number().positive(),
    height: z.number().positive(),
  }),
  color: z.string().optional(),
  runtimeState: z.record(z.string(), z.union([z.number(), z.boolean()])).optional(),
  wallAligned: z.boolean().optional(),
});

export const RoomSchema = z.object({
  id: z.string(),
  name: z.string(),
  polygon: z.array(Vec2Schema),
  wallIds: z.array(z.string()),
  area: z.number().min(0),
});

export const PlanMetaSchema = z.object({
  unit: z.literal('cm'),
  gridSize: z.number().positive(),
  defaultWallHeight: z.number().positive(),
  defaultWallThickness: z.number().positive(),
});

export const WalkthroughSchema = z.object({
  personHeight: z.number().min(100).max(250),
  startPosition: Vec2Schema.optional(),
  startYaw: z.number().optional(),
});

export const PlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  schemaVersion: z.literal(1),
  meta: PlanMetaSchema,
  nodes: z.record(z.string(), WallNodeSchema),
  walls: z.record(z.string(), WallSchema),
  openings: z.record(z.string(), OpeningSchema),
  furniture: z.record(z.string(), FurnitureSchema),
  rooms: z.record(z.string(), RoomSchema),
  walkthrough: WalkthroughSchema,
});

export type PlanParsed = z.infer<typeof PlanSchema>;
