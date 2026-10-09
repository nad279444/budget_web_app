import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import Link from "next/link";

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden border-b border-border bg-grain">
      <div className="container relative mx-auto px-4 pb-14 pt-16 text-center sm:pt-24">
        <div className="animate-rise mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-background/85 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
          <Sparkles size={14} className="text-tertiary" />
          AI money coaching, in plain English
        </div>

        <h1 className="animate-rise text-balance text-4xl font-bold text-foreground sm:text-6xl lg:text-7xl">
          Wealth
          <br />
          <span className="text-gradient-brand">money management with intelligence.</span>
        </h1>

        <p className="animate-rise mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          Describe how you spend and your AI coach builds a budget, runs the
          math, and shows you exactly where to save.
        </p>

        <div className="animate-rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/dashboard">
            <Button size="lg" className="h-12 gap-2 px-7 text-base">
              Get started free
              <ArrowRight size={18} />
            </Button>
          </Link>
          <Link href="/assistant">
            <Button
              size="lg"
              variant="outline"
              className="h-12 gap-2 px-7 text-base"
            >
              <Play size={16} />
              Try Money Chat
            </Button>
          </Link>
        </div>

        <div className="relative mx-auto mt-16 max-w-5xl">          <div className="relative overflow-hidden rounded-lg border border-border bg-card shadow-2xl shadow-primary/10">
            <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-destructive/60" />
              <span className="h-3 w-3 rounded-full bg-tertiary/70" />
              <span className="h-3 w-3 rounded-full bg-primary/70" />
            </div>
            <Image
              src="/banner.jpg"
              width={1280}
              height={720}
              alt="Wealth dashboard preview"
              className="h-auto w-full"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

