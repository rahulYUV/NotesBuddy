import React, { useRef, useEffect, useState, useCallback, useMemo, memo } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Pencil, Type, Download, RotateCcw, Sun, Moon, Loader2, ArrowRight, Save, Clock, LayoutTemplate, FileJson } from "lucide-react";
import html2canvas from "@jsplumb/html2canvas";
import { InteractiveGridPattern } from "@/components/ui/shadcn-io/interactive-grid-pattern";
import AnimatedLiquidBackground from "@/components/ui/animated-liquid-background";
import Book3D from "@/components/ui/book-3d";
import { VerticalDialNav } from "@/components/ui/vertical-dial-nav";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/get-media-query";
import { HandDrawnNotebook, HandDrawnFolder, HandDrawnLaptop, HandDrawnPen, HandDrawnCoffee, HandDrawnLightbulb, HandDrawnClock, HandDrawnFlask, HandDrawnGlasses } from "@/components/ui/hand-drawn-icons";
import TextCarousel from "@/components/text-carousel";

interface RippedPaperProps {
  content: string;
  onContentChange: (value: string) => void;
}

interface Point {
  x: number;
  y: number;
}

interface Path {
  points: Point[];
  id: string;
}

// Memoized components to prevent re-renders during high-frequency drawing state updates
const MemoizedBackgroundLayer = memo(() => (
  <>
    <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
      <AnimatedLiquidBackground speed={0.5} color1="#A8FF78" color2="#78FFD6" color3="#00B4DB" swirl={5} />
    </div>
    <InteractiveGridPattern
      className={cn("[mask-image:radial-gradient(100vw_circle_at_center,white,transparent)]", "inset-x-0 inset-y-[-30%] h-[200%] skew-y-12 opacity-50 mix-blend-overlay pointer-events-none")}
      width={40} height={40} squares={[80, 80]}
    />
  </>
));
MemoizedBackgroundLayer.displayName = "MemoizedBackgroundLayer";

const MemoizedIconsLayer = memo(() => (
  <>
    <HandDrawnNotebook className="absolute top-24 left-10 w-40 h-40 text-black/20 -rotate-12 pointer-events-none hidden xl:block z-0" />
    <HandDrawnPen className="absolute bottom-24 right-24 w-32 h-32 text-black/20 rotate-45 pointer-events-none hidden xl:block z-0" />
  </>
));
MemoizedIconsLayer.displayName = "MemoizedIconsLayer";

// Memoize heavy child components to prevent re-renders during drawing
const MemoizedBook3D = memo(Book3D);
const MemoizedTextCarousel = memo(TextCarousel);
const MemoizedVerticalDialNav = memo(VerticalDialNav);

const UNDERLINE_PATH = `
  M 40 10 
  C 10 10, 0 5, 0 10
  S 180 10, 230 8
  S 280 6, 330 10
  S 380 10, 400 10
  S 380 5, 330 12
  S 280 12, 230 8
  S 180 5, 130 12
`;

