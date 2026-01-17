"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type InviteState = {
  success?: boolean;
  message?: string;
  link?: string;
};

type Props = {
  userId: string;
  actionActivateAndInvite: (prevState: InviteState, formData: FormData) => Promise<InviteState>;
};

export function CoachInviteActions({ userId, actionActivateAndInvite }: Props) {
  const [state, formAction] = useActionState(actionActivateAndInvite as any, {
    success: false,
    message: "",
  } as InviteState);
  const { toast } = useToast();
  const safeState = state ?? {};

  useEffect(() => {
    if (safeState.message) {
      toast({
        title: safeState.success ? "Éxito" : "No se pudo enviar",
        description: safeState.message,
        variant: safeState.success ? "default" : "destructive",
      });
    }
  }, [safeState, toast]);

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700">
          Dar alta + enviar contraseña
        </Button>
      </form>
      {safeState.link && (
        <div className="text-xs text-muted-foreground break-all">
          Link de contraseña:{" "}
          <a href={safeState.link} target="_blank" rel="noreferrer" className="underline text-primary">
            {safeState.link}
          </a>
        </div>
      )}
    </div>
  );
}
