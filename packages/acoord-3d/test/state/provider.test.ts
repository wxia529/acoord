import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { 
  setStoreProvider, 
  getStructureStore,
  getDisplayStore,
  getLightingStore,
} from '../../src/state/provider.js';

describe('StoreProvider', () => {
  beforeEach(() => {
    // Reset provider before each test
    setStoreProvider(null as any);
  });
  
  it('should use default store when no provider', () => {
    const store = getStructureStore();
    expect(store).to.exist;
    expect(store.currentStructure).to.be.null;
  });
  
  it('should use custom provider when set', () => {
    const customProvider = {
      structure: { 
        currentStructure: { atoms: [], bonds: [] } as any,
        currentSelectedAtom: null,
        currentSelectedBondKey: null,
      },
      display: { backgroundColor: '#000' } as any,
      lighting: { lightingEnabled: false } as any,
    };
    
    setStoreProvider(customProvider);
    
    expect(getStructureStore()).to.equal(customProvider.structure);
    expect(getDisplayStore()).to.equal(customProvider.display);
    expect(getLightingStore()).to.equal(customProvider.lighting);
  });
});
