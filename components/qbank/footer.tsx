
"use client";

import React from 'react';
import { Separator } from '../ui/separator';

export default function Footer() {
  return (
    <footer className="w-full flex-shrink-0 border-t border-border">
      <div className="container mx-auto px-4 md:px-6 py-4 flex items-center justify-center">
        <p className="text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Al-Salam Q-Genius. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
