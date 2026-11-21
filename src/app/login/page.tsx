import { Suspense } from "react";
import { FormularioLogin } from "@/erp/ui/login";

export default function PaginaLogin() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Suspense>
        <FormularioLogin />
      </Suspense>
    </main>
  );
}
