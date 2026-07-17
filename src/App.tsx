/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { 
  UploadCloud, 
  RotateCcw, 
  RotateCw, 
  Download, 
  Image as ImageIcon, 
  X, 
  RefreshCw, 
  Plus, 
  Minus,
  Sparkles,
  Wand2,
  Sliders,
  Brush,
  Trash2,
  FolderOpen,
  Check,
  CircleDot,
  Database,
  Filter,
  Loader,
  Undo2,
  Search,
  Grid,
  SlidersHorizontal,
  Smile,
  Cpu,
  Eye,
  DownloadCloud,
  Crosshair,
  Video,
  CheckSquare,
  Square,
  Maximize2,
  Globe,
  Link,
  FileText,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ImageState = {
  id: string;
  file?: File;
  src: string;
  name: string;
  rotation: number;
  scale: number;
  targetSize: number;
  isBroken?: boolean;
  filter?: string;      // 'None' | 'Grayscale' | 'Sepia' | 'Warm' | 'Cool' | 'Vintage' | 'Invert' | 'Sunset'
  effect?: string;      // 'None' | 'Pixelate' | 'EmojiMosaic' | 'EdgeDetection'
  pixelSize?: number;   // 8, 16, 32, 64 (block size for pixelation)
  emojiDensity?: number; // 8, 12, 16, 20 (smaller is denser / more detailed)
  watermarkRemoved?: boolean;
  isVideo?: boolean;
};

export default function App() {
  const [images, rawSetImages] = useState<ImageState[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [history, setHistory] = useState<{ images: ImageState[]; activeId: string | null }[]>([]);
  const [applyToAll, setApplyToAll] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'workspace' | 'scraper'>('workspace');
  
  // Web URL Scraper states
  const [scrapeUrlInput, setScrapeUrlInput] = useState('https://unsplash.com/t/textures-patterns');
  const [urlScrapedData, setUrlScrapedData] = useState<{
    url: string;
    title: string;
    description: string;
    headings: string[];
    links: { text: string; href: string }[];
    images: { id: string; src: string; alt: string; targetSize: number; resolutionLabel: string; sizeLabel: string }[];
  } | null>(null);
  const [isUrlScraping, setIsUrlScraping] = useState(false);
  const [urlScraperError, setUrlScraperError] = useState<string | null>(null);
  const [selectedUrlScrapedIds, setSelectedUrlScrapedIds] = useState<string[]>([]);
  const [scraperMode, setScraperMode] = useState<'google' | 'url'>('google');
  
  // Background upload processing states
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Scraper and Google Images search states
  const [scrapeQuery, setScrapeQuery] = useState('organic textures');
  const [scrapeCatalog, setScrapeCatalog] = useState('Google Images');
  const [scrapeMediaType, setScrapeMediaType] = useState<'Photos' | 'Videos'>('Photos');
  const [scrapedResults, setScrapedResults] = useState<any[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [scraperSearchQuery, setScraperSearchQuery] = useState<string>('');
  const [selectedScrapedIds, setSelectedScrapedIds] = useState<string[]>([]);

  // Fullscreen interactive preview item
  const [fullscreenPreviewItem, setFullscreenPreviewItem] = useState<any | null>(null);

  // Pixel Lead Coordinates tracking state
  const [pixelLead, setPixelLead] = useState<{ x: number; y: number; r: number; g: number; b: number; hex: string; visualX: number; visualY: number } | null>(null);
  const [enablePixelLead, setEnablePixelLead] = useState(true);

  // Run scraper search proxy to fetch real Unsplash NAPI images matching query
  const handleScrape = async (customQuery?: string, customMediaType?: 'Photos' | 'Videos') => {
    const q = (customQuery || scrapeQuery).trim();
    if (!q) return;
    const media = customMediaType || scrapeMediaType;
    setIsScraping(true);
    try {
      const res = await fetch(`/api/scrape-images?query=${encodeURIComponent(q)}&catalog=${encodeURIComponent(scrapeCatalog)}&mediaType=${media}`);
      const data = await res.json();
      if (data.success && data.results) {
        setScrapedResults(data.results);
      }
    } catch (e) {
      console.error("Scraping error:", e);
    } finally {
      setIsScraping(false);
    }
  };

  // Pre-load default scraper results on first mount or tab switch
  useEffect(() => {
    if (scrapedResults.length === 0) {
      handleScrape('organic textures');
    }
  }, []);

  // URL Scraper selection and batch helpers
  const toggleUrlScrapedSelection = (id: string) => {
    setSelectedUrlScrapedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleUrlScrape = async () => {
    if (!scrapeUrlInput.trim()) return;
    setIsUrlScraping(true);
    setUrlScraperError(null);
    try {
      const response = await fetch(`/api/scrape-url?url=${encodeURIComponent(scrapeUrlInput.trim())}`);
      const data = await response.json();
      if (data.success) {
        setUrlScrapedData(data);
        setSelectedUrlScrapedIds([]); // Reset selection on new crawl
      } else {
        setUrlScraperError(data.error || "Failed to parse target URL. Please verify address and retry.");
      }
    } catch (err: any) {
      console.error("URL Scraper client error:", err);
      setUrlScraperError("Web proxy error. Make sure the URL is correct and online.");
    } finally {
      setIsUrlScraping(false);
    }
  };

  const importSelectedUrlScrapedBatch = () => {
    if (!urlScrapedData || selectedUrlScrapedIds.length === 0) return;
    setIsProcessingUpload(true);
    setUploadProgress({ current: 0, total: selectedUrlScrapedIds.length });

    try {
      const itemsToImport = urlScrapedData.images.filter(img => selectedUrlScrapedIds.includes(img.id));
      const processedList: ImageState[] = itemsToImport.map((item, i) => {
        return {
          id: Math.random().toString(36).substring(2, 9),
          src: item.src,
          name: (item.alt || `scraped_${i}`).toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20) + '.png',
          rotation: 0,
          scale: 1,
          targetSize: item.targetSize || 1024,
          filter: 'None',
          effect: 'None',
          pixelSize: 16,
          emojiDensity: 12,
        };
      });

      setImages(prev => {
        const next = [...prev, ...processedList];
        if (processedList.length > 0 && !activeId) {
          setActiveId(processedList[0].id);
        }
        return next;
      });

      setSelectedUrlScrapedIds([]);
      setActiveTab('workspace');
    } catch (e) {
      console.error("Batch URL Ingestion error:", e);
    } finally {
      setIsProcessingUpload(false);
    }
  };

  // Scraper selection helpers
  const toggleScrapedSelection = (id: string) => {
    setSelectedScrapedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const clearScrapedSelection = () => {
    setSelectedScrapedIds([]);
  };

  const importSelectedScrapedBatch = async () => {
    const toImport = scrapedResults.filter(item => selectedScrapedIds.includes(item.id));
    if (toImport.length === 0) return;
    
    setIsProcessingUpload(true);
    setUploadProgress({ current: 0, total: toImport.length });
    
    const processedList: ImageState[] = [];
    for (let i = 0; i < toImport.length; i++) {
      setUploadProgress({ current: i + 1, total: toImport.length });
      const item = toImport[i];
      const isVideo = !!item.isVideo;
      const suffix = isVideo ? '.mp4' : '.png';
      
      processedList.push({
        id: Math.random().toString(36).substring(2, 9),
        src: item.src,
        name: (item.alt || `scraped_${i}`).toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20) + suffix,
        rotation: 0,
        scale: 1,
        targetSize: item.targetSize || 1024,
        filter: 'None',
        effect: 'None',
        pixelSize: 16,
        emojiDensity: 12,
        isVideo,
      });
    }

    setImages(prev => {
      const next = [...prev, ...processedList];
      if (processedList.length > 0 && !activeId) {
        setActiveId(processedList[0].id);
      }
      return next;
    });
    
    setSelectedScrapedIds([]);
    setIsProcessingUpload(false);
    setActiveTab('workspace');
  };

  // Track cursor position and extract pixel coordinates / colors on hovered canvas
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!enablePixelLead) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const visualX = e.clientX - rect.left;
    const visualY = e.clientY - rect.top;

    // Scale back coordinates based on ratio between visual size and actual internal canvas resolution
    const x = Math.min(canvas.width - 1, Math.max(0, Math.floor((visualX / rect.width) * canvas.width)));
    const y = Math.min(canvas.height - 1, Math.max(0, Math.floor((visualY / rect.height) * canvas.height)));

    const ctx = canvas.getContext('2d');
    if (ctx) {
      try {
        const pData = ctx.getImageData(x, y, 1, 1).data;
        const r = pData[0];
        const g = pData[1];
        const b = pData[2];
        const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
        setPixelLead({ 
          x, 
          y, 
          r, 
          g, 
          b, 
          hex,
          visualX,
          visualY
        });
      } catch (err) {
        console.warn("Cross-origin or out of bounds image read:", err);
      }
    }
  };

  const handleCanvasMouseLeave = () => {
    setPixelLead(null);
  };

  // Custom setImages that automatically records history for undo support
  const setImages = useCallback((newVal: ImageState[] | ((prev: ImageState[]) => ImageState[])) => {
    rawSetImages(prev => {
      const next = typeof newVal === 'function' ? newVal(prev) : newVal;
      // Capture state for undo
      setHistory(h => [...h.slice(-49), { images: prev, activeId }]);
      return next;
    });
  }, [activeId]);

  // Handle Undo operation
  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    rawSetImages(previous.images);
    setActiveId(previous.activeId);
    setHistory(prev => prev.slice(0, -1));
  };

  // Deduplication system state & handler
  const [deduplicateStatus, setDeduplicateStatus] = useState<string | null>(null);

  const handleDeduplicate = async () => {
    if (images.length === 0) {
      setDeduplicateStatus("No photos in workspace.");
      setTimeout(() => setDeduplicateStatus(null), 3000);
      return;
    }

    setDeduplicateStatus("Scanning image signatures...");

    // Helper to compute a visual fingerprint (average hash - aHash) for each image
    const getFingerprint = (imgState: ImageState): Promise<string> => {
      return new Promise((resolve) => {
        if (imgState.isBroken) {
          resolve('broken');
          return;
        }
        if (imgState.isVideo) {
          resolve(`video_${imgState.src}_${imgState.name}`);
          return;
        }

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 16;
            canvas.height = 16;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(`fallback_${imgState.src}_${imgState.name}`);
              return;
            }
            ctx.drawImage(img, 0, 0, 16, 16);
            const imgData = ctx.getImageData(0, 0, 16, 16);
            const data = imgData.data;
            
            // Calculate average grayscale and a simple bit hash
            let total = 0;
            const gray: number[] = [];
            for (let i = 0; i < data.length; i += 4) {
              const g = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
              gray.push(g);
              total += g;
            }
            const avg = total / gray.length;
            let hash = '';
            for (let i = 0; i < gray.length; i++) {
              hash += gray[i] >= avg ? '1' : '0';
            }
            resolve(hash);
          } catch (err) {
            resolve(`fallback_${imgState.src}_${imgState.name}`);
          }
        };
        img.onerror = () => {
          resolve(`fallback_${imgState.src}_${imgState.name}`);
        };
        img.src = imgState.src;
      });
    };

    // Gather signatures for all images in parallel
    const fingerprints = await Promise.all(
      images.map(async (img) => {
        const hash = await getFingerprint(img);
        return { id: img.id, hash };
      })
    );

    const seenHashes = new Set<string>();
    const seenSrcs = new Set<string>();
    const seenNames = new Set<string>();
    const uniqueImages: ImageState[] = [];
    let removedCount = 0;

    for (const img of images) {
      const info = fingerprints.find(f => f.id === img.id);
      const hashKey = info?.hash || '';
      
      // Stripping query parameters ensures CDN variations match correctly
      const urlBase = img.src.startsWith('http') ? img.src.split('?')[0] : img.src;
      // Normalizing names helps match disk uploads
      const nameKey = img.name.toLowerCase().trim();

      let isDuplicate = false;

      // Duplicate conditions:
      // 1. If we have a successful visual hash match
      if (hashKey && hashKey !== 'broken' && !hashKey.startsWith('fallback_') && seenHashes.has(hashKey)) {
        isDuplicate = true;
      }
      // 2. If the URL base has already been ingested
      else if (seenSrcs.has(urlBase)) {
        isDuplicate = true;
      }
      // 3. If a file with the exact name already exists
      else if (seenNames.has(nameKey)) {
        isDuplicate = true;
      }

      if (isDuplicate) {
        removedCount++;
      } else {
        if (hashKey && hashKey !== 'broken' && !hashKey.startsWith('fallback_')) {
          seenHashes.add(hashKey);
        }
        seenSrcs.add(urlBase);
        seenNames.add(nameKey);
        uniqueImages.push(img);
      }
    }

    if (removedCount > 0) {
      setImages(uniqueImages);
      if (activeId && !uniqueImages.some(img => img.id === activeId)) {
        setActiveId(uniqueImages.length > 0 ? uniqueImages[0].id : null);
      }
      setDeduplicateStatus(`Success! Cleaned ${removedCount} duplicates.`);
    } else {
      setDeduplicateStatus("Workspace clean. No duplicates found!");
    }

    setTimeout(() => setDeduplicateStatus(null), 4000);
  };
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const activeImage = images.find(img => img.id === activeId);

  // Helper to mark an image as corrupted or broken
  const markAsBroken = (id: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, isBroken: true } : img));
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const processFile = (file: File): Promise<ImageState> => {
    return new Promise((resolve) => {
      const rawSrc = URL.createObjectURL(file);
      const name = file.name.split('.')[0] || 'scraped_image';
      const isVideo = file.type.startsWith('video/');

      resolve({
        id: crypto.randomUUID(),
        file,
        src: rawSrc,
        name,
        rotation: 0,
        scale: 1,
        targetSize: 1024,
        isVideo,
      });
    });
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (fileList.length === 0) return;
    
    setIsProcessingUpload(true);
    setUploadProgress({ current: 0, total: fileList.length });
    
    const processedImages: ImageState[] = [];
    
    for (let i = 0; i < fileList.length; i++) {
      setUploadProgress({ current: i + 1, total: fileList.length });
      const imgState = await processFile(fileList[i]);
      processedImages.push(imgState);
    }
    
    setImages(prev => {
      const next = [...prev, ...processedImages];
      if (processedImages.length > 0 && !activeId) {
        const valid = processedImages.find(img => !img.isBroken);
        setActiveId(valid ? valid.id : processedImages[0].id);
      }
      return next;
    });
    
    setIsProcessingUpload(false);
  };

  const updateActiveImage = (updates: Partial<ImageState>) => {
    setImages(prev => prev.map(img => img.id === activeId ? { ...img, ...updates } : img));
  };

  // Removed legacy Library functions

  useEffect(() => {
    if (activeImage) {
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        drawCanvas();
      };
      img.src = activeImage.src;
    } else {
      imgRef.current = null;
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [activeId, activeImage?.src]);

const emojiPalette = [
  { emoji: '❤️', r: 230, g: 30, b: 40 },
  { emoji: '🍎', r: 200, g: 20, b: 20 },
  { emoji: '🎒', r: 180, g: 15, b: 15 },
  { emoji: '🧡', r: 245, g: 135, b: 35 },
  { emoji: '🍊', r: 240, g: 110, b: 10 },
  { emoji: '💛', r: 250, g: 215, b: 45 },
  { emoji: '🍌', r: 240, g: 230, b: 60 },
  { emoji: '💚', r: 50, g: 185, b: 85 },
  { emoji: '🌳', r: 20, g: 90, b: 35 },
  { emoji: '🥦', r: 40, g: 125, b: 45 },
  { emoji: '💙', r: 35, g: 125, b: 240 },
  { emoji: '🌊', r: 30, g: 145, b: 210 },
  { emoji: '🐳', r: 50, g: 110, b: 180 },
  { emoji: '💜', r: 155, g: 65, b: 205 },
  { emoji: '🍇', r: 115, g: 55, b: 145 },
  { emoji: '🌸', r: 245, g: 155, b: 185 },
  { emoji: '🖤', r: 15, g: 15, b: 15 },
  { emoji: '🕶️', r: 35, g: 35, b: 35 },
  { emoji: '🤍', r: 245, g: 245, b: 245 },
  { emoji: '☁️', r: 215, g: 235, b: 245 },
  { emoji: '🤎', r: 125, g: 85, b: 55 },
  { emoji: '🪵', r: 145, g: 95, b: 65 },
  { emoji: '🥔', r: 165, g: 135, b: 105 },
];

  const drawCanvas = useCallback(() => {
    if (!activeImage) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const previewSize = activeImage.targetSize;
    
    // Calculate aspect ratio to avoid black bars (dead space)
    const imgAspect = img.width / img.height;
    let canvasWidth = previewSize;
    let canvasHeight = previewSize;

    if (imgAspect > 1) {
      // Landscape
      canvasWidth = previewSize;
      canvasHeight = Math.round(previewSize / imgAspect);
    } else {
      // Portrait
      canvasHeight = previewSize;
      canvasWidth = Math.round(previewSize * imgAspect);
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Configure high quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Set canvas filter
    let filterStr = 'none';
    if (activeImage.filter) {
      switch (activeImage.filter) {
        case 'Grayscale':
          filterStr = 'grayscale(100%)';
          break;
        case 'Sepia':
          filterStr = 'sepia(100%)';
          break;
        case 'Warm':
          filterStr = 'sepia(30%) saturate(140%) hue-rotate(-10deg)';
          break;
        case 'Cool':
          filterStr = 'contrast(110%) saturate(110%) hue-rotate(15deg)';
          break;
        case 'Vintage':
          filterStr = 'contrast(90%) sepia(50%) hue-rotate(-15deg) saturate(80%)';
          break;
        case 'Invert':
          filterStr = 'invert(100%)';
          break;
        case 'Sunset':
          filterStr = 'sepia(40%) saturate(180%) hue-rotate(-20deg) contrast(105%)';
          break;
        default:
          filterStr = 'none';
      }
    }
    ctx.filter = filterStr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background color
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((activeImage.rotation * Math.PI) / 180);
    
    // Sized exactly to fill without black side bars (dead space)
    const baseScale = Math.min(canvas.width / img.width, canvas.height / img.height);
    const finalScale = baseScale * activeImage.scale;
    
    ctx.scale(finalScale, finalScale);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    ctx.restore();

    // 2. Post-processing effects (Pixelate, EmojiMosaic, EdgeDetection)
    if (activeImage.effect && activeImage.effect !== 'None') {
      // Temporarily reset filter to 'none' for reading pixels clearly
      ctx.filter = 'none';
      
      if (activeImage.effect === 'Pixelate') {
        const pSize = activeImage.pixelSize || 16;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = Math.max(1, Math.ceil(canvas.width / pSize));
        tempCanvas.height = Math.max(1, Math.ceil(canvas.height / pSize));
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.imageSmoothingEnabled = false;
          tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, canvas.width, canvas.height);
        }
      } else if (activeImage.effect === 'EdgeDetection') {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        const w = canvas.width;
        const h = canvas.height;
        const output = ctx.createImageData(w, h);
        const out = output.data;
        for (let y = 0; y < h - 1; y++) {
          for (let x = 0; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            const idxRight = (y * w + (x + 1)) * 4;
            const idxDown = ((y + 1) * w + x) * 4;
            
            const lum = 0.299 * d[idx] + 0.587 * d[idx+1] + 0.114 * d[idx+2];
            const lumRight = 0.299 * d[idxRight] + 0.587 * d[idxRight+1] + 0.114 * d[idxRight+2];
            const lumDown = 0.299 * d[idxDown] + 0.587 * d[idxDown+1] + 0.114 * d[idxDown+2];
            
            const gx = lumRight - lum;
            const gy = lumDown - lum;
            const edge = Math.min(255, Math.sqrt(gx*gx + gy*gy) * 6);
            
            out[idx] = edge;
            out[idx+1] = edge;
            out[idx+2] = edge;
            out[idx+3] = 255;
          }
        }
        ctx.putImageData(output, 0, 0);
      } else if (activeImage.effect === 'EmojiMosaic') {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, w, h);

        const cellSize = activeImage.emojiDensity || 12;
        ctx.font = `${cellSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let y = cellSize / 2; y < h; y += cellSize) {
          for (let x = cellSize / 2; x < w; x += cellSize) {
            const px = Math.floor(x);
            const py = Math.floor(y);
            if (px >= 0 && px < w && py >= 0 && py < h) {
              const idx = (py * w + px) * 4;
              const r = data[idx];
              const g = data[idx+1];
              const b = data[idx+2];
              const a = data[idx+3];
              
              if (a > 30) {
                let bestEmoji = '⚫';
                let minDist = Infinity;
                for (const pal of emojiPalette) {
                  const dist = Math.pow(r - pal.r, 2) + Math.pow(g - pal.g, 2) + Math.pow(b - pal.b, 2);
                  if (dist < minDist) {
                    minDist = dist;
                    bestEmoji = pal.emoji;
                  }
                }
                ctx.fillText(bestEmoji, x, y);
              }
            }
          }
        }
      }
    }
    
  }, [activeImage?.rotation, activeImage?.scale, activeImage?.targetSize, activeImage?.filter, activeImage?.effect, activeImage?.pixelSize, activeImage?.emojiDensity]);

  useEffect(() => {
    drawCanvas();
  }, [activeImage?.rotation, activeImage?.scale, activeImage?.targetSize, activeImage?.filter, activeImage?.effect, activeImage?.pixelSize, activeImage?.emojiDensity, drawCanvas]);

  const getManifestData = () => {
    return images.map(img => {
      const isVideo = !!img.isVideo;
      const cleanName = img.name.replace(/\.[^/.]+$/, "");
      const finalName = isVideo 
        ? img.name 
        : `${cleanName}_${img.targetSize}px.png`;

      return {
        id: img.id,
        filename: finalName,
        original_name: img.name,
        type: isVideo ? 'video' : 'image',
        target_size: img.targetSize,
        rotation: img.rotation,
        scale: parseFloat(img.scale.toFixed(2)),
        filter: img.filter || 'None',
        effect: img.effect || 'None',
        pixel_size: img.effect === 'Pixelate' ? (img.pixelSize || 16) : null,
        emoji_density: img.effect === 'EmojiMosaic' ? (img.emojiDensity || 12) : null,
        ai_cleaned: !!img.watermarkRemoved
      };
    });
  };

  const downloadManifestJSON = () => {
    const data = getManifestData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, 'dataset_manifest.json');
  };

  const downloadManifestCSV = () => {
    const data = getManifestData();
    if (data.length === 0) return;
    
    const headers = ['id', 'filename', 'original_name', 'type', 'target_size', 'rotation', 'scale', 'filter', 'effect', 'pixel_size', 'emoji_density', 'ai_cleaned'];
    const csvRows = [
      headers.join(','),
      ...data.map(row => {
        return headers.map(header => {
          const val = (row as any)[header];
          if (val === null || val === undefined) return '';
          const str = String(val);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',');
      })
    ];
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    saveAs(blob, 'dataset_manifest.csv');
  };

  const exportZip = async () => {
    if (images.length === 0) return;
    setIsExporting(true);
    try {
      const zip = new JSZip();

      // 1. Export actual processed media assets
      for (const imgState of images) {
        if (imgState.isVideo) {
          try {
            const response = await fetch(imgState.src);
            const blob = await response.blob();
            zip.file(imgState.name, blob);
          } catch (err) {
            console.error("Error adding video to zip:", err);
            zip.file(`${imgState.name}_download_link.txt`, `Source video URL: ${imgState.src}`);
          }
          continue;
        }

        const imgElement = new Image();
        imgElement.crossOrigin = "anonymous";
        
        let loadSuccess = false;
        await new Promise((resolve) => {
          imgElement.onload = () => {
            loadSuccess = true;
            resolve(null);
          };
          imgElement.onerror = () => {
            resolve(null);
          };
          imgElement.src = imgState.src;
        });

        // CORS Fallback: Try loading without crossOrigin if anonymous fails
        if (!loadSuccess) {
          imgElement.removeAttribute('crossOrigin');
          await new Promise((resolve) => {
            imgElement.onload = () => {
              loadSuccess = true;
              resolve(null);
            };
            imgElement.onerror = () => {
              resolve(null);
            };
            imgElement.src = imgState.src;
          });
        }

        if (!loadSuccess) {
          console.warn(`Failed to load image: ${imgState.name}`);
          // Direct fetch fallback
          try {
            const response = await fetch(imgState.src);
            const blob = await response.blob();
            zip.file(imgState.name, blob);
          } catch (fetchErr) {
            console.error(`Double fallback fetch failed for: ${imgState.name}`, fetchErr);
            zip.file(`${imgState.name}_download_link.txt`, `Source image URL: ${imgState.src}`);
          }
          continue;
        }

        let targetWidth = imgState.targetSize;
        let targetHeight = imgState.targetSize;

        try {
          const offscreenCanvas = document.createElement('canvas');
          const imgAspect = imgElement.width / imgElement.height;

          if (imgAspect > 1) {
            targetWidth = imgState.targetSize;
            targetHeight = Math.round(imgState.targetSize / imgAspect);
          } else {
            targetHeight = imgState.targetSize;
            targetWidth = Math.round(imgState.targetSize * imgAspect);
          }

          offscreenCanvas.width = targetWidth;
          offscreenCanvas.height = targetHeight;
          const ctx = offscreenCanvas.getContext('2d');
          if (!ctx) continue;
          
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          let filterStr = 'none';
          if (imgState.filter) {
            switch (imgState.filter) {
              case 'Grayscale':
                filterStr = 'grayscale(100%)';
                break;
              case 'Sepia':
                filterStr = 'sepia(100%)';
                break;
              case 'Warm':
                filterStr = 'sepia(30%) saturate(140%) hue-rotate(-10deg)';
                break;
              case 'Cool':
                filterStr = 'contrast(110%) saturate(110%) hue-rotate(15deg)';
                break;
              case 'Vintage':
                filterStr = 'contrast(90%) sepia(50%) hue-rotate(-15deg) saturate(80%)';
                break;
              case 'Invert':
                filterStr = 'invert(100%)';
                break;
              case 'Sunset':
                filterStr = 'sepia(40%) saturate(180%) hue-rotate(-20deg) contrast(105%)';
                break;
              default:
                filterStr = 'none';
            }
          }
          ctx.filter = filterStr;

          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

          ctx.save();
          ctx.translate(offscreenCanvas.width / 2, offscreenCanvas.height / 2);
          ctx.rotate((imgState.rotation * Math.PI) / 180);
          
          const baseScale = Math.min(offscreenCanvas.width / imgElement.width, offscreenCanvas.height / imgElement.height);
          const finalScale = baseScale * imgState.scale;
          
          ctx.scale(finalScale, finalScale);
          ctx.drawImage(imgElement, -imgElement.width / 2, -imgElement.height / 2);
          ctx.restore();

          if (imgState.effect && imgState.effect !== 'None') {
            ctx.filter = 'none';
            if (imgState.effect === 'Pixelate') {
              const pSize = imgState.pixelSize || 16;
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = Math.max(1, Math.ceil(offscreenCanvas.width / pSize));
              tempCanvas.height = Math.max(1, Math.ceil(offscreenCanvas.height / pSize));
              const tempCtx = tempCanvas.getContext('2d');
              if (tempCtx) {
                tempCtx.imageSmoothingEnabled = false;
                tempCtx.drawImage(offscreenCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
              }
            } else if (imgState.effect === 'EdgeDetection') {
              const imgData = ctx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);
              const d = imgData.data;
              const w = offscreenCanvas.width;
              const h = offscreenCanvas.height;
              const output = ctx.createImageData(w, h);
              const out = output.data;
              for (let y = 0; y < h - 1; y++) {
                for (let x = 0; x < w - 1; x++) {
                  const idx = (y * w + x) * 4;
                  const idxRight = (y * w + (x + 1)) * 4;
                  const idxDown = ((y + 1) * w + x) * 4;
                  
                  const lum = 0.299 * d[idx] + 0.587 * d[idx+1] + 0.114 * d[idx+2];
                  const lumRight = 0.299 * d[idxRight] + 0.587 * d[idxRight+1] + 0.114 * d[idxRight+2];
                  const lumDown = 0.299 * d[idxDown] + 0.587 * d[idxDown+1] + 0.114 * d[idxDown+2];
                  
                  const gx = lumRight - lum;
                  const gy = lumDown - lum;
                  const edge = Math.min(255, Math.sqrt(gx*gx + gy*gy) * 6);
                  
                  out[idx] = edge;
                  out[idx+1] = edge;
                  out[idx+2] = edge;
                  out[idx+3] = 255;
                }
              }
              ctx.putImageData(output, 0, 0);
            } else if (imgState.effect === 'EmojiMosaic') {
              const imgData = ctx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);
              const data = imgData.data;
              const w = offscreenCanvas.width;
              const h = offscreenCanvas.height;

              ctx.fillStyle = '#0a0a0c';
              ctx.fillRect(0, 0, w, h);

              const cellSize = imgState.emojiDensity || 12;
              ctx.font = `${cellSize}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';

              for (let y = cellSize / 2; y < h; y += cellSize) {
                for (let x = cellSize / 2; x < w; x += cellSize) {
                  const px = Math.floor(x);
                  const py = Math.floor(y);
                  if (px >= 0 && px < w && py >= 0 && py < h) {
                    const idx = (py * w + px) * 4;
                    const r = data[idx];
                    const g = data[idx+1];
                    const b = data[idx+2];
                    const a = data[idx+3];
                    
                    if (a > 30) {
                      let bestEmoji = '⚫';
                      let minDist = Infinity;
                      for (const pal of emojiPalette) {
                        const dist = Math.pow(r - pal.r, 2) + Math.pow(g - pal.g, 2) + Math.pow(b - pal.b, 2);
                        if (dist < minDist) {
                          minDist = dist;
                          bestEmoji = pal.emoji;
                        }
                      }
                      ctx.fillText(bestEmoji, x, y);
                    }
                  }
                }
              }
            }
          }
          
          const dataUrl = offscreenCanvas.toDataURL('image/png');
          const base64Data = dataUrl.split(',')[1];
          
          zip.file(`${imgState.name}_${targetWidth}x${targetHeight}.png`, base64Data, { base64: true });
        } catch (canvasErr) {
          console.error(`Canvas processing failed for: ${imgState.name}`, canvasErr);
          // Canvas failure / SecurityError fallback: export the original blob
          try {
            const response = await fetch(imgState.src);
            const blob = await response.blob();
            zip.file(imgState.name, blob);
          } catch (fetchErr) {
            console.error(`Fallback fetch failed for: ${imgState.name}`, fetchErr);
            zip.file(`${imgState.name}_download_link.txt`, `Source image URL: ${imgState.src}`);
          }
        }
      }

      // 2. Generate and Add Manifests (JSON, CSV, README)
      const manifestData = getManifestData();
      
      // JSON Manifest
      zip.file('dataset_manifest.json', JSON.stringify(manifestData, null, 2));

      // CSV Manifest
      const headers = ['id', 'filename', 'original_name', 'type', 'target_size', 'rotation', 'scale', 'filter', 'effect', 'pixel_size', 'emoji_density', 'ai_cleaned'];
      const csvContent = [
        headers.join(','),
        ...manifestData.map(row => {
          return headers.map(header => {
            const val = (row as any)[header];
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(',');
        })
      ].join('\n');
      zip.file('dataset_manifest.csv', csvContent);

      // README dataset documentation
      const resolutionCounts = manifestData.reduce((acc: any, img) => {
        acc[img.target_size] = (acc[img.target_size] || 0) + 1;
        return acc;
      }, {});
      const filterCounts = manifestData.reduce((acc: any, img) => {
        if (img.filter && img.filter !== 'None') {
          acc[img.filter] = (acc[img.filter] || 0) + 1;
        }
        return acc;
      }, {});
      const effectCounts = manifestData.reduce((acc: any, img) => {
        if (img.effect && img.effect !== 'None') {
          acc[img.effect] = (acc[img.effect] || 0) + 1;
        }
        return acc;
      }, {});

      const readmeText = `# Machine Learning Training Dataset Export

Compiled and optimized with **Circle Dataset Processing Station**.

## Dataset Metrics
- **Total Registered Samples**: ${images.length}
- **Image Assets**: ${manifestData.filter(d => d.type === 'image').length}
- **Video Assets**: ${manifestData.filter(d => d.type === 'video').length}

## Technical Distribution

### Target Dimensions Map
${Object.entries(resolutionCounts).map(([size, count]) => `- **${size}px × ${size}px**: ${count} assets`).join('\n') || '- None'}

### Applied Color Presets
${Object.entries(filterCounts).map(([filter, count]) => `- **${filter}**: ${count} files`).join('\n') || '- Standard / raw color profiles'}

### Custom Pixel / Shader Effects
${Object.entries(effectCounts).map(([eff, count]) => `- **${eff}**: ${count} files`).join('\n') || '- Standard visual presentations'}

## Bundle Assets Description
1. **dataset_manifest.json**: Exquisite structured JSON descriptor.
2. **dataset_manifest.csv**: Flattened dataset index ready for instant Pandas / PyTorch loader imports.
3. **[Asset Folders]**: PNG resolution-scaled output assets named as \`{originalName}_{targetSize}x{targetSize}.png\`.
`;
      zip.file('README.md', readmeText);

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `dataset_export.zip`);
    } catch (err) {
      console.error("ZIP Export failed completely:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const removeImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setImages(prev => {
      const next = prev.filter(img => img.id !== id);
      if (activeId === id) {
        setActiveId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  };

  const buttonClass = "bg-[#1D1D1B] text-[#F8F7F4] border border-[#1D1D1B] hover:bg-[#1D1D1B]/90 transition-all font-semibold text-xs uppercase tracking-widest flex items-center justify-center rounded-md shadow-none";

  return (
    <div className="h-screen w-full bg-neoyellow text-neoink font-sans flex flex-col overflow-hidden">
      {/* 1. Global Navigation Top Header */}
      <div className="shrink-0 h-20 bg-white border-b border-neoink/10 px-8 flex justify-between items-center z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative w-7 h-7 flex items-center justify-center">
            {/* Primary Outlined Circle */}
            <div className="w-5.5 h-5.5 rounded-full border border-neoink" />
            {/* Secondary Accent Filled Circle */}
            <div className="absolute w-3 h-3 rounded-full bg-neoaccent -top-0.5 -right-0.5 border border-white shadow-sm" />
          </div>
          <div>
            <h1 className="text-xs font-black uppercase tracking-widest text-neoink font-sans">circle</h1>
          </div>
        </div>
        
        {/* Navigation tabs */}
        <div className="flex bg-neoyellow/20 p-1 rounded-lg border border-neoink/5">
          <button
            onClick={() => setActiveTab('workspace')}
            className={`font-mono text-[10px] uppercase tracking-wider transition-all px-4 py-2 cursor-pointer rounded-md flex items-center gap-1.5 font-bold ${
              activeTab === 'workspace'
                ? 'bg-neoink text-white shadow-sm'
                : 'text-neoink/60 hover:text-neoink hover:bg-neoink/5'
            }`}
          >
            <span>Workspace</span>
            {images.length > 0 && (
              <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                activeTab === 'workspace' ? 'bg-white/20 text-white' : 'bg-neoink/10 text-neoink'
              }`}>
                {images.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('scraper')}
            className={`font-mono text-[10px] uppercase tracking-wider transition-all px-4 py-2 cursor-pointer rounded-md flex items-center gap-1.5 font-bold ${
              activeTab === 'scraper'
                ? 'bg-neoink text-white shadow-sm'
                : 'text-neoink/60 hover:text-neoink hover:bg-neoink/5'
            }`}
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            <span>Image Scraper</span>
            {scrapedResults.length > 0 && (
              <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                activeTab === 'scraper' ? 'bg-white/20 text-white' : 'bg-neoaccent/10 text-neoaccent'
              }`}>
                {scrapedResults.length}
              </span>
            )}
          </button>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={handleDeduplicate}
            disabled={images.length === 0}
            className={`py-2 px-4 font-mono text-[10px] uppercase tracking-wider font-bold border transition-all flex items-center gap-2 cursor-pointer rounded-md ${
              images.length > 0
                ? 'bg-white text-neoink border-neoink/15 hover:bg-neoink hover:text-white shadow-sm'
                : 'bg-white/40 text-neoink/30 border-neoink/10 cursor-not-allowed'
            }`}
            title="Scan workspace and remove duplicate or highly similar images"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clean Duplicates</span>
          </button>

          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className={`py-2 px-4 font-mono text-[10px] uppercase tracking-wider font-bold border transition-all flex items-center gap-2 cursor-pointer rounded-md ${
              history.length > 0
                ? 'bg-white text-neoink border-neoink/15 hover:bg-neoink hover:text-white shadow-sm'
                : 'bg-white/40 text-neoink/30 border-neoink/10 cursor-not-allowed'
            }`}
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo ({history.length})</span>
          </button>
        </div>
      </div>

      {/* Floating toast notification */}
      <AnimatePresence>
        {deduplicateStatus && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="absolute top-24 left-1/2 bg-neoink text-white px-5 py-3 rounded-full text-xs font-mono font-bold tracking-wider shadow-lg z-50 flex items-center gap-2.5 border border-white/10"
          >
            <Sparkles className="w-4 h-4 text-neoaccent animate-pulse" />
            <span>{deduplicateStatus}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Upload / Processing Overlay */}
      {isProcessingUpload && (
        <div className="absolute inset-0 bg-[#F8F7F4]/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="bg-white border border-[#1D1D1B]/15 p-8 rounded-md max-w-sm w-full shadow-xl space-y-6 flex flex-col items-center">
            <div className="relative flex items-center justify-center">
              <Loader className="w-12 h-12 text-[#E63946] animate-spin" />
              <CircleDot className="w-5 h-5 text-[#E63946] absolute animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold uppercase tracking-wider text-[#1D1D1B]">Processing Dataset</h3>
              <p className="text-xs text-[#1D1D1B]/60 leading-relaxed font-mono">
                Preparing training image formats and high-resolution layers...
              </p>
            </div>
            {/* Progress bar */}
            <div className="w-full space-y-2">
              <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-[#1D1D1B]/60 font-bold">
                <span>Progress</span>
                <span>{uploadProgress.current} / {uploadProgress.total}</span>
              </div>
              <div className="w-full h-1 bg-[#1D1D1B]/10">
                <div 
                  className="h-full bg-[#E63946] transition-all duration-300"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Screen Views */}
      <div className="flex-1 w-full min-h-0 relative flex">
        {activeTab === 'scraper' ? (
          /* ========================================================
             IMAGE & WEB SCRAPER STATION (GOOGLE IMAGES & WEB CRAWLER)
             ======================================================== */
          <div className="flex-1 h-full bg-[#F8F7F4] overflow-y-auto p-6 md:p-10 flex flex-col animate-fade-in relative text-left">
            <div className="max-w-6xl mx-auto w-full space-y-6 shrink-0 mb-6">
              
              {/* Dual-Mode Selector Tab */}
              <div className="flex bg-white p-1 border border-neoink/10 max-w-md w-full shrink-0 shadow-sm rounded-lg">
                <button
                  onClick={() => setScraperMode('google')}
                  className={`flex-1 py-1.5 text-center text-[10px] font-mono uppercase tracking-wider transition-all font-bold cursor-pointer flex items-center justify-center gap-1.5 rounded-md ${
                    scraperMode === 'google'
                      ? 'bg-neoink text-white shadow-sm'
                      : 'bg-transparent text-neoink/60 hover:text-neoink'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  Google Search Engine
                </button>
                <button
                  onClick={() => setScraperMode('url')}
                  className={`flex-1 py-1.5 text-center text-[10px] font-mono uppercase tracking-wider transition-all font-bold cursor-pointer flex items-center justify-center gap-1.5 rounded-md ${
                    scraperMode === 'url'
                      ? 'bg-neoink text-white shadow-sm'
                      : 'bg-transparent text-neoink/60 hover:text-neoink'
                  }`}
                >
                  <Link className="w-3.5 h-3.5" />
                  Direct URL Web Scraper
                </button>
              </div>

              {scraperMode === 'google' ? (
                /* ========================================================
                   GOOGLE SEARCH MODE
                   ======================================================== */
                <div className="space-y-6">
                   {/* Main Scraping Control Board */}
                   <div className="bg-white border border-neoink/10 p-6 shadow-sm space-y-5 rounded-xl">
                     <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neoink/10 pb-4">
                       <div className="space-y-1 text-left">
                         <h2 className="text-xl font-bold tracking-tight flex items-center gap-2 text-neoink">
                           <Globe className="w-5 h-5 text-neoaccent" />
                           <span>Google Search Engine Index</span>
                         </h2>
                         <p className="text-xs text-neoink/60 font-sans font-medium">
                           Query the global Google Images directory directly. Extract, filter, and batch-import clean assets into your workspace.
                         </p>
                       </div>

                       {scrapedResults.length > 0 && (
                         <div className="flex gap-2">
                           <button
                             onClick={() => {
                               const allIds = scrapedResults.map(r => r.id);
                               setSelectedScrapedIds(allIds);
                             }}
                             className="py-2 px-3.5 bg-white hover:bg-neoink/5 text-neoink text-xs font-mono font-bold uppercase tracking-wider border border-neoink/15 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                           >
                             <CheckSquare className="w-4 h-4" />
                             <span>Select All</span>
                           </button>
                         </div>
                       )}
                     </div>

                     {/* Dashboard Panel Search Inputs */}
                     <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                       <div className="md:col-span-8 space-y-1.5 text-left">
                         <label className="text-[10px] font-mono uppercase tracking-widest text-neoink/50 font-bold">Search Query / Subject</label>
                         <div className="relative">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neoink/30" />
                           <input
                             type="text"
                             value={scrapeQuery}
                             onChange={(e) => setScrapeQuery(e.target.value)}
                             placeholder="e.g. brutalist architecture, organic textures, sunset lights"
                             className="w-full pl-9 pr-4 py-2 bg-[#F8F7F4] text-neoink border border-neoink/10 focus:outline-none focus:border-neoaccent text-xs font-mono rounded-lg shadow-sm"
                             onKeyDown={(e) => {
                               if (e.key === 'Enter') handleScrape();
                             }}
                           />
                         </div>
                       </div>

                       <div className="md:col-span-2 space-y-1.5 text-left">
                         <label className="text-[10px] font-mono uppercase tracking-widest text-neoink/50 font-bold">Media Type</label>
                         <select
                           value={scrapeMediaType}
                           onChange={(e) => {
                             const val = e.target.value as 'Photos' | 'Videos';
                             setScrapeMediaType(val);
                             handleScrape(scrapeQuery, val);
                           }}
                           className="w-full px-3 py-2 bg-white text-neoink border border-neoink/15 focus:outline-none text-xs font-mono rounded-lg h-[38px] cursor-pointer shadow-sm"
                         >
                           <option value="Photos">Photos</option>
                           <option value="Videos">Videos</option>
                         </select>
                       </div>

                       <div className="md:col-span-2 flex items-end">
                         <button
                           onClick={() => handleScrape()}
                           disabled={isScraping}
                           className="w-full h-[38px] bg-neoaccent text-white hover:bg-neoaccent/90 disabled:bg-neoaccent/60 transition-all font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 rounded-lg shadow-md cursor-pointer"
                         >
                           {isScraping ? (
                             <>
                               <Loader className="w-3.5 h-3.5 animate-spin text-white" />
                               <span>PULLING</span>
                             </>
                           ) : (
                             <>
                               <Search className="w-3.5 h-3.5" />
                               <span>SCRAPE</span>
                             </>
                           )}
                         </button>
                       </div>
                     </div>

                     {/* Local Filtering Bar */}
                     {scrapedResults.length > 0 && (
                       <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-neoink/10 text-left">
                         <div className="relative flex-1">
                           <Filter className="w-3.5 h-3.5 text-neoink/30 absolute left-3 top-1/2 -translate-y-1/2" />
                           <input
                             type="text"
                             placeholder="Search & filter current scraped results locally..."
                             value={scraperSearchQuery}
                             onChange={(e) => setScraperSearchQuery(e.target.value)}
                             className="w-full pl-9 pr-4 py-2 bg-white text-neoink placeholder-neoink/40 border border-neoink/15 focus:outline-none focus:border-neoaccent text-xs font-mono rounded-lg shadow-sm"
                           />
                           {scraperSearchQuery && (
                             <button
                               onClick={() => setScraperSearchQuery('')}
                               className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-neoaccent font-bold hover:underline cursor-pointer"
                             >
                               Reset
                             </button>
                           )}
                         </div>
                       </div>
                     )}
                   </div>

                   {/* Suggestions list */}
                   <div className="flex flex-wrap gap-2 items-center bg-white p-4 border border-neoink/10 shadow-sm text-left rounded-xl">
                     <span className="text-[10px] font-mono uppercase text-neoink/50 font-bold">Search suggestions:</span>
                     {['brutalist concrete', 'sunset lights', 'cyberpunk city', 'cybernetic textures', 'high contrast macro'].map((sug) => (
                       <button
                         key={sug}
                         onClick={() => {
                           setScrapeQuery(sug);
                           handleScrape(sug);
                         }}
                         className={`px-3 py-1.5 border text-[10px] font-mono tracking-wide transition-all cursor-pointer rounded-lg ${
                           scrapeQuery === sug 
                             ? 'border-transparent text-white bg-neoaccent shadow-sm' 
                             : 'border-neoink/10 text-neoink/60 hover:text-neoink hover:bg-neoink/5'
                         }`}
                       >
                         #{sug}
                       </button>
                     ))}
                   </div>

                   {/* Scraper Grid Results Section */}
                   <div className="w-full flex-1 pb-24">
                     {isScraping ? (
                       <div className="py-24 text-center space-y-4">
                         <Loader className="w-10 h-10 mx-auto text-neoaccent animate-spin" />
                         <p className="text-xs font-mono uppercase text-neoink/50 tracking-widest animate-pulse font-bold">
                           Scanning tags & scraping Google Images index...
                         </p>
                       </div>
                     ) : scrapedResults.length === 0 ? (
                       <div className="py-20 text-center border border-dashed border-neoink/20 bg-white max-w-lg mx-auto p-8 shadow-sm rounded-xl">
                         <DownloadCloud className="w-12 h-12 text-neoink/20 mx-auto mb-3" />
                         <p className="text-xs font-mono uppercase text-neoink/50 tracking-wider font-bold">No results found yet</p>
                         <p className="text-xs text-neoink/40 mt-1">Try querying different subjects like 'brutalist' or 'textures' above</p>
                       </div>
                     ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {scrapedResults
                          .filter(item => {
                            if (!scraperSearchQuery) return true;
                            const q = scraperSearchQuery.toLowerCase();
                            return (item.alt || '').toLowerCase().includes(q) || (item.author || '').toLowerCase().includes(q);
                          })
                          .map((result: any, idx) => {
                             const isSelected = selectedScrapedIds.includes(result.id);
                             return (
                               <div 
                                 key={result.id || idx}
                                 onClick={() => toggleScrapedSelection(result.id)}
                                 className={`group bg-white border overflow-hidden transition-all duration-300 flex flex-col relative select-none cursor-pointer rounded-xl shadow-sm hover:shadow-md hover:scale-[1.01] ${
                                   isSelected 
                                     ? 'border-neoaccent shadow-md' 
                                     : 'border-neoink/10'
                                 }`}
                               >
                                 {/* Image box */}
                                 <div className="aspect-square w-full relative overflow-hidden bg-[#EBEAE5] border-b border-neoink/10">
                                   {result.isVideo ? (
                                     <div className="w-full h-full relative bg-black">
                                       <video 
                                         src={result.src} 
                                         poster={result.thumbnail}
                                         muted 
                                         loop 
                                         playsInline
                                         onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                                         onMouseLeave={(e) => e.currentTarget.pause()}
                                         className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                       />
                                       <div className="absolute top-3 left-3 bg-neoaccent text-white text-[8px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded shadow-sm z-10 flex items-center gap-1 pointer-events-none">
                                         <Video className="w-2.5 h-2.5" />
                                         <span>Video</span>
                                       </div>
                                     </div>
                                   ) : (
                                     <img 
                                       src={result.src} 
                                       alt={result.alt || 'scraped photo'} 
                                       className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                       referrerPolicy="no-referrer"
                                     />
                                   )}
 
                                   {/* Top-right checkbox selection overlay */}
                                   <div className="absolute top-3 right-3 z-10">
                                     <button
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         toggleScrapedSelection(result.id);
                                       }}
                                       className={`p-1.5 transition-all shadow-sm rounded-md border ${
                                         isSelected 
                                           ? 'bg-neoaccent text-white border-transparent' 
                                           : 'bg-white text-neoink/40 border-neoink/10 hover:text-neoink'
                                       }`}
                                     >
                                       {isSelected ? (
                                         <CheckSquare className="w-3.5 h-3.5" />
                                       ) : (
                                         <Square className="w-3.5 h-3.5" />
                                       )}
                                     </button>
                                   </div>
 
                                   {/* Center hover inspect overlay */}
                                   <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-10">
                                     <button
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         setFullscreenPreviewItem(result);
                                       }}
                                       className="pointer-events-auto bg-white text-neoink border border-neoink/15 hover:bg-neoaccent hover:text-white p-2.5 shadow-md hover:scale-110 transition-all rounded-lg"
                                       title="Inspect Image"
                                     >
                                       <Maximize2 className="w-4 h-4" />
                                     </button>
                                   </div>
                                 </div>
 
                                 {/* Details metadata */}
                                 <div className="p-4 space-y-2 text-left bg-white">
                                   <div className="flex justify-between items-start gap-2">
                                     <h4 className="text-[11px] font-bold uppercase tracking-wider truncate text-neoink flex-1 leading-snug font-sans">
                                       {result.alt || 'Dataset Sample'}
                                     </h4>
                                     <span className="text-[8px] font-mono bg-white border border-neoink/15 text-neoink/60 px-1.5 py-0.5 rounded-md uppercase font-bold">
                                       {result.targetSize}px
                                     </span>
                                   </div>
                                   
                                   <div className="flex justify-between items-center text-[9px] font-mono text-neoink/40 border-t border-neoink/10 pt-2">
                                     <span className="truncate max-w-[150px]">By {result.author || 'Catalog Provider'}</span>
                                   </div>
                                 </div>
                               </div>
                             );
                           })}
                       </div>
                     )}
                   </div>
                 </div>
               ) : (
                 /* ========================================================
                    DIRECT URL HTML WEBSITE SCRAPER MODE
                    ======================================================== */
                 <div className="space-y-6">
                   {/* Main Scrape board inputs */}
                   <div className="bg-neosurface border-4 border-neoink p-6 shadow-[8px_8px_0_#18181A] space-y-5 rounded-none">
                     <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-3 border-neoink pb-4">
                       <div className="space-y-1 text-left">
                         <h2 className="text-xl font-bold tracking-tight flex items-center gap-2 text-neoink">
                           <Link className="w-6 h-6 text-neoaccent stroke-[2.5]" />
                           <span>Direct URL HTML Web Scraper</span>
                         </h2>
                         <p className="text-xs text-neoink/70 font-sans font-medium">
                           Enter any public webpage URL. Our secure bypass proxy downloads the document, extracts metadata, headings, page links, and high-quality image resources instantly.
                         </p>
                       </div>
 
                       {urlScrapedData && urlScrapedData.images.length > 0 && (
                         <div className="flex gap-2">
                           <button
                             onClick={() => {
                               const allIds = urlScrapedData.images.map(img => img.id);
                               setSelectedUrlScrapedIds(allIds);
                             }}
                             className="py-2.5 px-4 bg-neoyellow text-neoink text-xs font-mono font-bold uppercase tracking-wider border-3 border-neoink shadow-[3px_3px_0_#18181A] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#18181A] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_#18181A] transition-all flex items-center gap-1.5 cursor-pointer rounded-none"
                           >
                             <CheckSquare className="w-4 h-4 stroke-[2.5]" />
                             <span>Select All Extracted</span>
                           </button>
                         </div>
                       )}
                     </div>
 
                     <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                       <div className="md:col-span-10 space-y-1.5 text-left">
                         <label className="text-[10px] font-mono uppercase tracking-widest text-neoink/60 font-bold">Target Web Address URL</label>
                         <div className="relative">
                           <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neoink/40 stroke-[2.5]" />
                           <input
                             type="text"
                             value={scrapeUrlInput}
                             onChange={(e) => setScrapeUrlInput(e.target.value)}
                             placeholder="e.g. https://unsplash.com/t/textures-patterns or wiki pages"
                             className="w-full pl-9 pr-4 py-2.5 bg-neoyellow/10 text-neoink border-3 border-neoink focus:outline-none focus:bg-neoyellow/20 text-xs font-mono rounded-none"
                             onKeyDown={(e) => {
                               if (e.key === 'Enter') handleUrlScrape();
                             }}
                           />
                         </div>
                       </div>
 
                       <div className="md:col-span-2 flex items-end">
                         <button
                           onClick={handleUrlScrape}
                           disabled={isUrlScraping}
                           className="w-full h-[42px] bg-neoaccent text-white hover:bg-neoaccent/90 disabled:bg-neoaccent/60 transition-all font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 border-3 border-neoink shadow-[3px_3px_0_#18181A] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#18181A] cursor-pointer rounded-none"
                         >
                           {isUrlScraping ? (
                             <>
                               <Loader className="w-3.5 h-3.5 animate-spin text-white stroke-[2.5]" />
                               <span>CRAWLING</span>
                             </>
                           ) : (
                             <>
                               <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                               <span>EXTRACT</span>
                             </>
                           )}
                         </button>
                       </div>
                     </div>
                  </div>

                  {/* Suggestion targets */}
                  <div className="flex flex-wrap gap-2 items-center bg-neosurface p-4 border-3 border-neoink shadow-[4px_4px_0_#18181A] text-left rounded-none">
                    <span className="text-[10px] font-mono uppercase text-neoink/60 font-bold">Recommended crawls:</span>
                    {[
                      { name: 'Unsplash Textures', url: 'https://unsplash.com/t/textures-patterns' },
                      { name: 'Wikipedia Brutalism', url: 'https://en.wikipedia.org/wiki/Brutalist_architecture' },
                      { name: 'HackerNews', url: 'https://news.ycombinator.com' }
                    ].map((target) => (
                      <button
                        key={target.name}
                        onClick={() => {
                          setScrapeUrlInput(target.url);
                          // trigger immediate scrape
                          setIsUrlScraping(true);
                          setUrlScraperError(null);
                          fetch(`/api/scrape-url?url=${encodeURIComponent(target.url)}`)
                            .then(r => r.json())
                            .then(data => {
                              if (data.success) {
                                setUrlScrapedData(data);
                                setSelectedUrlScrapedIds([]);
                              } else {
                                setUrlScraperError(data.error);
                              }
                            })
                            .catch(() => setUrlScraperError("Could not download resources from this proxy."))
                            .finally(() => setIsUrlScraping(false));
                        }}
                        className="px-3 py-1.5 border-2 text-[10px] font-mono tracking-wide transition-all cursor-pointer rounded-none border-neoink text-neoink hover:bg-neoaccent hover:text-white hover:shadow-[2px_2px_0_#18181A]"
                      >
                        {target.name}
                      </button>
                    ))}
                  </div>

                  {/* Web crawler output displays */}
                  {isUrlScraping ? (
                    <div className="py-24 text-center space-y-4 bg-neosurface border-4 border-neoink shadow-[6px_6px_0_#18181A] rounded-none">
                      <Loader className="w-10 h-10 mx-auto text-neoaccent animate-spin stroke-[2.5]" />
                      <p className="text-xs font-mono uppercase text-neoink/60 tracking-widest animate-pulse font-bold">
                        Connecting to target page & bypassing blockers...
                      </p>
                      <p className="text-[10px] text-neoink/50 font-mono">Parsing HTML document structure, locating CDN tags and meta structures</p>
                    </div>
                  ) : urlScraperError ? (
                    <div className="p-8 text-center bg-neosurface border-4 border-dashed border-neoaccent text-neoaccent shadow-[6px_6px_0_#18181A] rounded-none space-y-2">
                      <X className="w-10 h-10 mx-auto text-neoaccent stroke-[2.5]" />
                      <h4 className="text-sm font-bold uppercase tracking-wider">Scraping Interrupted</h4>
                      <p className="text-xs text-neoink/70 max-w-md mx-auto leading-relaxed font-sans font-medium">
                        {urlScraperError}
                      </p>
                    </div>
                  ) : urlScrapedData ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      {/* Left: Website details sidebar */}
                      <div className="lg:col-span-4 space-y-6">
                        <div className="bg-neosurface border-4 border-neoink p-5 shadow-[6px_6px_0_#18181A] rounded-none space-y-5 text-left">
                          <h3 className="font-gaegu text-2xl uppercase tracking-wider text-neoink font-bold border-b-3 border-neoink pb-2">Target Metadata</h3>
                          
                          <div className="space-y-1">
                            <span className="text-[9px] font-mono uppercase bg-neoyellow border border-neoink text-neoink px-2 py-0.5 rounded-none font-bold">Page Title</span>
                            <h4 className="text-sm font-extrabold text-neoink tracking-tight leading-snug break-words">
                              {urlScrapedData.title}
                            </h4>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[9px] font-mono uppercase bg-neoyellow border border-neoink text-neoink px-2 py-0.5 rounded-none font-bold">Meta Description</span>
                            <p className="text-xs text-neoink/75 leading-relaxed font-sans font-medium max-h-24 overflow-y-auto break-words pr-2">
                              {urlScrapedData.description}
                            </p>
                          </div>

                          {urlScrapedData.headings && urlScrapedData.headings.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-[9px] font-mono uppercase bg-neoyellow border border-neoink text-neoink px-2 py-0.5 rounded-none font-bold">Key Content Headings</span>
                              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-2">
                                {urlScrapedData.headings.map((heading, hIdx) => (
                                  <div key={hIdx} className="flex gap-2 items-start text-xs text-neoink/85 font-mono leading-tight">
                                    <FileText className="w-3.5 h-3.5 shrink-0 text-neoaccent mt-0.5 stroke-[2.5]" />
                                    <span className="break-words font-medium">{heading}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {urlScrapedData.links && urlScrapedData.links.length > 0 && (
                            <div className="space-y-2 border-t-3 border-neoink pt-4">
                              <span className="text-[9px] font-mono uppercase bg-neoyellow border border-neoink text-neoink px-2 py-0.5 rounded-none font-bold">Discovered Links</span>
                              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                {urlScrapedData.links.map((lnk, lIdx) => (
                                  <a 
                                    key={lIdx} 
                                    href={lnk.href} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between gap-2 p-1.5 rounded-none hover:bg-neoyellow/25 border-2 border-transparent hover:border-neoink text-left text-[11px] text-neoink/70 hover:text-neoaccent font-mono transition-all"
                                  >
                                    <span className="truncate max-w-[160px]">{lnk.text || 'Page Anchor Link'}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0 opacity-60 group-hover:opacity-100" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Discovered images grid */}
                      <div className="lg:col-span-8 space-y-4 text-left">
                        <div className="flex justify-between items-center bg-neosurface border-3 border-neoink px-4 py-3 rounded-none shadow-[4px_4px_0_#18181A]">
                          <span className="text-xs font-mono font-bold uppercase text-neoink">
                            Found {urlScrapedData.images.length} Image resources
                          </span>
                          {urlScrapedData.images.length > 0 && (
                            <span className="text-[10px] font-mono text-neoink/75 font-bold bg-neoyellow border-2 border-neoink px-2 py-1 rounded-none">
                              {selectedUrlScrapedIds.length} of {urlScrapedData.images.length} selected
                            </span>
                          )}
                        </div>

                        {urlScrapedData.images.length === 0 ? (
                          <div className="py-20 text-center bg-neosurface border-4 border-dashed border-neoink shadow-[6px_6px_0_#18181A] rounded-none">
                            <ImageIcon className="w-12 h-12 text-neoink/20 mx-auto mb-2" />
                            <h4 className="text-xs font-mono font-bold uppercase text-neoink/50">No extracted images found</h4>
                            <p className="text-xs text-neoink/40 max-w-sm mx-auto mt-1">This page may serve images as inline CSS attributes or through canvas buffers.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pb-28">
                            {urlScrapedData.images.map((img) => {
                              const isSelected = selectedUrlScrapedIds.includes(img.id);
                              return (
                                <div 
                                  key={img.id}
                                  onClick={() => toggleUrlScrapedSelection(img.id)}
                                  className={`group bg-neosurface border-3 border-neoink overflow-hidden transition-all duration-300 flex flex-col relative select-none cursor-pointer ${
                                    isSelected 
                                      ? 'shadow-[4px_4px_0_#18181A] -translate-x-[2px] -translate-y-[2px] border-neoaccent' 
                                      : 'shadow-[4px_4px_0_#18181A] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0_#18181A]'
                                  }`}
                                >
                                  <div className="aspect-square relative overflow-hidden bg-[#EBEAE5] border-b-3 border-neoink">
                                    <img 
                                      src={img.src} 
                                      alt={img.alt} 
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                      loading="lazy"
                                      referrerPolicy="no-referrer"
                                    />
                                    
                                    {/* Selection badge */}
                                    <div className="absolute top-2.5 right-2.5 z-10">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleUrlScrapedSelection(img.id);
                                        }}
                                        className={`p-1.5 transition-all shadow-sm rounded-none border-2 border-neoink ${
                                          isSelected 
                                            ? 'bg-neoaccent text-white' 
                                            : 'bg-white text-neoink/40 hover:text-neoink'
                                        }`}
                                      >
                                        {isSelected ? (
                                          <CheckSquare className="w-3.5 h-3.5 stroke-[2.5]" />
                                        ) : (
                                          <Square className="w-3.5 h-3.5 stroke-[2.5]" />
                                        )}
                                      </button>
                                    </div>
 
                                    {/* Hover inspect zoom overlay */}
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-10">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setFullscreenPreviewItem(img);
                                        }}
                                        className="pointer-events-auto bg-neosurface text-neoink border-2 border-neoink hover:bg-neoaccent hover:text-white p-2.5 shadow-md hover:scale-110 transition-all rounded-none"
                                      >
                                        <Maximize2 className="w-4 h-4 stroke-[2.5]" />
                                      </button>
                                    </div>
                                  </div>
 
                                  <div className="p-3 space-y-1 bg-neosurface">
                                    <h5 className="text-[10px] font-bold text-neoink truncate leading-tight">
                                      {img.alt || 'Discovered Asset'}
                                    </h5>
                                    <div className="flex justify-between items-center text-[8px] font-mono text-neoink/40 pt-1.5 border-t-2 border-neoink/10">
                                      <span>{img.resolutionLabel}</span>
                                      <span>{img.sizeLabel}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-20 text-center border-4 border-dashed border-neoink bg-neosurface max-w-lg mx-auto p-8 shadow-[8px_8px_0_#18181A] rounded-none">
                      <Link className="w-12 h-12 text-neoink/30 mx-auto mb-3 stroke-[2]" />
                      <p className="text-xs font-mono uppercase text-neoink/60 font-bold tracking-wider">No URL parsed yet</p>
                      <p className="text-xs text-neoink/40 mt-1">Enter a website URL above and click extract to download images instantly</p>
                    </div>
                  )}
                </div>
              )}
            </div>
 
            {/* Google Search Bottom Floating Sync Bar */}
            <AnimatePresence>
              {scraperMode === 'google' && selectedScrapedIds.length > 0 && (
                <motion.div
                  initial={{ y: 80, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 80, opacity: 0 }}
                  className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-neosurface border-4 border-neoink px-6 py-4 shadow-[6px_6px_0_#18181A] z-40 max-w-xl w-full flex items-center justify-between gap-6 rounded-none"
                >
                  <div className="flex items-center gap-3 text-left">
                     <div className="w-10 h-10 bg-neoaccent/10 text-neoaccent border-2 border-neoink rounded-none flex items-center justify-center shrink-0">
                      <Grid className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-neoink uppercase tracking-wide">Workspace Scraped Sync</p>
                      <p className="text-[10px] text-neoink/60 font-mono font-bold">{selectedScrapedIds.length} assets selected for batch ingestion</p>
                    </div>
                  </div>
 
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={clearScrapedSelection}
                      className="py-2 px-4 bg-transparent hover:bg-neoink/5 text-neoink/60 text-[10px] font-mono font-bold uppercase tracking-widest transition-all cursor-pointer border-2 border-transparent hover:border-neoink rounded-none"
                    >
                      Clear
                    </button>
                    <button
                      onClick={importSelectedScrapedBatch}
                      className="py-2.5 px-4 bg-neoaccent hover:bg-neoaccent/95 text-white font-mono font-bold uppercase tracking-widest text-[10px] border-3 border-neoink shadow-[3px_3px_0_#18181A] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#18181A] transition-all flex items-center gap-1.5 cursor-pointer rounded-none"
                    >
                      <DownloadCloud className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Ingest Selected ({selectedScrapedIds.length})</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
 
            {/* Direct URL Scraped Bottom Floating Sync Bar */}
            <AnimatePresence>
              {scraperMode === 'url' && selectedUrlScrapedIds.length > 0 && (
                <motion.div
                  initial={{ y: 80, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 80, opacity: 0 }}
                  className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-neosurface border-4 border-neoink px-6 py-4 shadow-[6px_6px_0_#18181A] z-40 max-w-xl w-full flex items-center justify-between gap-6 rounded-none"
                >
                  <div className="flex items-center gap-3 text-left">
                     <div className="w-10 h-10 bg-neoaccent/10 text-neoaccent border-2 border-neoink rounded-none flex items-center justify-center shrink-0">
                      <Grid className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-neoink uppercase tracking-wide">URL Extracted Sync</p>
                      <p className="text-[10px] text-neoink/60 font-mono font-bold">{selectedUrlScrapedIds.length} assets selected for batch ingestion</p>
                    </div>
                  </div>
 
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setSelectedUrlScrapedIds([])}
                      className="py-2 px-4 bg-transparent hover:bg-neoink/5 text-neoink/60 text-[10px] font-mono font-bold uppercase tracking-widest transition-all cursor-pointer border-2 border-transparent hover:border-neoink rounded-none"
                    >
                      Clear
                    </button>
                    <button
                      onClick={importSelectedUrlScrapedBatch}
                      className="py-2.5 px-4 bg-neoaccent hover:bg-neoaccent/95 text-white font-mono font-bold uppercase tracking-widest text-[10px] border-3 border-neoink shadow-[3px_3px_0_#18181A] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#18181A] transition-all flex items-center gap-1.5 cursor-pointer rounded-none"
                    >
                      <DownloadCloud className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Ingest Selected ({selectedUrlScrapedIds.length})</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        ) : (
          /* ========================================================
             WORKSPACE TAB (MAIN EDITOR & DRAG-AND-DROP)
             ======================================================== */
          images.length === 0 ? (
            /* Empty Workspace state with quick library recommendation */
            <div className="flex-1 flex flex-col p-8 md:p-12 items-center justify-center bg-neoyellow/10 animate-fade-in">
              <div className="text-center mb-8 max-w-md">
                <UploadCloud className="w-16 h-16 text-neoaccent mx-auto mb-4 stroke-[2.5]" />
                <h2 className="font-gaegu text-4xl text-neoink font-bold mb-2">Workspace is Empty</h2>
                <p className="text-neoink/75 text-xs leading-relaxed font-sans font-medium">
                  Upload raw training dataset photos to rotate, scale, crop-resize, and package as a ZIP collection.
                </p>
              </div>

              <div 
                onDragOver={onDragOver}
                onDrop={onDrop}
                className="w-full max-w-2xl aspect-[2/1] border border-dashed border-neoink/20 rounded-2xl flex flex-col items-center justify-center bg-white hover:bg-neoink/5 transition-all cursor-pointer p-6 group shadow-sm"
              >
                <FolderOpen className="w-12 h-12 text-neoink/60 mb-3 group-hover:scale-105 transition-transform duration-300 stroke-[2.5]" />
                <h3 className="text-2xl text-neoink font-bold mb-1 tracking-tight">Drag & Drop Photos Here</h3>
                <p className="text-[10px] font-mono text-neoink/50 mb-6 uppercase tracking-wider font-bold">Supports PNG, JPG, WEBP formats</p>
                
                <label className="py-2.5 px-6 bg-neoaccent text-white hover:bg-neoaccent/90 transition-all font-mono font-bold text-xs uppercase tracking-widest cursor-pointer rounded-lg shadow-md">
                  Browse Files
                  <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileChange} />
                </label>
              </div>

              <div className="mt-8 bg-white border border-neoink/10 p-6 rounded-xl max-w-xl w-full flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
                <div className="space-y-1 text-left">
                  <h4 className="text-xs font-extrabold text-neoaccent tracking-widest uppercase flex items-center gap-1.5 font-sans">
                    <Sparkles className="w-4 h-4 text-neoaccent stroke-[2.5]" />
                    <span>Quick Start: Image Search Station</span>
                  </h4>
                  <p className="text-xs text-neoink/70 leading-normal font-sans font-medium">
                    Don't have images ready? Search and extract training dataset pictures instantly using our Google Search Engine or URL Web Scraper.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('scraper')}
                  className="shrink-0 py-2.5 px-5 bg-white text-neoink hover:bg-neoink hover:text-white border border-neoink/15 shadow-sm transition-all font-mono font-bold text-[10px] uppercase tracking-wider cursor-pointer rounded-lg"
                >
                  Open Scraper
                </button>
              </div>
            </div>
          ) : (
             /* Active Workspace layout: Left Sidebar, Center Preview, Right Controls */
             <div className="flex-1 flex w-full h-full min-h-0">
              {/* Left Sidebar Gallery */}
              <div className="shrink-0 w-28 bg-[#F8F7F4] border-r border-neoink/10 py-6 flex flex-col gap-6 overflow-y-auto no-scrollbar items-center relative z-10 h-full shadow-sm">
                <label className="shrink-0 w-16 h-16 border border-dashed border-neoink/20 hover:border-neoaccent hover:bg-neoaccent/5 rounded-full flex flex-col items-center justify-center text-neoink/60 hover:text-neoaccent transition-all cursor-pointer" title="Add More">
                  <Plus className="w-6 h-6 stroke-[3]" />
                  <input type="file" className="hidden" accept="image/*,video/*" multiple onChange={handleFileChange} />
                </label>

                {/* Pulsing circular button to quickly remove/fix all broken files */}
                {images.some(img => img.isBroken) && (
                  <button
                    onClick={() => {
                      setImages(prev => {
                        const next = prev.filter(img => !img.isBroken);
                        if (next.length > 0) {
                          if (!next.find(img => img.id === activeId)) {
                            setActiveId(next[0].id);
                          }
                        } else {
                          setActiveId(null);
                        }
                        return next;
                      });
                    }}
                    className="shrink-0 w-16 h-16 bg-neoaccent hover:bg-neoaccent/90 rounded-full flex flex-col items-center justify-center text-white transition-all cursor-pointer shadow-md hover:scale-[1.02] animate-pulse"
                    title="Filter/Fix Corrupted or Broken Files"
                  >
                    <Trash2 className="w-5 h-5 mb-0.5 stroke-[2.5]" />
                    <span className="text-[8px] font-bold uppercase tracking-widest">Fix {images.filter(img => img.isBroken).length}</span>
                  </button>
                )}
                
                {images.map((img) => (
                  <div key={img.id} className="relative group flex items-center justify-center shrink-0 w-24 h-24">
                    <div 
                      onClick={() => !img.isBroken && setActiveId(img.id)}
                      className={`w-20 h-20 rounded-full overflow-hidden relative cursor-pointer transition-all duration-300 ${
                        img.isBroken
                          ? 'border border-neoaccent bg-neoaccent/5 flex flex-col items-center justify-center'
                          : activeId === img.id 
                            ? 'border-2 border-neoaccent scale-105 shadow-md' 
                            : 'border border-neoink/10 hover:border-neoaccent hover:scale-105 shadow-sm bg-white'
                      }`}
                    >
                      {img.isBroken ? (
                        <div className="flex flex-col items-center justify-center text-center p-2">
                          <X className="w-5 h-5 text-neoaccent mb-0.5 stroke-[2.5]" />
                          <span className="text-[8px] font-bold text-neoaccent uppercase tracking-wide font-mono">Broken</span>
                        </div>
                      ) : img.isVideo ? (
                        <div className="w-full h-full relative bg-black flex items-center justify-center">
                          <video 
                            src={img.src} 
                            className="w-full h-full object-cover rounded-full" 
                            muted
                            playsInline
                          />
                          <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center">
                            <Video className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      ) : (
                        <img 
                          src={img.src} 
                          alt={img.name} 
                          className="w-full h-full object-cover rounded-full" 
                          onError={() => markAsBroken(img.id)}
                        />
                      )}
                    </div>
                    
                    {/* Settings Hover Preview */}
                    {!img.isBroken && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-white p-4 rounded-xl text-left opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-50 border border-neoink/10 shadow-lg flex gap-4 items-center">
                        <div className="w-16 h-16 rounded-full border border-neoink/10 overflow-hidden bg-[#F8F7F4] flex items-center justify-center shrink-0">
                          {img.isVideo ? (
                            <div className="w-full h-full relative bg-black flex items-center justify-center">
                              <video 
                                src={img.src} 
                                className="max-w-full max-h-full object-contain"
                                style={{ transform: `rotate(${img.rotation}deg) scale(${img.scale})` }} 
                                muted
                              />
                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                <Video className="w-3.5 h-3.5 text-white" />
                              </div>
                            </div>
                          ) : (
                            <img 
                              src={img.src} 
                              style={{ transform: `rotate(${img.rotation}deg) scale(${img.scale})` }} 
                              className="max-w-full max-h-full object-contain"
                              alt="preview"
                            />
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-neoink font-bold uppercase tracking-wider mb-0.5">{img.name}</p>
                          <p className="text-[10px] text-neoink/50 font-mono uppercase tracking-widest font-bold">Target: {img.targetSize}px</p>
                          <p className="text-[10px] text-neoink/40 font-mono uppercase tracking-widest font-bold">Rot: {img.rotation}° • Scale: {img.scale.toFixed(1)}x</p>
                          {img.watermarkRemoved && (
                            <span className="text-[9px] text-[#2EC4B6] font-bold font-mono uppercase tracking-widest flex items-center gap-1 mt-1">
                              <Sparkles className="w-2.5 h-2.5 stroke-[2.5]" /> AI Cleaned
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <button 
                      onClick={(e) => removeImage(img.id, e)}
                      className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center bg-white hover:bg-neoaccent hover:text-white rounded-full text-neoink border border-neoink/10 shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Center Workspace Area */}
              <div className="flex-1 flex flex-col h-full bg-[#FAF9F5] relative z-0 border-l border-neoink/10">
                <div 
                  className="flex-1 p-8 flex items-center justify-center overflow-hidden relative min-h-0"
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                >
                  <div className="relative flex items-center justify-center max-w-full max-h-full overflow-hidden select-none">
                    {activeImage?.isVideo ? (
                      <video 
                        src={activeImage.src}
                        controls
                        autoPlay
                        loop
                        muted
                        className="max-w-full max-h-full object-contain bg-black shadow-lg rounded-2xl border border-neoink/10 transition-all"
                        style={{
                          transform: `rotate(${activeImage.rotation}deg) scale(${activeImage.scale})`,
                          filter: 
                            activeImage.filter === 'Grayscale' ? 'grayscale(100%)' :
                            activeImage.filter === 'Sepia' ? 'sepia(100%)' :
                            activeImage.filter === 'Warm' ? 'sepia(30%) saturate(140%) hue-rotate(-10deg)' :
                            activeImage.filter === 'Cool' ? 'contrast(110%) saturate(110%) hue-rotate(15deg)' :
                            activeImage.filter === 'Vintage' ? 'contrast(90%) sepia(50%) hue-rotate(-15deg) saturate(80%)' :
                            activeImage.filter === 'Invert' ? 'invert(100%)' :
                            activeImage.filter === 'Sunset' ? 'sepia(40%) saturate(180%) hue-rotate(-20deg) contrast(105%)' :
                            'none'
                        }}
                      />
                    ) : (
                      <canvas 
                        ref={canvasRef} 
                        onMouseMove={handleCanvasMouseMove}
                        onMouseLeave={handleCanvasMouseLeave}
                        className="max-w-full max-h-full object-contain bg-white shadow-lg rounded-2xl border border-neoink/10 transition-all cursor-crosshair"
                      />
                    )}
                    
                    {/* Pixel Lead Interactive Overlay */}
                    {enablePixelLead && pixelLead && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <div 
                          className="absolute left-0 right-0 h-[1.5px] bg-neoaccent/40 border-t border-white/25"
                          style={{ top: `${pixelLead.visualY}px` }}
                        />
                        <div 
                          className="absolute top-0 bottom-0 w-[1.5px] bg-neoaccent/40 border-l border-white/25"
                          style={{ left: `${pixelLead.visualX}px` }}
                        />
                        
                        {/* Precision Info Card */}
                        <div 
                          className="absolute bg-white text-neoink p-3.5 border border-neoink/10 shadow-lg flex flex-col gap-1.5 text-[10px] font-mono rounded-xl z-50 min-w-[160px]"
                          style={{ 
                            left: `${Math.min(pixelLead.visualX + 16, (canvasRef.current?.clientWidth || 500) - 180)}px`, 
                            top: `${Math.min(pixelLead.visualY + 16, (canvasRef.current?.clientHeight || 500) - 120)}px` 
                          }}
                        >
                          <div className="flex justify-between gap-5 border-b border-neoink/10 pb-1 mb-1 font-bold">
                            <span className="tracking-wider text-neoink/50">PIXEL LEAD</span>
                            <span className="text-neoaccent">RGB</span>
                          </div>
                          <div className="flex justify-between gap-5 font-bold text-[9px]">
                            <span className="text-neoink/40">X / Y:</span>
                            <span>{pixelLead.x}, {pixelLead.y} px</span>
                          </div>
                          <div className="flex justify-between gap-5 font-bold text-[9px]">
                            <span className="text-neoink/40">COLOR:</span>
                            <span>({pixelLead.r},{pixelLead.g},{pixelLead.b})</span>
                          </div>
                          <div className="flex justify-between gap-5 font-bold text-[9px]">
                            <span className="text-neoink/40">HEX:</span>
                            <span className="text-neoaccent font-extrabold">{pixelLead.hex}</span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-1.5 border-t border-neoink/5 pt-1.5 font-bold">
                            <div className="w-4.5 h-4.5 rounded-md border border-neoink/10 shadow-sm" style={{ backgroundColor: pixelLead.hex }} />
                            <span className="text-[8px] text-neoink/40 uppercase tracking-wider">Swatched</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
 
                  <div className="absolute bottom-4 right-4 text-[9px] font-mono uppercase tracking-widest text-neoink/80 bg-white px-3.5 py-2 border border-neoink/10 shadow-md flex gap-4 font-bold rounded-lg">
                    <span>Target Size: {activeImage?.targetSize}px</span>
                    {imgRef.current ? (
                      <span className="border-l border-neoink/10 pl-4 text-neoink/50">
                        Src: {imgRef.current.width}×{imgRef.current.height}px
                      </span>
                    ) : activeImage?.isVideo ? (
                      <span className="border-l border-neoink/10 pl-4 text-neoink/50">
                        Format: MP4 Video
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
 
              {/* Right Settings Panel */}
              <div className="shrink-0 w-[400px] h-full bg-white border-l border-neoink/10 flex flex-col">
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-neoink/40 mb-6 border-b border-neoink/10 pb-3 font-mono">Adjustments</h3>
                    
                    {activeImage && (
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-bold uppercase tracking-wider text-neoink/85 font-sans">Rotation: {activeImage.rotation}°</label>
                            <div className="flex gap-1">
                              <button onClick={() => updateActiveImage({ rotation: activeImage.rotation - 10 })} className="p-2 bg-[#F8F7F4] hover:bg-neoaccent hover:text-white text-neoink border border-neoink/5 transition-all cursor-pointer rounded-lg" title="-10°">
                                <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                              <button onClick={() => updateActiveImage({ rotation: activeImage.rotation - 1 })} className="px-2.5 py-1 bg-[#F8F7F4] hover:bg-neoaccent hover:text-white text-neoink text-[10px] font-mono transition-all cursor-pointer rounded-lg font-bold" title="-1°">
                                -1°
                              </button>
                              <button onClick={() => updateActiveImage({ rotation: 0 })} className="px-3 py-1 bg-[#F8F7F4] hover:bg-neoaccent hover:text-white text-neoink text-[10px] font-mono transition-all cursor-pointer rounded-lg font-bold">
                                0°
                              </button>
                              <button onClick={() => updateActiveImage({ rotation: activeImage.rotation + 1 })} className="px-2.5 py-1 bg-[#F8F7F4] hover:bg-neoaccent hover:text-white text-neoink text-[10px] font-mono transition-all cursor-pointer rounded-lg font-bold" title="+1°">
                                +1°
                              </button>
                              <button onClick={() => updateActiveImage({ rotation: activeImage.rotation + 10 })} className="p-2 bg-[#F8F7F4] hover:bg-neoaccent hover:text-white text-neoink border border-neoink/5 transition-all cursor-pointer rounded-lg" title="+10°">
                                <RotateCw className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                            </div>
                          </div>
                        </div>
 
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-bold uppercase tracking-wider text-neoink/85 font-sans">Scale: {activeImage.scale.toFixed(2)}x</label>
                            <div className="flex gap-1">
                              <button onClick={() => updateActiveImage({ scale: Math.max(0.1, activeImage.scale - 0.1) })} className="p-2 bg-[#F8F7F4] hover:bg-neoaccent hover:text-white text-neoink border border-neoink/5 transition-all cursor-pointer rounded-lg">
                                <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                              <button onClick={() => updateActiveImage({ scale: 1 })} className="px-3 py-1 bg-[#F8F7F4] hover:bg-neoaccent hover:text-white text-neoink text-[10px] font-mono transition-all flex items-center space-x-1 cursor-pointer rounded-lg font-bold">
                                <RefreshCw className="w-3 h-3 text-neoink/40 stroke-[2.5]" />
                                <span>1x</span>
                              </button>
                              <button onClick={() => updateActiveImage({ scale: activeImage.scale + 0.1 })} className="p-2 bg-[#F8F7F4] hover:bg-neoaccent hover:text-white text-neoink border border-neoink/5 transition-all cursor-pointer rounded-lg">
                                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                              </button>
                            </div>
                          </div>
                        </div>
 
                        <div className="space-y-4 pt-6 border-t border-neoink/10 text-left">
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-neoink/85 font-sans">Target Resolution</label>
                            <label className="flex items-center space-x-2 cursor-pointer group">
                              <input 
                                type="checkbox" 
                                checked={applyToAll}
                                onChange={(e) => setApplyToAll(e.target.checked)}
                                className="rounded-md border border-neoink/20 bg-white text-neoaccent focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer accent-neoaccent"
                              />
                              <span className="text-[10px] font-mono uppercase tracking-wider text-neoink/40 group-hover:text-neoink/70 transition-colors font-bold">Apply To All</span>
                            </label>
                          </div>
                          <div className="flex flex-col gap-2">
                            {[
                              { size: 1024, label: '1K (1024 × 1024)' },
                              { size: 2048, label: '2K (2048 × 2048)' },
                              { size: 4096, label: '4K (4096 × 4096)' }
                            ].map(({ size, label }) => (
                              <button
                                key={size}
                                onClick={() => {
                                  if (applyToAll) {
                                    setImages(prev => prev.map(img => ({ ...img, targetSize: size })));
                                  } else {
                                    updateActiveImage({ targetSize: size });
                                  }
                                }}
                                className={`py-2.5 px-3.5 text-center rounded-xl text-xs font-mono uppercase tracking-wider transition-all flex justify-between items-center cursor-pointer border ${
                                  activeImage.targetSize === size 
                                    ? 'bg-neoink text-white border-transparent shadow-md font-bold' 
                                    : 'bg-[#F8F7F4] text-neoink/70 hover:bg-white border-neoink/10 shadow-sm'
                                }`}
                              >
                                <span>{label}</span>
                                {activeImage.targetSize === size && (
                                  <span className="text-[8px] uppercase tracking-widest font-mono font-bold bg-white/20 text-white px-1.5 py-0.5 rounded">Active</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
 
                        {/* Color Filters */}
                        <div className="space-y-4 pt-6 border-t border-neoink/10 text-left">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-bold uppercase tracking-wider text-neoink/85 font-sans flex items-center gap-1.5">
                              <SlidersHorizontal className="w-3.5 h-3.5 text-neoaccent stroke-[2.5]" />
                              <span>Photo Filter Preset</span>
                            </label>
                            {activeImage.filter && activeImage.filter !== 'None' && (
                              <button 
                                onClick={() => updateActiveImage({ filter: 'None' })}
                                className="text-[10px] font-mono uppercase tracking-widest text-neoaccent hover:underline font-bold"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-4 gap-2">
                            {['None', 'Grayscale', 'Sepia', 'Warm', 'Cool', 'Vintage', 'Invert', 'Sunset'].map((filt) => (
                              <button
                                key={filt}
                                onClick={() => updateActiveImage({ filter: filt })}
                                className={`py-2 px-1 text-center rounded-lg text-[9px] font-mono uppercase tracking-wider transition-all border ${
                                  (activeImage.filter || 'None') === filt
                                    ? 'bg-neoaccent text-white border-transparent shadow-md font-bold'
                                    : 'bg-[#F8F7F4] text-neoink/75 border-neoink/5 hover:bg-white shadow-sm'
                                }`}
                              >
                                {filt}
                              </button>
                            ))}
                          </div>
                        </div>
 
                        {/* Image Effects Station */}
                        {!activeImage.isVideo ? (
                          <div className="space-y-4 pt-6 border-t border-neoink/10 text-left">
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-bold uppercase tracking-wider text-neoink/85 font-sans flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-neoaccent stroke-[2.5]" />
                                <span>Dataset Custom Effects</span>
                              </label>
                              {activeImage.effect && activeImage.effect !== 'None' && (
                                <button 
                                  onClick={() => updateActiveImage({ effect: 'None' })}
                                  className="text-[10px] font-mono uppercase tracking-widest text-neoaccent hover:underline font-bold"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
 
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: 'None', label: 'Standard View', icon: ImageIcon },
                                { id: 'Pixelate', label: 'Pixel Generator', icon: Cpu },
                                { id: 'EmojiMosaic', label: 'Emoji Mosaic', icon: Smile },
                                { id: 'EdgeDetection', label: 'Edge Detection', icon: Crosshair },
                              ].map((eff) => {
                                const IconComponent = eff.icon;
                                const isActive = (activeImage.effect || 'None') === eff.id;
                                return (
                                  <button
                                    key={eff.id}
                                    onClick={() => {
                                      const updates: Partial<ImageState> = { effect: eff.id };
                                      if (eff.id === 'Pixelate' && !activeImage.pixelSize) {
                                        updates.pixelSize = 16;
                                      }
                                      if (eff.id === 'EmojiMosaic' && !activeImage.emojiDensity) {
                                        updates.emojiDensity = 12;
                                      }
                                      updateActiveImage(updates);
                                    }}
                                    className={`py-2.5 px-3 rounded-xl text-left text-[10px] font-bold uppercase tracking-wider transition-all border flex items-center gap-2 cursor-pointer ${
                                      isActive
                                        ? 'bg-neoaccent text-white border-transparent shadow-md'
                                        : 'bg-[#F8F7F4] text-neoink/75 border-neoink/5 hover:bg-white shadow-sm'
                                    }`}
                                  >
                                    <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-white stroke-[2.5]' : 'text-neoink/40 stroke-[2]'}`} />
                                    <span>{eff.label}</span>
                                  </button>
                                );
                              })}
                            </div>
 
                            {/* Dynamic Control Sliders for Pixelate */}
                            {activeImage.effect === 'Pixelate' && (
                              <div className="p-4 bg-[#F8F7F4] border border-neoink/10 rounded-xl space-y-2.5 animate-fade-in text-left shadow-sm">
                                <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-neoink/70 font-bold">
                                  <span>Pixel block size</span>
                                  <span className="text-neoaccent">{activeImage.pixelSize || 16}px</span>
                                </div>
                                <input 
                                  type="range" 
                                  min="4" 
                                  max="64" 
                                  step="4"
                                  value={activeImage.pixelSize || 16}
                                  onChange={(e) => updateActiveImage({ pixelSize: parseInt(e.target.value) })}
                                  className="w-full h-1.5 bg-neoink/10 rounded-lg appearance-none cursor-pointer accent-neoaccent"
                                />
                                <div className="flex justify-between text-[8px] font-mono uppercase text-neoink/40 font-bold">
                                  <span>Fine (4px)</span>
                                  <span>Retro (64px)</span>
                                </div>
                              </div>
                            )}
 
                            {/* Dynamic Control Sliders for Emoji Mosaic */}
                            {activeImage.effect === 'EmojiMosaic' && (
                              <div className="p-4 bg-[#F8F7F4] border border-neoink/10 rounded-xl space-y-2.5 animate-fade-in text-left shadow-sm">
                                <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-neoink/70 font-bold">
                                  <span>Emoji Block Size</span>
                                  <span className="text-neoaccent">{activeImage.emojiDensity || 12}px</span>
                                </div>
                                <input 
                                  type="range" 
                                  min="8" 
                                  max="24" 
                                  step="2"
                                  value={activeImage.emojiDensity || 12}
                                  onChange={(e) => updateActiveImage({ emojiDensity: parseInt(e.target.value) })}
                                  className="w-full h-1.5 bg-neoink/10 rounded-lg appearance-none cursor-pointer accent-neoaccent"
                                />
                                <div className="flex justify-between text-[8px] font-mono uppercase text-neoink/40 font-bold">
                                  <span>Dense (8px)</span>
                                  <span>Spaced (24px)</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-4 bg-[#F8F7F4] border border-neoink/10 rounded-xl space-y-2 text-left shadow-sm">
                            <h4 className="text-xs font-bold text-neoink uppercase tracking-wider flex items-center gap-1.5">
                              <Video className="w-3.5 h-3.5 text-neoaccent stroke-[2.5]" />
                              <span>Video Mode Active</span>
                            </h4>
                            <p className="text-[10px] text-neoink/60 font-sans leading-normal font-medium">
                              Color filters, rotation overlays, and dimension maps are fully responsive for video compilation!
                            </p>
                          </div>
                        )}
 
                        {/* Dataset Metadata Export Station */}
                        <div className="space-y-4 pt-6 border-t border-neoink/10 text-left">
                          <label className="text-xs font-bold uppercase tracking-wider text-neoink/85 font-sans flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 text-neoaccent stroke-[2.5]" />
                            <span>Metadata Export Station</span>
                          </label>
                          <div className="bg-[#F8F7F4] border border-neoink/10 p-4 rounded-xl space-y-3 shadow-sm">
                            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono font-bold">
                              <div className="bg-white p-2 border border-neoink/5 rounded-lg">
                                <span className="text-neoink/40 block text-[8px] uppercase">Photos Count</span>
                                <span className="text-xs text-neoink">{images.length}</span>
                              </div>
                              <div className="bg-white p-2 border border-neoink/5 rounded-lg">
                                <span className="text-neoink/40 block text-[8px] uppercase">Videos Count</span>
                                <span className="text-xs text-neoink">{images.filter(i => i.isVideo).length}</span>
                              </div>
                            </div>
                            
                            <p className="text-[10px] text-neoink/60 leading-normal font-sans">
                              Export standalone training-ready manifest files instantly to sync with PyTorch, TensorFlow, or Pandas.
                            </p>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={downloadManifestJSON}
                                className="py-2 px-2.5 bg-white border border-neoink/10 hover:bg-neoaccent hover:text-white hover:border-transparent transition-all font-mono font-bold text-[9px] uppercase tracking-wider cursor-pointer rounded-lg flex items-center justify-center gap-1 text-neoink shadow-sm"
                                title="Download dataset_manifest.json"
                              >
                                <FileText className="w-3 h-3 text-neoaccent" />
                                <span>JSON Manifest</span>
                              </button>
                              
                              <button
                                onClick={downloadManifestCSV}
                                className="py-2 px-2.5 bg-white border border-neoink/10 hover:bg-neoaccent hover:text-white hover:border-transparent transition-all font-mono font-bold text-[9px] uppercase tracking-wider cursor-pointer rounded-lg flex items-center justify-center gap-1 text-neoink shadow-sm"
                                title="Download dataset_manifest.csv"
                              >
                                <Grid className="w-3 h-3 text-emerald-600" />
                                <span>CSV Spread</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Pixel Lead Option */}
                        <div className="space-y-3 pt-6 border-t border-neoink/10 text-left">
                          <label className="flex items-center justify-between p-3.5 bg-white border border-neoink/10 hover:shadow-md rounded-xl cursor-pointer transition-all">
                            <div className="flex items-center gap-2">
                              <Eye className="w-4 h-4 text-neoaccent stroke-[2.5]" />
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-neoink">Enable Pixel Lead</p>
                                <p className="text-[9px] text-neoink/40 font-mono font-bold">Hover coordinates & RGB values</p>
                              </div>
                            </div>
                            <input 
                              type="checkbox" 
                              checked={enablePixelLead}
                              onChange={(e) => setEnablePixelLead(e.target.checked)}
                              className="rounded-md border border-neoink/25 bg-white text-neoaccent focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer accent-neoaccent"
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-6 bg-white border-t border-neoink/10 mt-auto shrink-0">
                  <button 
                    onClick={exportZip}
                    disabled={images.length === 0 || isExporting}
                    className={`w-full py-3.5 px-4 text-xs font-mono font-bold uppercase tracking-widest gap-2 flex items-center justify-center transition-all rounded-xl shadow-md ${
                      images.length === 0 
                        ? 'bg-neoink/10 text-neoink/40 cursor-not-allowed border border-neoink/5 shadow-none'
                        : isExporting
                          ? 'bg-[#E63946]/75 text-white cursor-wait opacity-85'
                          : 'bg-neoaccent text-white border border-transparent hover:bg-[#E63946]/90 cursor-pointer active:scale-[0.99]'
                    }`}
                  >
                    {isExporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 text-white animate-spin stroke-[2.5]" />
                        <span>Compiling ZIP...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 text-white stroke-[2.5]" />
                        <span>Download All as ZIP</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </div>
 
      {/* Fullscreen Interactive Cinematic Inspector Modal */}
      <AnimatePresence>
        {fullscreenPreviewItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neoink/90 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-8"
            onClick={() => setFullscreenPreviewItem(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white border border-neoink/10 shadow-2xl max-w-5xl w-full h-[85vh] rounded-2xl overflow-hidden flex flex-col md:flex-row relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setFullscreenPreviewItem(null)}
                className="absolute top-4 right-4 bg-white hover:bg-neoaccent hover:text-white text-neoink border border-neoink/10 shadow-sm p-2 rounded-lg transition-all z-10 hover:scale-105 cursor-pointer"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
 
              {/* Media Presentation Stage */}
              <div className="flex-1 bg-[#FAF9F5] relative p-6 h-1/2 md:h-full flex items-center justify-center min-h-0 border-r border-neoink/10">
                <div className="w-full h-full flex items-center justify-center min-h-0 min-w-0">
                  {fullscreenPreviewItem.isVideo ? (
                    <video
                      src={fullscreenPreviewItem.src}
                      controls
                      autoPlay
                      loop
                      className="max-w-full max-h-full object-contain rounded-xl border border-neoink/10 shadow-lg bg-black"
                    />
                  ) : (
                    <img
                      src={fullscreenPreviewItem.src}
                      alt={fullscreenPreviewItem.name || fullscreenPreviewItem.alt}
                      className="max-w-full max-h-full object-contain select-none rounded-xl border border-neoink/10 shadow-lg bg-white"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
                <div className="absolute bottom-4 left-4 bg-white px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-neoink/60 border border-neoink/10 shadow-sm z-10 font-bold rounded-lg">
                  High-Resolution Source Asset
                </div>
              </div>

              {/* Metadata Sidebar Inspector */}
              <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-neoink/10 p-6 flex flex-col justify-between h-1/2 md:h-full overflow-y-auto">
                <div className="space-y-6 text-left">
                  <div>
                    <span className="px-2.5 py-1 bg-[#F8F7F4] text-neoink border border-neoink/10 font-mono text-[9px] font-extrabold uppercase tracking-widest rounded-md">
                      {fullscreenPreviewItem.category || (fullscreenPreviewItem.isVideo ? 'Video' : 'Scraped')}
                    </span>
                    <h3 className="text-2xl text-neoink font-bold tracking-tight mt-3 leading-snug font-sans">
                      {fullscreenPreviewItem.name || fullscreenPreviewItem.alt || 'Dataset Media Asset'}
                    </h3>
                    <p className="text-xs text-neoink/60 mt-1 font-mono font-bold">
                      ID: {fullscreenPreviewItem.id}
                    </p>
                  </div>
  
                  {fullscreenPreviewItem.description && (
                    <div className="space-y-1.5">
                      <h4 className="text-[10px] font-mono uppercase tracking-widest text-neoink/60 font-bold">Description</h4>
                      <p className="text-xs text-neoink/75 leading-relaxed font-sans font-medium">
                        {fullscreenPreviewItem.description}
                      </p>
                    </div>
                  )}
  
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-mono uppercase tracking-widest text-neoink/60 font-bold">Asset Parameters</h4>
                    <div className="grid grid-cols-2 gap-2 text-left font-mono font-bold">
                      <div className="p-2.5 bg-white border border-neoink/10 shadow-sm rounded-lg">
                        <p className="text-[9px] text-neoink/40 uppercase">Resolution</p>
                        <p className="text-xs font-extrabold text-neoink mt-0.5">{fullscreenPreviewItem.resolutionLabel || 'High-Res'}</p>
                      </div>
                      <div className="p-2.5 bg-white border border-neoink/10 shadow-sm rounded-lg">
                        <p className="text-[9px] text-neoink/40 uppercase">Dimensions</p>
                        <p className="text-xs font-extrabold text-neoink mt-0.5">{fullscreenPreviewItem.targetSize ? `${fullscreenPreviewItem.targetSize}px` : 'Dynamic'}</p>
                      </div>
                      <div className="p-2.5 bg-white border border-neoink/10 shadow-sm rounded-lg col-span-2">
                        <p className="text-[9px] text-neoink/40 uppercase">Est. Size</p>
                        <p className="text-xs font-extrabold text-neoink mt-0.5">{fullscreenPreviewItem.sizeLabel || '3.5 MB'}</p>
                      </div>
                    </div>
                  </div>
  
                  <div className="space-y-1.5 text-xs text-neoink/60 font-sans leading-normal bg-[#FAF9F5] border border-neoink/10 p-3.5 rounded-xl">
                    <p className="font-bold text-neoink text-[10px] uppercase font-mono mb-1">Safety & Licensing</p>
                    {fullscreenPreviewItem.hasWatermarks ? (
                      <span className="text-[#E63946] font-mono text-[9px] font-bold uppercase tracking-wider block">⚠️ Potential Watermark Detected</span>
                    ) : (
                      <span className="text-emerald-600 font-mono text-[9px] font-bold uppercase tracking-wider block">✓ Verified Clean Asset</span>
                    )}
                  </div>
                </div>
  
                <div className="pt-6 border-t border-neoink/10 flex flex-col gap-2">
                  <button
                    onClick={() => {
                      const isVideo = !!fullscreenPreviewItem.isVideo;
                      const suffix = isVideo ? '.mp4' : '.jpg';
                      const imgState: ImageState = {
                        id: Math.random().toString(36).substring(2, 9),
                        src: fullscreenPreviewItem.src,
                        name: (fullscreenPreviewItem.alt || fullscreenPreviewItem.name || 'scraped_asset').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20) + suffix,
                        rotation: 0,
                        scale: 1,
                        targetSize: fullscreenPreviewItem.targetSize || 1024,
                        filter: 'None',
                        effect: 'None',
                        pixelSize: 16,
                        emojiDensity: 12,
                        isVideo,
                      };
                      setImages(prev => [...prev, imgState]);
                      setActiveId(imgState.id);
                      setFullscreenPreviewItem(null);
                      setActiveTab('workspace');
                    }}
                    className="w-full py-3 bg-neoaccent text-white hover:bg-neoaccent/90 transition-all rounded-lg text-xs font-mono font-bold uppercase tracking-widest cursor-pointer flex items-center justify-center gap-2 shadow-md"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Import to Workspace</span>
                  </button>
                  <button
                    onClick={() => setFullscreenPreviewItem(null)}
                    className="w-full py-2.5 bg-transparent hover:bg-neoink/5 text-neoink/60 text-[10px] font-mono font-bold uppercase tracking-widest transition-all border border-transparent hover:border-neoink/20 rounded-lg cursor-pointer"
                  >
                    Back to Catalog
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


