"use client";

import { useEffect, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { adminUpdateCoachPhoto } from "@/app/actions";

type UploadState = {
  success: boolean;
  message: string;
  photoUrl?: string;
};

type CoachPhotoUploadProps = {
  userId: string;
  photoUrl?: string | null;
  photoVersion?: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Subiendo..." : "Subir"}
    </Button>
  );
}

const initialState: UploadState = {
  success: false,
  message: "",
};

export function CoachPhotoUpload({ userId, photoUrl, photoVersion }: CoachPhotoUploadProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(adminUpdateCoachPhoto as any, initialState);
  const version = photoVersion ? encodeURIComponent(photoVersion) : "";
  const imageUrl = photoUrl ? `${photoUrl}${version ? `?v=${version}` : ""}` : null;

  useEffect(() => {
    if (state?.success) {
      router.refresh();
    }
  }, [state?.success, router]);

  return (
    <div className="flex items-center gap-4">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="Foto" className="h-16 w-16 rounded-full object-cover border" />
      ) : (
        <div className="h-16 w-16 rounded-full border flex items-center justify-center text-xs text-muted-foreground">
          Sin foto
        </div>
      )}
      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="userId" value={userId} />
        <input name="avatarFile" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
        <SubmitButton />
        {!!state?.message && (
          <span className={`text-xs ${state.success ? "text-emerald-600" : "text-red-600"}`}>
            {state.message}
          </span>
        )}
      </form>
    </div>
  );
}
