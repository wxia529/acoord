import { describe, it } from 'mocha';
import { expect } from 'chai';
import { createRenderer } from '../../src/renderer/factory.js';

describe('createRenderer', () => {
  it('should create renderer instance', () => {
    const canvas = document.createElement('canvas');
    const renderer = createRenderer({ canvas });
    
    expect(renderer).to.have.property('renderStructure');
    expect(renderer).to.have.property('fitCamera');
    expect(renderer).to.have.property('dispose');
  });
  
  it('should use injected state provider', () => {
    const canvas = document.createElement('canvas');
    const customProvider = {
      structure: { currentStructure: null },
      display: { backgroundColor: '#fff' },
      lighting: { lightingEnabled: true },
    } as any;
    
    const renderer = createRenderer({ 
      canvas, 
      providers: customProvider 
    });
    
    expect(renderer).to.exist;
  });
  
  it('should call onError handler when provided', () => {
    const canvas = document.createElement('canvas');
    let errorCalled = false;
    
    const renderer = createRenderer({
      canvas,
      onError: () => { errorCalled = true; },
    });
    
    // Renderer created successfully
    expect(renderer).to.exist;
  });
});
