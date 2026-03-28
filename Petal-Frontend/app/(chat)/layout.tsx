import { Toaster } from "sonner";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Toaster
        position="top-center"
        theme="light"
        toastOptions={{
          className: "!rounded-none !border-[#d8d0c2] !bg-white !text-[#171717]",
        }}
      />
      {children}
    </>
  );
}