export default function RippedPaper({
  content,
  onContentChange,
}: RippedPaperProps) {
  const [year, setYear] = useState(new Date().getFullYear());
  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<Path[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const mediaQuery = useMediaQuery();

  // Ref for the canvas section to be exported
  const canvasSectionRef = useRef<HTMLDivElement>(null);
  // Main container ref for scrolling
  const mainContainerRef = useRef<HTMLDivElement>(null);

  const lastPointRef = useRef<Point | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Hydrate state from localStorage on mount
  useEffect(() => {
    // Theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') setIsDarkMode(true);

    // Content
    const savedContent = localStorage.getItem('notes-content');
    if (savedContent) onContentChange(savedContent);
  }, []); // Run once on mount

  // Autosave content
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('notes-content', content);
      setLastSaved(new Date());
    }, 1000);
    return () => clearTimeout(timer);
  }, [content]);

  // Persist theme
  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    setRotation(0);
  }, []);

  // Auto-focus textarea when switching to Text Mode
  useEffect(() => {
    if (!isDrawMode && contentRef.current) {
      const textarea = contentRef.current.querySelector('textarea');
      if (textarea) textarea.focus();
    }
  }, [isDrawMode]);

  const startDrawing = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDrawMode) return;
      const svg = svgRef.current;
      if (!svg) return;

      svg.setPointerCapture(e.pointerId);

      const point = {
        x: e.nativeEvent.offsetX,
        y: e.nativeEvent.offsetY,
      };

      lastPointRef.current = point;
      setIsDrawing(true);
      setCurrentPath([point]);
    },
    [isDrawMode]
  );

  const draw = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDrawing || !isDrawMode) return;

      const x = e.nativeEvent.offsetX;
      const y = e.nativeEvent.offsetY;

      if (lastPointRef.current) {
        const dx = x - lastPointRef.current.x;
        const dy = y - lastPointRef.current.y;
        if (dx * dx + dy * dy < 10) return;
      }

      const point = { x, y };
      lastPointRef.current = point;

      setCurrentPath((prev) => [...prev, point]);
    },
    [isDrawing, isDrawMode]
  );

  const stopDrawing = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (currentPath.length > 0) {
        setPaths((prev) => [
          ...prev,
          { points: currentPath, id: Math.random().toString() },
        ]);
        setCurrentPath([]);
      }
      setIsDrawing(false);

      const svg = svgRef.current;
      if (svg) {
        svg.releasePointerCapture(e.pointerId);
      }
    },
    [currentPath]
  );

  const handleReset = useCallback(() => {
    setPaths([]);
    setRotation(0);
  }, []);

  const applyTemplate = (type: 'yearly' | 'monthly' | 'tracker') => {
    let text = "";
    if (type === 'yearly') {
      text = "MY 2026 THEME\n\n1. Big Goal:\n\n2. Key Habits:\n\n3. Things to Drop:";
    } else if (type === 'monthly') {
      text = "MONTHLY FOCUS\n\nWeek 1:\nWeek 2:\nWeek 3:\nWeek 4:";
    } else if (type === 'tracker') {
      text = "HABIT TRACKER\n\n[ ] Workout\n[ ] Read\n[ ] Deep Work\n[ ] Sleep 8h";
    }
    onContentChange(text);
  };

  const pointsToPath = (points: Point[]) => {
    if (points.length === 0) return "";
    const pathData = [`M ${points[0].x} ${points[0].y}`];
    for (let i = 1; i < points.length; i++) {
      pathData.push(`L ${points[i].x} ${points[i].y}`);
    }
    return pathData.join(" ");
  };


  const handleDownload = async () => {
    // Export target is now canvasSectionRef
    if (isExporting || !canvasSectionRef.current) return;

    setIsExporting(true);

    setTimeout(async () => {
      if (!canvasSectionRef.current) return;

      try {
        const buttonsDiv = document.querySelector(".control-buttons") as HTMLElement;
        if (buttonsDiv) buttonsDiv.style.display = "none";

        const maxWidth = 1920;
        const maxHeight = 1080;
        // Use canvasSectionRef for dimensions
        const scale = Math.min(
          maxWidth / canvasSectionRef.current.offsetWidth,
          maxHeight / canvasSectionRef.current.offsetHeight
        );

        const canvas = await html2canvas(canvasSectionRef.current, {
          backgroundColor: isDarkMode ? "#09090b" : "#000000",
          scale: scale,
          width: Math.min(canvasSectionRef.current.offsetWidth, maxWidth),
          height: Math.min(canvasSectionRef.current.offsetHeight, maxHeight),
          logging: false,
          imageTimeout: 0,
          useCORS: true,
          onclone: (clonedDoc) => {
            const textarea = clonedDoc.querySelector("textarea");
            if (textarea) {
              const div = clonedDoc.createElement("div");
              div.innerHTML = textarea.value.split("\n").map((line) => line || "&nbsp;").join("<br>");
              div.style.cssText = `
                      width: 100%; height: 100%; background: transparent; resize: none;
                      padding: ${textarea.style.padding}; margin: 0; line-height: 1em;
                      font-size: inherit; color: inherit; overflow: hidden;
                    `;
              div.className = textarea.className;
              textarea.parentNode?.replaceChild(div, textarea);

              const title = clonedDoc.querySelector("h1");
              if (title) (title as HTMLElement).style.transform = "translateX(0.75rem) translateY(-1rem)";

              const containers = clonedDoc.querySelectorAll(".relative");
              containers.forEach((container) => {
                (container as HTMLElement).style.margin = "0";
                (container as HTMLElement).style.padding = "0";
              });
            }
          },
        });

        const link = document.createElement("a");
        link.download = `NotesBuddy${year}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } catch (err) {
        console.error("Export failed", err);
      } finally {
        const buttonsDiv = document.querySelector(".control-buttons") as HTMLElement;
        if (buttonsDiv) buttonsDiv.style.display = "flex";
        setIsExporting(false);
      }
    }, 100);
  };

  return (
    <main className="relative w-full h-screen overflow-y-auto overflow-x-hidden bg-gray-50 snap-y snap-mandatory scroll-smooth" ref={mainContainerRef}>

      <VerticalDialNav
        sections={[
          { id: "canvas", label: "Canvas" },
          { id: "book", label: "Philosophy" },
        ]}
        containerRef={mainContainerRef as React.RefObject<HTMLElement>}
      />

      {/* SECTION 1: CANVAS */}
      <section id="canvas" className="relative w-full h-screen min-h-screen flex items-center justify-center snap-start overflow-hidden">
        {/* Decorative Icons - Memoized */}
        <MemoizedIconsLayer />

        {/* Left Side Hero & Guides - High Contrast & Readability Mode */}
        <div className="absolute top-1/2 left-10 lg:left-24 -translate-y-1/2 z-20 hidden 2xl:flex flex-col gap-6 w-[380px] pointer-events-none font-sans">

          <div className="pointer-events-auto">
            <MemoizedTextCarousel />
            <div className="mt-4 bg-white/40 backdrop-blur-md p-4 rounded-xl border border-white/50 shadow-sm">
              <p className="text-zinc-900 text-lg font-medium leading-relaxed">
                Your distraction-free zone for 2026 clarity.<br />
                <span className="text-zinc-700 text-base font-normal">Strategy meets Serendipity.</span>
              </p>
            </div>
          </div>

          <div className="space-y-4 pointer-events-auto bg-white/90 backdrop-blur-xl p-6 rounded-2xl border border-white/60 shadow-xl ring-1 ring-black/5">
            <h3 className="font-bold text-lg text-zinc-950 flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-sm"></span>
              How it works
            </h3>
            <ul className="space-y-2.5 text-sm text-zinc-800 font-medium leading-normal">
              <li className="flex gap-2"><span className="text-blue-600 font-bold">1.</span> Write your yearly theme.</li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold">2.</span> Break into quarterly blocks.</li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold">3.</span> Pin tab & update daily.</li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold">4.</span> Export for accountability.</li>
            </ul>
          </div>

          <div className="pointer-events-auto">
            <div className="inline-block px-3 py-1 mb-3 bg-white/60 backdrop-blur-sm rounded-lg border border-white/50">
              <span className="text-xs font-extrabold text-zinc-800 uppercase tracking-widest">Quick Templates</span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button onClick={() => applyTemplate('yearly')} className="px-4 py-2 bg-white shadow-md border border-zinc-200 rounded-xl text-sm font-bold text-zinc-700 hover:border-blue-500 hover:text-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-1.5"><LayoutTemplate className="w-4 h-4" /> Yearly</button>
              <button onClick={() => applyTemplate('monthly')} className="px-4 py-2 bg-white shadow-md border border-zinc-200 rounded-xl text-sm font-bold text-zinc-700 hover:border-blue-500 hover:text-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-1.5"><Clock className="w-4 h-4" /> Monthly</button>
              <button onClick={() => applyTemplate('tracker')} className="px-4 py-2 bg-white shadow-md border border-zinc-200 rounded-xl text-sm font-bold text-zinc-700 hover:border-blue-500 hover:text-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-1.5"><Pencil className="w-4 h-4" /> Tracker</button>
            </div>
            {/* Autosave moved to canvas header */}
          </div>
        </div>

        {/* Background Elements - Memoized */}
        <MemoizedBackgroundLayer />

        {/* The Note Paper - Wrapped in ref for export */}
        <div
          ref={canvasSectionRef}
          className="relative z-10 w-full h-full flex items-center justify-center p-4 md:p-0 md:translate-x-16 transition-transform duration-500"
        >
          <div
            className={cn(
              "relative w-[90vw] h-[65vh] sm:w-[450px] sm:h-[600px] md:w-[750px] md:h-[850px] backdrop-blur-xl shadow-2xl border transition-colors duration-300",
              isDarkMode
                ? "bg-zinc-900/80 border-zinc-700 text-white"
                : "bg-white/60 border-white/40 text-zinc-950"
            )}
            style={{
              transform: `rotate(${rotation}deg)`,
            }}
          >
            <div
              ref={contentRef}
              className={cn(
                "z-10 absolute top-0 left-0 w-full h-full p-0 text-3xl sm:text-4xl md:text-5xl transition-colors duration-300",
                isDarkMode ? "text-white" : "text-zinc-950",
                isDrawMode ? "cursor-crosshair" : "cursor-text"
              )}
            >
              <svg
                ref={svgRef}
                className="absolute top-0 left-0 w-full h-full z-20"
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerLeave={stopDrawing}
                style={{
                  touchAction: "none",
                  userSelect: "none",
                }}
              >
                {paths.map((path) => (
                  <path
                    key={path.id}
                    d={pointsToPath(path.points)}
                    stroke={isDarkMode ? "#ffffff" : "#09090b"}
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {currentPath.length > 0 && (
                  <path
                    d={pointsToPath(currentPath)}
                    stroke={isDarkMode ? "#ffffff" : "#09090b"}
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
              <div
                className={`absolute top-0 left-0 w-full h-full flex flex-col ${isDrawMode ? "pointer-events-none" : "z-20"}`}
              >
                <style jsx global>{`
                  .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                  }
                  .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(161, 161, 170, 0.3);
                    border-radius: 9999px;
                  }
                  .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(255, 255, 255, 0.2);
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(161, 161, 170, 0.5);
                  }
                  .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(255, 255, 255, 0.3);
                  }
                `}</style>
                <div className="relative pt-8 px-8 shrink-0 select-none flex justify-between items-end">
                  <h1 className="text-4xl sm:text-5xl md:text-6xl leading-none tracking-tight font-bold text-zinc-900">
                    My {year} Master Plan
                  </h1>

                  {lastSaved && (
                    <div className="hidden sm:flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-1 opacity-70">
                      <Save className="w-3 h-3" />
                      Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                  <div className="">
                    <svg
                      className="absolute -bottom-2 md:-bottom-4 left-2 w-full"
                      height="20"
                      viewBox={
                        mediaQuery === "md" || mediaQuery === "lg"
                          ? "40 0 400 20"
                          : "20 0 550 5"
                      }
                    >
                      <path
                        d={UNDERLINE_PATH}
                        stroke={isDarkMode ? "#ffffff" : "#09090b"}
                        strokeWidth={
                          mediaQuery === "md" || mediaQuery === "lg"
                            ? "3"
                            : mediaQuery === "sm"
                              ? "2.5"
                              : "2"
                        }
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
                <textarea
                  value={content}
                  aria-label="Yearly Planning Canvas"
                  onChange={(e) => onContentChange(e.target.value)}
                  className="w-full flex-1 bg-transparent focus:outline-none resize-none px-12 py-4 overflow-y-auto custom-scrollbar font-handwriting text-3xl md:text-4xl leading-relaxed"
                  maxLength={5000}
                  style={{
                    lineHeight: "1.5em",
                  }}
                  placeholder="Start typing here..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Controls - Premium Glass Navbar (Dynamic Alignment) */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 xl:bottom-auto xl:top-[calc(50vh-425px)] xl:left-[calc(50vw-600px)] xl:translate-x-0 z-50 control-buttons flex items-center gap-1.5 p-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl ring-1 ring-white/10 transition-all duration-300 hover:bg-white/10">

          <Toggle
            pressed={!isDrawMode}
            onPressedChange={() => setIsDrawMode(false)}
            className={cn(
              "w-10 h-10 rounded-full transition-all duration-300 flex items-center justify-center",
              !isDrawMode ? "bg-zinc-900 text-white shadow-xl scale-110 ring-2 ring-white/20" : "text-zinc-600 hover:bg-white/20 hover:text-zinc-900"
            )}
            title="Type Mode"
          >
            <Type className="w-5 h-5" />
          </Toggle>

          <Toggle
            pressed={isDrawMode}
            onPressedChange={() => setIsDrawMode(true)}
            className={cn(
              "w-10 h-10 rounded-full transition-all duration-300 flex items-center justify-center",
              isDrawMode ? "bg-zinc-900 text-white shadow-xl scale-110 ring-2 ring-white/20" : "text-zinc-600 hover:bg-white/20 hover:text-zinc-900"
            )}
            title="Draw Mode"
          >
            <Pencil className="w-5 h-5" />
          </Toggle>

          <div className="w-px h-5 bg-zinc-900/10 mx-1" /> {/* Divider */}

          <Toggle
            onPressedChange={handleReset}
            className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-600 hover:bg-white/30 hover:text-red-600 transition-all duration-200"
            title="Reset Canvas"
          >
            <RotateCcw className="w-5 h-5" />
          </Toggle>

          <Toggle
            onPressedChange={handleDownload}
            disabled={isExporting}
            className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-600 hover:bg-white/30 hover:text-blue-600 transition-all duration-200 disabled:opacity-50"
            title="Download Image"
          >
            {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          </Toggle>

          <Toggle
            pressed={isDarkMode}
            onPressedChange={() => setIsDarkMode(!isDarkMode)}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
              isDarkMode ? "bg-zinc-800 text-white shadow-md ring-1 ring-white/10" : "text-zinc-600 hover:bg-white/30 hover:text-orange-500"
            )}
            title="Toggle Theme"
          >
            {isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </Toggle>
        </div>
      </section>

      {/* SECTION 2: PHILOSOPHY */}
      <section id="book" className="relative w-full h-screen min-h-screen flex flex-col items-center justify-center bg-[#f7f5f0] snap-start border-t border-stone-200 overflow-hidden">
        <HandDrawnFlask className="absolute bottom-10 left-10 w-48 h-48 text-stone-900/10 rotate-12 pointer-events-none z-0" />
        <HandDrawnGlasses className="absolute top-20 right-20 w-32 h-32 text-stone-900/10 -rotate-12 pointer-events-none z-0" />

        <div className="absolute inset-0 bg-[#f7f5f0] opacity-80" />
        <div className="z-10 text-center mb-12">
          <h2 className="font-serif text-4xl md:text-6xl text-stone-900 mb-4 tracking-tight">Systems & Chemistry</h2>
          <p className="font-sans text-stone-500 text-lg max-w-md mx-auto">Mix rigid systems (Tim Cook) with experimentation (Walter White).</p>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto mb-12 px-4">
          <div className="bg-white/50 backdrop-blur-sm p-4 rounded-xl border border-stone-200">
            <h4 className="font-serif font-bold text-stone-900 mb-1">Chemistry of Focus</h4>
            <p className="text-xs text-stone-500">Volatile ideas need a stable container. The canvas is your lab.</p>
          </div>
          <div className="bg-white/50 backdrop-blur-sm p-4 rounded-xl border border-stone-200">
            <h4 className="font-serif font-bold text-stone-900 mb-1">Supply Chain of Habits</h4>
            <p className="text-xs text-stone-500">Logistics matter. Track inputs (sleep, reading) to optimize outputs.</p>
          </div>
        </div>
        <div className="z-10 relative">
          <MemoizedBook3D />
        </div>
        <p className="mt-12 text-sm uppercase tracking-widest text-stone-400 font-medium">Hover to Open</p>
      </section>

    </main>
  );
}
