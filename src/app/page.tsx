"use client";
import { CardDeck } from "@/components/deck/CardDeck";
import { LikesList } from "@/components/likes/LikesList";
import { CatalogList } from "@/components/catalog/CatalogList";
import { GalleryHorizontalEnd, Heart, LayoutGrid } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/animate-ui/components/animate/tabs";
import { SettingsSidebar } from "@/components/home/SettingsSidebar";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { DynamicBackground } from "@/components/deck/DynamicBackground";
import { AnimatePresence, motion } from "motion/react";

export default function Home() {
  const [tab, setTab] = useState("swipe");

  useHotkeys("1", () => setTab("swipe"), []);
  useHotkeys("2", () => setTab("catalog"), []);
  useHotkeys("3", () => setTab("likes"), []);

  return (
    <main className="h-full pt-[env(safe-area-inset-top)] font-sans">
      <DynamicBackground show={tab === "swipe"} />
      <div className="h-full flex flex-col">

        {/* Top bar: settings icon */}
        <div className="w-full max-w-7xl mx-auto mt-2 min-w-0 relative px-4">
          <SettingsSidebar />
        </div>

        {/* Tab navigation bar */}
        <Tabs
          value={tab}
          onValueChange={setTab}
          className="w-full flex-1 min-h-0"
        >
          <div className="w-full max-w-7xl mx-auto px-4 mt-1">
            <TabsList className="grid mx-auto h-fit w-fit grid-cols-3 bg-muted/30 rounded-full z-0">
              <TabsTrigger value="swipe" className="h-11 w-14 group rounded-full z-0">
                <GalleryHorizontalEnd
                  className="size-5 z-0 text-foreground fill-none transition-all group-data-[state=active]:fill-foreground"
                />
              </TabsTrigger>

              <TabsTrigger value="catalog" className="h-11 w-14 group rounded-full z-0">
                <LayoutGrid
                  className="size-5 z-0 text-foreground fill-none transition-all group-data-[state=active]:fill-foreground"
                />
              </TabsTrigger>

              <TabsTrigger value="likes" className="h-11 w-14 group rounded-full z-0">
                <Heart
                  className="size-5 z-0 text-foreground fill-none transition-all group-data-[state=active]:fill-foreground"
                />
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab content — no sliding, simple show/hide with fade */}
          <div className="flex-1 min-h-0">
            <AnimatePresence mode="wait">
              {tab === "swipe" && (
                <motion.div
                  key="swipe"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="h-full flex justify-center overflow-hidden"
                >
                  <div className="w-full max-w-md h-full px-4">
                    <CardDeck />
                  </div>
                </motion.div>
              )}
              {tab === "catalog" && (
                <motion.div
                  key="catalog"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="h-full"
                >
                  <CatalogList />
                </motion.div>
              )}
              {tab === "likes" && (
                <motion.div
                  key="likes"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="h-full"
                >
                  <LikesList />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Tabs>
      </div>
    </main>
  );
}