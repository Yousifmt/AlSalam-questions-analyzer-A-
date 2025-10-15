
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Unlock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useLock } from "@/context/lock-context";

const UNLOCK_CODE = "353535";

type UnlockDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export function UnlockDialog({ isOpen, setIsOpen }: UnlockDialogProps) {
  const [code, setCode] = React.useState("");
  const [isUnlocking, setIsUnlocking] = React.useState(false);
  const { isLocked, unlock, lock } = useLock();
  const { toast } = useToast();

  const handleUnlock = () => {
    setIsUnlocking(true);
    // Simulate network delay
    setTimeout(() => {
        if (code === UNLOCK_CODE) {
            unlock();
            toast({
                title: "System Unlocked",
                description: "Administrative controls are now available.",
            });
            setIsOpen(false);
            setCode("");
        } else {
            toast({
                title: "Incorrect Code",
                description: "The code you entered is incorrect. Please try again.",
                variant: "destructive",
            });
        }
        setIsUnlocking(false);
    }, 500);
  };
  
  const handleLock = () => {
      lock();
      toast({
          title: "System Locked",
          description: "Administrative controls have been hidden.",
      });
      setIsOpen(false);
  }

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleUnlock();
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2">
            <Unlock className="text-primary"/>
            {isLocked ? 'Unlock System' : 'System Controls'}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {isLocked
              ? "Enter the administrator code to unlock editing and management features."
              : "The system is currently unlocked. You can lock it again to hide sensitive controls."}
          </DialogDescription>
        </DialogHeader>

        {isLocked ? (
             <div className="space-y-2 py-4">
                <Label htmlFor="unlock-code">Unlock Code</Label>
                <Input 
                    id="unlock-code"
                    type="password"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Enter code..."
                />
             </div>
        ) : (
            <div className="py-4 text-center">
                <p className="text-green-500 font-semibold">System is Unlocked</p>
            </div>
        )}
       

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          {isLocked ? (
            <Button onClick={handleUnlock} disabled={isUnlocking || !code}>
                {isUnlocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Unlock
            </Button>
          ): (
             <Button variant="destructive" onClick={handleLock}>
                Lock System
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
