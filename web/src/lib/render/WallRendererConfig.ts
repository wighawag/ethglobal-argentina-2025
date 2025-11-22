/**
 * Configuration for WallRenderer implementation switching
 */

export enum WallRendererType {
	SPRITE = 'sprite', // Sprite-based with depth effects and pooling
	GRAPHICS = 'graphics', // Original Graphics-based implementation
	DUAL_GRID = 'dual_grid' // Dual grid system with corner-based rendering
}
// Configuration flag to switch between implementations
// Change this value to switch rendering methods
export const WALL_RENDERER_TYPE: WallRendererType = WallRendererType.GRAPHICS;
// Configuration options for sprite-based renderer
export interface SpriteRendererConfig {
	enableDepthEffects: boolean;
	enableSpritePooling: boolean;
	cameraCullingMargin: number;
}

// Configuration options for dual grid renderer
export interface DualGridRendererConfig {
	enableSpritePooling: boolean;
	cameraCullingMargin: number;
	cornerOptimization: boolean;
}
// Configuration options for graphics-based renderer
export interface GraphicsRendererConfig {
	cameraCullingMargin: number;
}

// Dual grid renderer configuration
export const DUAL_GRID_CONFIG: DualGridRendererConfig = {
	enableSpritePooling: true,
	cameraCullingMargin: 20,
	cornerOptimization: true
};
// Sprite renderer configuration
export const SPRITE_CONFIG: SpriteRendererConfig = {
	enableDepthEffects: true,
	enableSpritePooling: true,
	cameraCullingMargin: 20
};
// Graphics renderer configuration
export const GRAPHICS_CONFIG: GraphicsRendererConfig = {
	cameraCullingMargin: 20
};

// Helper function to get current configuration
export function getCurrentConfig() {
	switch (WALL_RENDERER_TYPE) {
		case WallRendererType.SPRITE:
			return SPRITE_CONFIG;
		case WallRendererType.GRAPHICS:
			return GRAPHICS_CONFIG;
		case WallRendererType.DUAL_GRID:
			return DUAL_GRID_CONFIG;
		default:
			return DUAL_GRID_CONFIG;
	}
}

// Helper function to check if sprite renderer is enabled
export function isSpriteRendererEnabled(): boolean {
	return WALL_RENDERER_TYPE === WallRendererType.SPRITE;
}

// Helper function to check if graphics renderer is enabled
export function isGraphicsRendererEnabled(): boolean {
	return WALL_RENDERER_TYPE === WallRendererType.GRAPHICS;
}

// Helper function to check if dual grid renderer is enabled
export function isDualGridRendererEnabled(): boolean {
	return WALL_RENDERER_TYPE === WallRendererType.DUAL_GRID;
}
