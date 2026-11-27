/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const outfitModule = require('../../src/views/main/modules/outfit');
const catalog = require('../../src/utils/outfits_catalog');

describe('Outfit Module & Japanese Picture-Book Wardrobe Tests', () => {
  let mockOutfitContainer;
  let mockKiwi;
  let mockPetState;
  let mockIpcRenderer;
  let mockSavePetState;
  let listeners = {};

  beforeEach(() => {
    listeners = {};
    mockOutfitContainer = document.createElement('div');
    mockKiwi = document.createElement('div');
    mockPetState = { outfits: ['🎀', '🎩'], outfitConfigs: {} };
    mockSavePetState = jest.fn();
    mockIpcRenderer = {
      send: jest.fn(),
      on: jest.fn((event, callback) => {
        listeners[event] = callback;
      })
    };

    outfitModule.init({
      outfitContainer: mockOutfitContainer,
      kiwi: mockKiwi,
      petState: mockPetState,
      savePetState: mockSavePetState,
      _loadPetState: jest.fn(),
      ipcRenderer: mockIpcRenderer
    });
  });

  test('all 8 featured Japanese picture-book outfit PNG assets exist on disk', () => {
    const featured = catalog.getFeaturedOutfits();
    expect(featured.length).toBe(8);
    const outfitsDir = path.resolve(__dirname, '../../assets/images/outfits');
    featured.forEach((item) => {
      expect(item.asset).toBeTruthy();
      expect(fs.existsSync(path.join(outfitsDir, item.asset))).toBe(true);
    });
  });

  test('renders featured outfits as proportional PNG images with rotation and legacy outfits as emoji fallback', () => {
    const items = mockOutfitContainer.querySelectorAll('.outfit-layer-item');
    expect(items.length).toBe(2);

    const ribbonEl = items[0];
    const ribbonImg = ribbonEl.querySelector('img');
    expect(ribbonImg).not.toBeNull();
    expect(ribbonImg.src).toContain('ribbon.png');
    expect(ribbonEl.style.left).toMatch(/%$/);
    expect(ribbonEl.style.top).toMatch(/%$/);
    expect(ribbonEl.style.width).toMatch(/%$/);
    expect(ribbonEl.style.transform).toContain('translate(-50%, -50%) rotate(');

    // Legacy emoji outfit falls back cleanly to text without img
    listeners['update-outfit']({}, ['🎓']);
    const legacyEl = mockOutfitContainer.querySelector('.outfit-layer-item');
    expect(legacyEl.querySelector('img')).toBeNull();
    expect(legacyEl.textContent).toBe('🎓');
  });

  test('slot-based selection replaces same-slot items by default and supports free-stack mode', () => {
    // Wearing top hat (head) + sunglasses (face) + ribbon (body)
    let worn = ['🎩', '🕶️', '🎀'];

    // Selecting crown (head) with freeStack=false replaces top hat while keeping face & body
    worn = catalog.applyOutfitSelection(worn, '👑', { freeStack: false });
    expect(worn).toEqual(['🕶️', '🎀', '👑']);

    // Selecting glasses (face) replaces sunglasses
    worn = catalog.applyOutfitSelection(worn, '👓', { freeStack: false });
    expect(worn).toEqual(['🎀', '👑', '👓']);

    // With freeStack=true, wearing sakura (head) stacks alongside crown
    worn = catalog.applyOutfitSelection(worn, '🌸', { freeStack: true });
    expect(worn).toEqual(['🎀', '👑', '👓', '🌸']);

    // Empty string clears all outfits
    expect(catalog.applyOutfitSelection(worn, '', { freeStack: false })).toEqual([]);
  });

  test('update-outfit-pos persists x, y, scale, and rotate with coordVersion 2 and ignores stale v1 pixel configs', () => {
    // Legacy v1 config without coordVersion falls back cleanly to calibrated v2 default
    const v1Fallback = catalog.resolveOutfitConfig('🎩', {
      '🎩': { x: 62, y: -31, scale: 60 }
    });
    expect(v1Fallback.coordVersion).toBe(catalog.COORD_VERSION);
    expect(v1Fallback.x).toBe(catalog.getDefaultOutfitConfig('🎩').x);

    listeners['update-outfit-pos']({}, { outfit: '🎩', x: 52, y: 18, scale: 38, rotate: -14 });
    expect(mockPetState.outfitConfigs['🎩']).toEqual({
      x: 52,
      y: 18,
      scale: 38,
      rotate: -14,
      coordVersion: catalog.COORD_VERSION
    });
    expect(mockSavePetState).toHaveBeenCalled();

    const hatEl = mockOutfitContainer.querySelector('.outfit-layer-item[data-outfit="🎩"]');
    expect(hatEl.style.left).toBe('52%');
    expect(hatEl.style.top).toBe('18%');
    expect(hatEl.style.width).toBe('38%');
    expect(hatEl.style.transform).toContain('rotate(-14deg)');
  });

  test('should clear edit mode when outfit-closed is received', () => {
    outfitModule.setOutfitEditMode(true);
    expect(outfitModule.getIsOutfitEditMode()).toBe(true);

    listeners['outfit-closed']();
    expect(outfitModule.getIsOutfitEditMode()).toBe(false);
  });
});
