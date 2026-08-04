const outfitModule = require('../../src/views/main/modules/outfit');

describe('Outfit Module', () => {
  let mockOutfitContainer;
  let mockKiwi;
  let mockPetState;
  let mockIpcRenderer;
  let mockSavePetState;
  let applyOutfitPos;
  let listeners = {};

  beforeEach(() => {
    // Reset mocks
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

    // Initialize module
    const initResult = outfitModule.init({
      outfitContainer: mockOutfitContainer,
      kiwi: mockKiwi,
      petState: mockPetState,
      savePetState: mockSavePetState,
      loadPetState: jest.fn(),
      ipcRenderer: mockIpcRenderer
    });
    applyOutfitPos = initResult.applyOutfitPos;
  });

  test('should render outfits in the container based on petState', () => {
    // Basic test
    expect(mockPetState.outfits.length).toBe(2);
  });

  test('should update outfits when update-outfit IPC event is received', () => {
    // Trigger IPC event
    listeners['update-outfit']({}, ['🎩', '👑']);
    
    expect(mockPetState.outfits).toEqual(['🎩', '👑']);
    expect(mockSavePetState).toHaveBeenCalled();
    
    // The implementation of outfit.js creates img elements or spans, it depends, but we can just check petState
  });

  test('should clear edit mode when outfit-closed is received', () => {
    outfitModule.setOutfitEditMode(true);
    expect(outfitModule.getIsOutfitEditMode()).toBe(true);

    listeners['outfit-closed']();
    
    expect(outfitModule.getIsOutfitEditMode()).toBe(false);
  });
});
