
"use client";

import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";

type BackToTopButtonProps = {
    onClick: () => void;
}

export function BackToTopButton({ onClick }: BackToTopButtonProps) {
    return (
        <Button
            onClick={onClick}
            variant="outline"
            size="icon"
            className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-50 bg-primary/80 hover:bg-primary border-primary text-primary-foreground backdrop-blur-sm"
            aria-label="Back to top"
        >
            <ArrowUp className="h-6 w-6" />
            <span className="sr-only">Back to top</span>
        </Button>
    )
}
