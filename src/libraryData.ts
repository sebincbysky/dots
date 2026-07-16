export type LibraryImage = {
  id: string;
  name: string;
  category: 'Portraits' | 'Textures' | 'Objects' | 'Sci-Fi' | 'Landscapes';
  resolutionLabel: '4K' | '2K' | '1K';
  targetSize: number;
  sizeLabel: string;
  src: string;
  description: string;
  hasWatermarks: boolean;
  scrapedSource: string;
};

export const libraryImages: LibraryImage[] = [
  {
    id: 'lib-1',
    name: 'Cybernetic Portrait Model',
    category: 'Portraits',
    resolutionLabel: '4K',
    targetSize: 4096,
    sizeLabel: '14.8 MB',
    src: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=2560',
    description: 'Ultra-high-fidelity studio portrait designed for training deep-learning face embeddings (LoRA / Textual Inversion).',
    hasWatermarks: true,
    scrapedSource: 'scraped: unsplash.com/plus'
  },
  {
    id: 'lib-2',
    name: 'Neo-Tokyo Synthwave Alley',
    category: 'Sci-Fi',
    resolutionLabel: '4K',
    targetSize: 4096,
    sizeLabel: '18.1 MB',
    src: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=2560',
    description: 'Vibrant cyberpunk neon street backdrop. Ideal for background generation and style diffusion adapters.',
    hasWatermarks: false,
    scrapedSource: 'scraped: artstation.com'
  },
  {
    id: 'lib-3',
    name: 'Brutalist Concrete Texture',
    category: 'Textures',
    resolutionLabel: '4K',
    targetSize: 4096,
    sizeLabel: '12.4 MB',
    src: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=2560',
    description: 'Macro concrete fracture lines and light gradients, suitable for 3D displacement maps and visual texture training.',
    hasWatermarks: true,
    scrapedSource: 'scraped: texturelabs.io'
  },
  {
    id: 'lib-4',
    name: 'Premium Studio Chronometer',
    category: 'Objects',
    resolutionLabel: '2K',
    targetSize: 2048,
    sizeLabel: '6.2 MB',
    src: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1920',
    description: 'High-contrast watch object centered against a clean studio backdrop, perfect for product-focused controlnet testing.',
    hasWatermarks: true,
    scrapedSource: 'scraped: unsplash.com/plus'
  },
  {
    id: 'lib-5',
    name: 'Icelandic Volcanic Canyon',
    category: 'Landscapes',
    resolutionLabel: '2K',
    targetSize: 2048,
    sizeLabel: '8.5 MB',
    src: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1920',
    description: 'Cinematic landscape of Icelandic black volcanic rocks and deep emerald moss under diffuse northern light.',
    hasWatermarks: false,
    scrapedSource: 'scraped: earthscrapes.net'
  },
  {
    id: 'lib-6',
    name: 'Athletic Running Footwear',
    category: 'Objects',
    resolutionLabel: '1K',
    targetSize: 1024,
    sizeLabel: '2.1 MB',
    src: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1024',
    description: 'Centered studio photo of a red sports shoe. Highly optimized for object-segmentation and inpainting fine-tuning.',
    hasWatermarks: true,
    scrapedSource: 'scraped: product-dataset.org'
  },
  {
    id: 'lib-7',
    name: 'Abstract Oil Paint impasto',
    category: 'Textures',
    resolutionLabel: '2K',
    targetSize: 2048,
    sizeLabel: '5.9 MB',
    src: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=1920',
    description: 'Thick, physical brush stroke details of oil paint. Captures high frequency reflections and multi-color blends.',
    hasWatermarks: false,
    scrapedSource: 'scraped: wikiart.org'
  },
  {
    id: 'lib-8',
    name: 'Minimalist Sound Headphones',
    category: 'Objects',
    resolutionLabel: '2K',
    targetSize: 2048,
    sizeLabel: '7.3 MB',
    src: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1920',
    description: 'Black modern studio headphones against a warm wooden backdrop. Great for object segmentation training.',
    hasWatermarks: true,
    scrapedSource: 'scraped: unsplash.com/plus'
  },
  {
    id: 'lib-9',
    name: 'Cybernetic Neon Hologram',
    category: 'Sci-Fi',
    resolutionLabel: '1K',
    targetSize: 1024,
    sizeLabel: '1.8 MB',
    src: 'https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=1024',
    description: 'Abstract neon magenta waves and holographic particles. Great for training digital art models and neural shaders.',
    hasWatermarks: false,
    scrapedSource: 'scraped: digitalrender.ai'
  }
];
