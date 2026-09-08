// Authoring scale is independent of mesh fitting, hull size and model tier.
export const METRES_PER_CELL = 10;
export const metresToArc = (metres, cellSide) => metres / METRES_PER_CELL * cellSide;
export const arcToMetres = (arc, cellSide) => arc / cellSide * METRES_PER_CELL;
